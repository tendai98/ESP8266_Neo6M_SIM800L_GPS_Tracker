import { db, adminSDK } from './firebase.js';
import { clamp, dateKeyUTC } from './utils.js';

// Writes to /devices, /latest, /telemetry in a single multi-location update
export async function persistTelemetry(msg, ip, ts = Date.now()) {
  const safe = {
    Id: msg.Id,
    vId: msg.vId,
    lt: clamp(msg.lt, -90, 90),
    ln: clamp(msg.ln, -180, 180),
    s: Number.isFinite(msg.s) ? msg.s : 0,
    h: Number.isFinite(msg.h) ? msg.h : 0,
  };

  const day = dateKeyUTC(ts);
  const latestPath = `/latest/${safe.Id}`;
  const devicePath = `/devices/${safe.Id}`;
  const telemPath  = `/telemetry/${safe.Id}/${day}/${ts}`;

  const updates = {};
  updates[latestPath] = { ...safe, ts, ip };
  updates[telemPath]  = { vId: safe.vId, lt: safe.lt, ln: safe.ln, s: safe.s, h: safe.h, ts };
  updates[devicePath] = { vehicleId: safe.vId, lastSeenTs: ts, ip };

  await db.ref().update(updates);
}

// Read helpers used by API
export async function getDevices() {
  const snap = await db.ref('/devices').get();
  return snap.exists() ? snap.val() : {};
}

export async function getLatest(id) {
  const snap = await db.ref(`/latest/${id}`).get();
  return snap.exists() ? snap.val() : null;
}

export async function setDevice(id, vehicleId) {
  const ts = Date.now();
  await db.ref(`/devices/${id}`).update({ vehicleId, lastSeenTs: adminSDK.database.ServerValue.TIMESTAMP });
  // Optional: seed latest if missing
  const latest = await db.ref(`/latest/${id}`).get();
  if (!latest.exists()) {
    await db.ref(`/latest/${id}`).set({ vId: vehicleId, lt: 0, ln: 0, s: 0, h: 0, ts, ip: '' });
  }
}

export async function getTelemetryRangeByDevice(id, fromTs, toTs) {
  const days = [];
  let start = new Date(new Date(fromTs).toISOString().slice(0,10));
  let end   = new Date(new Date(toTs).toISOString().slice(0,10));
  while (start <= end) {
    days.push(`${start.getUTCFullYear()}${String(start.getUTCMonth()+1).padStart(2,'0')}${String(start.getUTCDate()).padStart(2,'0')}`);
    start.setUTCDate(start.getUTCDate()+1);
  }
  const out = [];
  for (const day of days) {
    const ref = db.ref(`/telemetry/${id}/${day}`);
    const snap = await ref.orderByKey().startAt(String(fromTs)).endAt(String(toTs)).get();
    if (snap.exists()) {
      const val = snap.val();
      for (const k of Object.keys(val)) {
        out.push({ ts: Number(k), ...val[k] });
      }
    }
  }
  out.sort((a,b)=>a.ts-b.ts);
  return out;
}
