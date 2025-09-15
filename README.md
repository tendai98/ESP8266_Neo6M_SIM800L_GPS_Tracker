# ESP8266 • SIM800L • NEO-6M GPS Tracker

Full stack project: low-power hardware tracker (ESP8266 NodeMCU + SIM800L + NEO-6M), a Node.js backend (TCP ingest + REST + SSE) that stores to **Firebase Realtime Database**, and a web frontend (reads backend only).

This README covers **hardware + firmware** and the **backend** (including HTTPS + CORS + API docs + tests). Frontend consumes the documented endpoints; it does **not** talk to Firebase directly.

---

## Contents

* [Hardware](#hardware)

  * [Bill of Materials](#bill-of-materials)
  * [Wiring](#wiring)
  * [Firmware layout](#firmware-layout)
  * [Build & flash](#build--flash)
  * [On-device JSON payload](#ondevice-json-payload)
  * [AT/GPRS flow (for manual test)](#atgprs-flow-for-manual-test)
  * [Hardware troubleshooting](#hardware-troubleshooting)
* [Backend](#backend)

  * [Prereqs](#prereqs)
  * [Project layout](#project-layout)
  * [Configure (file-based)](#configure-filebased)
  * [Run](#run)
  * [HTTPS (native) or behind proxy](#https-native-or-behind-proxy)
  * [CORS](#cors)
  * [RTDB rules (lockdown)](#rtdb-rules-lockdown)
  * [Data model](#data-model)
  * [TCP ingest](#tcp-ingest)
  * [REST API](#rest-api)
  * [SSE stream](#sse-stream)
  * [Testing (Python E2E)](#testing-python-e2e)
  * [Ops tips](#ops-tips)
* [Troubleshooting](#troubleshooting)

---

## Hardware

### Bill of Materials

* ESP8266 **NodeMCU (Amica/LoLin)** dev board
* **SIM800L** GSM/GPRS module (quad-band)
  Power: **3.4–4.4 V**, **2 A** peak burst current
* **NEO-6M** GPS module (3.3 V logic, typically powered by 3.3–5 V with onboard LDO)
* Power:

  * 4.0 V (or 4.2 V Li-ion) **buck** or LDO capable of **≥2A peak** for SIM800L
  * Bulk caps near SIM800L: **470–1000 µF** electrolytic + **100 nF** ceramic
* Antennas for GSM + GPS
* Level shifters not required (ESP8266 TX \~3.3V is safe for SIM800 RX; verify module)

### Wiring

**UART0 (hardware) → SIM800L**

> Shared with USB/Serial Monitor. Keep Serial prints minimal during modem operations.

* NodeMCU **TX0 (GPIO1)** → SIM800 **RX**
* NodeMCU **RX0 (GPIO3)** ← SIM800 **TX**
* GND ↔ GND
* 4.0 V ↔ SIM800 **VCC** (do **not** power from 5V or 3.3V pin on NodeMCU)

**SoftwareSerial → NEO-6M (GPS)** (as used in `gps.h` defaults)

* NodeMCU **D7 (GPIO13)** ← GPS **TX**
* NodeMCU **D8 (GPIO15)** → GPS **RX** (optional; rarely used)
* 3.3–5 V (per module) and GND

> Keep all grounds common. Keep SIM800 wiring short/thick. Add the big cap near SIM800.

### Firmware layout

Your firmware is organized as three files:

* `IOT_GPS_Tracker.ino` – app entry. Enables/disables GPS/Modem, debug modes, sends coordinates periodically.
* `modem.h` – **memory-friendly** SIM800 driver on UART0 with paced AT commands, retries, and raw TCP send (`sendAT`, `initModem`, `initGPRS`, `sendTcp`).
* `gps.h` – TinyGPSPlus on SoftwareSerial (D7/D8), with helpers to parse a fix and optionally stream raw NMEA.

Highlights:

* Uses short JSON keys to reduce bytes and heap churn:
  `{"Id","vId","lt","ln","s","h"}`.
* Minimizes `String` usage in the modem driver; uses fixed char buffers.
* Paces AT commands with delays and reads feedback before continuing (prevents early errors).
* Supports **debug modes**:

  * modem stream ping + URCs
  * GPS raw NMEA stream

### Build & flash

* **Arduino IDE / PlatformIO**
* **Board**: “NodeMCU 1.0 (ESP-12E Module)”
* **CPU Freq**: 80 MHz
* **Upload speed**: 921600 (or 115200 if flaky)
* **Libraries**: `TinyGPSPlus` (SoftwareSerial is in ESP8266 core)

**Set IDs in code** (example):

```cpp
// in modem code (or shared header)
#define DEVICE_ID   "AGR 9021"
#define VEHICLE_ID  "TRUCK-01"
```

Then build/flash.

### On-device JSON payload

One line per message (newline-delimited):

```json
{"Id":"AGR 9021","vId":"TRUCK-01","lt":-17.821234,"ln":31.051111,"s":22.3,"h":90.0}
```

* `Id` = Device ID (string)
* `vId` = Vehicle ID (string)
* `lt` = latitude (deg, WGS84)
* `ln` = longitude (deg, WGS84)
* `s`  = speed (km/h)
* `h`  = heading (deg 0–359)

### AT/GPRS flow (for manual test)

Send each, **wait** for the expected reply before next:

```
AT
ATE0
AT+CFUN=1
AT+IPR=9600
AT+CIPSPRT=1

AT+CIPSHUT           -> SHUT OK (STATE: IP INITIAL)
AT+CGATT=1           -> OK ; poll AT+CGATT? until +CGATT: 1
AT+CGDCONT=1,"IP","netone.net"
AT+CSTT="netone.net","",""
AT+CIICR              (can take several seconds) -> OK
AT+CIFSR             -> 10.x.x.x

AT+CIPSTATUS         -> STATE: IP STATUS
AT+CIPSTART="TCP","<IP>","<PORT>"  -> CONNECT OK
AT+CIPSEND
<your payload JSON + \n>
^Z (0x1A)            -> SEND OK
AT+CIPCLOSE
```

### Hardware troubleshooting

* **SIM800 reboots / CIICR fails** → power issue. Use proper 4.0–4.2 V rail, big caps.
* **CIPSTART fails** → re-run bring-up (CIPSHUT→CGATT→CGDCONT→CSTT→CIICR→CIFSR). Verify APN.
* **No GPS fix** → antenna, sky view, wait a few minutes cold start.
* **ESP resets** → too many `String`s or serial flooding; the provided modem code avoids this.

---

## Backend

### Prereqs

* Node.js **18.19+** (prefer **20+**)
* A Firebase project with **Realtime Database** enabled
* A **service account** JSON for that project

### Project layout

```
backend/
  src/
    api/
      index.js      # builds Express app, CORS, starts HTTP/HTTPS
      routes.js     # REST endpoints
      sse.js        # /api/stream/latest (Server-Sent Events)
    persist.js      # RTDB read/write helpers (telemetry, devices, latest)
    tcpServer.js    # TCP ingest (newline-JSON)
    firebase.js     # Admin SDK init (file-based config)
    config.js       # loads app.config.json
    index.js        # entrypoint (starts TCP + web server)
  app.config.json   # << your single source of config
  serviceAcc.json   # << your Firebase service account (keep private)
  package.json
  backend_e2e_test.py
```

### Configure (file-based)

Create/edit `app.config.json` (no env vars used):

```json
{
  "firebase": {
    "databaseURL": "https://<project-id>-default-rtdb.firebaseio.com",
    "serviceAccountPath": "./serviceAcc.json"
  },
  "tcp":  { "host": "0.0.0.0", "port": 9331 },
  "http": { "host": "0.0.0.0", "port": 8080 },

  "https": {
    "enabled": false,
    "host": "0.0.0.0",
    "port": 8443,
    "keyPath": "./certs/server.key",
    "certPath": "./certs/server.crt",
    "caPath": null,
    "redirectHttp": false
  },

  "cors": { "origins": ["http://localhost:5173", "http://127.0.0.1:5173"] },
  "security": { "apiKey": "changeme" },
  "retentionDays": 180
}
```

> If you inline the service account instead of a path, replace `serviceAccountPath` with `"serviceAccount": { ... }`.

### Run

```bash
cd backend
npm install
npm start
# HTTP listening, plus TCP 9331
```

### HTTPS (native) or behind proxy

**Native**: set `"https.enabled": true` in `app.config.json`, provide `keyPath` & `certPath` (PEM). Optionally set `"redirectHttp": true` to 301 HTTP→HTTPS.

**Recommended in prod**: put **Caddy/Nginx/Traefik** in front and let it terminate TLS, proxy to `http://127.0.0.1:8080`. SSE works out-of-the-box.

### CORS

Frontend origins are configured in `app.config.json → cors.origins`. Add exact origins (scheme + host + port). Use `"*"` only for development.

### RTDB rules (lockdown)

If your frontend only talks to **our backend**, you can lock RTDB completely:

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

Admin SDK in the backend bypasses rules, so everything still works. Deploy via Firebase console/CLI.

### Data model

```text
/devices/{deviceId}        -> { vehicleId, lastSeenTs, ip }
/latest/{deviceId}         -> { vId, lt, ln, s, h, ts, ip }
/telemetry/YYYY-MM-DD/{deviceId}/{pushKey}
                           -> { vId, lt, ln, s, h, ts, ip }
/__health__/ping           -> { t }
```

### TCP ingest

* Listens on `tcp.host:tcp.port` (default **0.0.0.0:9331**)
* Accepts **newline-delimited JSON** exactly like the device sends (see payload spec above)
* Each valid line:

  * clamps lt/ln to valid ranges,
  * writes `/telemetry/<day>/...`,
  * updates `/latest/<deviceId>`,
  * updates `/devices/<deviceId>` (vehicleId mapping, lastSeenTs, ip),
  * fans-out to SSE.

### REST API

All responses are JSON.

* `GET /api/health`
  → `{ "ok": true, "rtMs": 12, "now": 1757753440409 }`

* `GET /api/vehicles`
  → `{ "items": [{ "id": "AGR 9021", "vehicleId": "TRUCK-01", "lastSeenTs": 1757753440409, "ip": "1.2.3.4" }] }`

* `GET /api/devices/:id`
  → `{ "device": { "vehicleId": "TRUCK-01", "lastSeenTs": 1757753440409, "ip": "1.2.3.4" },
       "latest": { "vId": "TRUCK-01", "lt": -17.821234, "ln": 31.051111, "s": 22.3, "h": 90, "ts": 1757753440409, "ip": "1.2.3.4" } }`

* `GET /api/telemetry/latest?deviceId=...` **or** `?vehicleId=...`
  → `{ "latest": { ... } }`

* `GET /api/vehicles/:vehicleId/track?from=<ms>&to=<ms>`
  → `{ "points": [{ "vId": "...", "lt": -17.8, "ln": 31.05, "s": 12.3, "h": 45, "ts": 1757753000000 }] }`

* `GET /api/devices/:id/track?from=<ms>&to=<ms>`
  → same shape as above

* `POST /api/devices` (admin)
  Headers: `x-api-key: <app.config.json security.apiKey>`
  Body: `{ "id": "<Device ID>", "vehicleId": "<Vehicle ID>" }`
  → `{ "ok": true }`

### SSE stream

* `GET /api/stream/latest`
  Emits:

  ```
  event: latest
  data: { "<Id>": { "vId": "...", "lt": -17.8, "ln": 31.05, "s": 12.3, "h": 45, "ts": 1757753440409, "ip": "1.2.3.4" }, ... }
  ```
* CORS header is set per request origin (based on `cors.origins`).

### Testing (Python E2E)

A ready script hammers the full pipeline (TCP → RTDB → REST/SSE):

```bash
pip install requests
python backend_e2e_test.py \
  --http-base http://127.0.0.1:8080 \
  --tcp-host 127.0.0.1 --tcp-port 9331 \
  --api-key changeme
```

You should see ✅ for health, ingest, latest, tracks, SSE, and clamping.

### Ops tips

* Use **PM2** or systemd to daemonize the backend.
* Set `retentionDays` in config to prune old telemetry (recommended).
* Keep the **service account JSON** outside the repo if possible; restrict file perms.
* Prefer a reverse proxy (Caddy/Nginx) for TLS + compression in production.

---

## Troubleshooting

* **CORS “Missing Allow Origin”**
  Add your frontend origin(s) to `app.config.json → cors.origins`. Restart backend.

* **Firebase `app/invalid-credential` or `metadata.google.internal ENOTFOUND`**
  The backend is not using the intended service account. Ensure `serviceAccountPath` (or inline `serviceAccount`) in `app.config.json` points to a valid JSON for the same project. Confirm `firebase.databaseURL` is exact (usually `...-default-rtdb.firebaseio.com`).

* **`/api/health` 500**
  The backend writes a numeric timestamp; if it still fails, check console logs for `[health] error:`.

* **SSE not updating**
  Browser blocked by CORS (add origin), or a proxy buffering. We send `X-Accel-Buffering: no`; make sure your proxy honors streaming.

* **`AT+CIFSR` no IP**
  Power/APN/coverage. Re-run the bring-up sequence, verify APN string. Allow several seconds for `CIICR`.

* **`CIPSTART` fails**
  Ensure `STATE: IP STATUS` before `CIPSTART`. If `PDP DEACT`, rerun the GPRS bring-up. Add pacing (your modem code already does).

* **ESP8266 resets / watchdog**
  Avoid spam prints to UART0 during modem ops; keep yields/delays; keep Strings minimal (the provided `modem.h` uses fixed buffers and pacing).

---

### License / Notes

* Keep your **service account file** private. Do not commit it.
* If you clone this for other carriers, change APN and reconfirm the GPRS flow.
* Frontend must consume **only** the documented REST/SSE; RTDB is locked down.

Happy tracking 🚚🛰️📡
