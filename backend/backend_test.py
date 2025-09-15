#!/usr/bin/env python3
"""
backend_e2e_test.py — End-to-end tests for the GPS tracker backend (NodeJS + Firebase RTDB)

What this tests:
  1) /api/health responds OK
  2) TCP ingest accepts newline-JSON from a fake device
  3) Data shows up in REST:
     - /api/telemetry/latest?deviceId=...
     - /api/devices/:id
     - /api/vehicles
     - /api/vehicles/:vehicleId/track
     - /api/devices/:id/track
  4) SSE stream at /api/stream/latest is readable
  5) Lat/Lon clamping on out-of-range coordinates

Env / CLI:
  BACKEND_HTTP_BASE   (default: http://127.0.0.1:8080)
  BACKEND_TCP_HOST    (default: 127.0.0.1)
  BACKEND_TCP_PORT    (default: 9331)
  API_KEY             (optional; used for POST /api/devices if set)

  You may also pass --http-base, --tcp-host, --tcp-port, --api-key on CLI.

Usage:
  python backend_e2e_test.py
"""
import argparse
import json
import os
import socket
import time
import uuid
from urllib.parse import quote

import requests

# -------- Config --------
DEFAULT_HTTP_BASE = os.getenv("BACKEND_HTTP_BASE", "http://31.97.156.77:8080")
DEFAULT_TCP_HOST  = os.getenv("BACKEND_TCP_HOST", "31.97.156.77")
DEFAULT_TCP_PORT  = int(os.getenv("BACKEND_TCP_PORT", "9331"))
DEFAULT_API_KEY   = os.getenv("API_KEY", "49c148a82e27e198e687bc1d68fcc674")

TOL = 1e-4          # float tolerance for lat/lon comparisons
POLL_TIMEOUT = 25   # seconds to wait for latest() to reflect ingest
POLL_INTERVAL = 0.5 # seconds
SSE_TIMEOUT = 8     # seconds to wait for at least one SSE event

# -------- Helpers --------
class TestRun:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.details = []

    def ok(self, name, note=""):
        self.passed += 1
        print(f"✅ {name} {('- ' + note) if note else ''}")

    def fail(self, name, note=""):
        self.failed += 1
        print(f"❌ {name} {('- ' + note) if note else ''}")
        self.details.append((name, note))

    def summary(self):
        print("\n==== TEST SUMMARY ====")
        print(f"Passed: {self.passed}  Failed: {self.failed}")
        if self.failed:
            print("\nFailures:")
            for n, note in self.details:
                print(f" - {n}: {note}")
        print("======================\n")
        return self.failed == 0

def tcp_send_lines(host, port, lines):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(10)
    s.connect((host, port))
    for line in lines:
        if not line.endswith("\n"):
            line += "\n"
        s.sendall(line.encode("utf-8"))
        # small gap so server's line buffer can slice cleanly
        time.sleep(0.05)
    s.close()

def get_json(base, path, params=None):
    r = requests.get(base + path, params=params, timeout=10)
    r.raise_for_status()
    return r.json()

def post_json(base, path, body, api_key=""):
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["x-api-key"] = api_key
    r = requests.post(base + path, json=body, headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()

def nearly_equal(a, b, tol=TOL):
    try:
        return abs(float(a) - float(b)) <= tol
    except Exception:
        return False

def wait_for_latest(base, device_id, expect_lt, expect_ln, timeout=POLL_TIMEOUT):
    """Poll /api/telemetry/latest?deviceId=... until lat/lon match expected."""
    t0 = time.time()
    last = None
    while time.time() - t0 < timeout:
        try:
            data = get_json(base, "/api/telemetry/latest", {"deviceId": device_id})
            last = data.get("latest")
            if last and nearly_equal(last.get("lt"), expect_lt) and nearly_equal(last.get("ln"), expect_ln):
                return last
        except Exception:
            pass
        time.sleep(POLL_INTERVAL)
    return last

def sse_read_latest(base, timeout=SSE_TIMEOUT):
    """Connect to /api/stream/latest and return first parsed 'latest' event payload."""
    url = base + "/api/stream/latest"
    with requests.get(url, stream=True, timeout=timeout) as r:
        r.raise_for_status()
        buf = ""
        start = time.time()
        for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
            if chunk is None:
                if time.time() - start > timeout:
                    break
                continue
            buf += chunk
            # SSE frames end with \n\n; parse minimally
            while "\n\n" in buf:
                frame, buf = buf.split("\n\n", 1)
                evt, data = None, None
                for line in frame.splitlines():
                    if line.startswith("event:"):
                        evt = line[len("event:"):].strip()
                    elif line.startswith("data:"):
                        data = line[len("data:"):].strip()
                if evt == "latest" and data:
                    try:
                        return json.loads(data)
                    except Exception:
                        return None
            if time.time() - start > timeout:
                break
    return None

# -------- Main E2E --------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--http-base", default=DEFAULT_HTTP_BASE)
    ap.add_argument("--tcp-host",  default=DEFAULT_TCP_HOST)
    ap.add_argument("--tcp-port",  type=int, default=DEFAULT_TCP_PORT)
    ap.add_argument("--api-key",   default=DEFAULT_API_KEY, help="Admin API key (optional)")
    args = ap.parse_args()

    run = TestRun()

    base = args.http_base.rstrip("/")
    tcp_host = args.tcp_host
    tcp_port = args.tcp_port
    api_key  = args.api_key

    # IDs for this run
    dev_id = f"TEST-{uuid.uuid4().hex[:8]}"
    veh_id = f"VEH-{uuid.uuid4().hex[:6]}"

    # 1) Health
    try:
        health = get_json(base, "/api/health")
        if health.get("ok"):
            run.ok("Health check", f"rt={health.get('rtMs','?')}ms")
        else:
            run.fail("Health check", "ok=false")
    except Exception as e:
        run.fail("Health check", str(e))

    # 2) Register device (optional)
    if api_key:
        try:
            resp = post_json(base, "/api/devices", {"id": dev_id, "vehicleId": veh_id}, api_key=api_key)
            if resp.get("ok"):
                run.ok("Register device", f"{dev_id} -> {veh_id}")
            else:
                run.fail("Register device", str(resp))
        except Exception as e:
            run.fail("Register device", str(e))
    else:
        print("ℹ️  No API_KEY provided; will rely on ingest to create /devices on first message.")

    # 3) Send 3 telemetry lines via TCP ingest
    points = [
        {"Id": dev_id, "vId": veh_id, "lt": -17.820000, "ln": 31.050000, "s": 10.5, "h": 45.0},
        {"Id": dev_id, "vId": veh_id, "lt": -17.821234, "ln": 31.051111, "s": 22.3, "h": 90.0},
        {"Id": dev_id, "vId": veh_id, "lt": -17.822222, "ln": 31.052222, "s": 33.0, "h": 135.0},
    ]
    try:
        tcp_send_lines(tcp_host, tcp_port, [json.dumps(p) for p in points])
        run.ok("TCP ingest send", f"{len(points)} lines to {tcp_host}:{tcp_port}")
    except Exception as e:
        run.fail("TCP ingest send", str(e))

    # 4) Verify latest matches the last point
    last_pt = points[-1]
    latest = wait_for_latest(base, dev_id, last_pt["lt"], last_pt["ln"])
    if latest and nearly_equal(latest.get("lt"), last_pt["lt"]) and nearly_equal(latest.get("ln"), last_pt["ln"]):
        if "ts" in latest and "ip" in latest:
            run.ok("Latest reflects last TCP message", f"ts={latest.get('ts')}")
        else:
            run.fail("Latest includes ts & ip", f"latest keys: {list(latest.keys())}")
    else:
        run.fail("Latest reflects last TCP message", f"latest={latest}")

    # 5) /api/devices/:id returns device + latest
    try:
        data = get_json(base, f"/api/devices/{quote(dev_id)}")
        if data.get("device") and data.get("latest"):
            run.ok("GET /api/devices/:id", "")
        else:
            run.fail("GET /api/devices/:id", str(data))
    except Exception as e:
        run.fail("GET /api/devices/:id", str(e))

    # 6) /api/vehicles includes our device mapping (by vehicleId)
    try:
        data = get_json(base, "/api/vehicles")
        items = data.get("items", [])
        match = [it for it in items if it.get("vehicleId") == veh_id]
        if match:
            run.ok("GET /api/vehicles", f"found vehicleId={veh_id}")
        else:
            run.fail("GET /api/vehicles", f"vehicleId {veh_id} not found")
    except Exception as e:
        run.fail("GET /api/vehicles", str(e))

    # 7) Track by device and by vehicle (window: now-5m..now+1m)
    now = int(time.time() * 1000)
    frm = now - 5*60*1000
    to  = now + 60*1000
    try:
        data = get_json(base, f"/api/devices/{quote(dev_id)}/track", {"from": frm, "to": to})
        pts = data.get("points", [])
        if len(pts) >= 1:
            run.ok("GET /api/devices/:id/track", f"{len(pts)} points")
        else:
            run.fail("GET /api/devices/:id/track", "no points returned")
    except Exception as e:
        run.fail("GET /api/devices/:id/track", str(e))

    try:
        data = get_json(base, f"/api/vehicles/{quote(veh_id)}/track", {"from": frm, "to": to})
        pts = data.get("points", [])
        if len(pts) >= 1:
            run.ok("GET /api/vehicles/:vehicleId/track", f"{len(pts)} points")
        else:
            run.fail("GET /api/vehicles/:vehicleId/track", "no points returned")
    except Exception as e:
        run.fail("GET /api/vehicles/:vehicleId/track", str(e))

    # 8) SSE stream sanity
    try:
        sse_payload = sse_read_latest(base, timeout=SSE_TIMEOUT)
        if isinstance(sse_payload, dict):
            run.ok("SSE /api/stream/latest", f"keys={len(sse_payload.keys())}")
        else:
            run.fail("SSE /api/stream/latest", "no/invalid event received")
    except Exception as e:
        run.fail("SSE /api/stream/latest", str(e))

    # 9) Clamp test: send invalid lat/lon; expect clamped in latest
    bad = {"Id": dev_id, "vId": veh_id, "lt": 200.0, "ln": -500.0, "s": 0.0, "h": 0.0}
    try:
        tcp_send_lines(tcp_host, tcp_port, [json.dumps(bad)])
        latest2 = wait_for_latest(base, dev_id, 90.0, -180.0)  # clamped target
        if latest2 and nearly_equal(latest2.get("lt"), 90.0) and nearly_equal(latest2.get("ln"), -180.0):
            run.ok("Clamping lat/lon", "applied correctly")
        else:
            run.fail("Clamping lat/lon", f"latest={latest2}")
    except Exception as e:
        run.fail("Clamping lat/lon", str(e))

    # Done
    ok = run.summary()
    exit(0 if ok else 1)

if __name__ == "__main__":
    main()
