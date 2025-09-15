import express from 'express';
import { cfg } from '../config.js';
import { db } from '../firebase.js';
import { getDevices, getLatest, setDevice, getTelemetryRangeByDevice } from '../persist.js';

const router = express.Router();

// simple admin auth for mutating endpoints
function requireApiKey(req, res, next) {
  if (!cfg.apiKey) return res.status(403).json({ error: 'API key not configured' });
  const key = req.get('x-api-key') || req.query.key;
  if (key !== cfg.apiKey) return res.status(401).json({ error: 'invalid api key' });
  next();
}

// Vehicles list
router.get('/vehicles', async (req, res) => {
  const devs = await getDevices();
  const items = Object.entries(devs).map(([id, v]) => ({
    id,
    vehicleId: v.vehicleId || '',
    lastSeenTs: v.lastSeenTs || 0,
    ip: v.ip || ''
  }));
  res.json({ items });
});

// Register / map a device (admin)
router.post('/devices', requireApiKey, express.json(), async (req, res) => {
  const { id, vehicleId } = req.body || {};
  if (!id || !vehicleId) return res.status(400).json({ error: 'id and vehicleId required' });
  await setDevice(id, vehicleId);
  res.json({ ok: true });
});

// Device detail
router.get('/devices/:id', async (req, res) => {
  const id = req.params.id;
  const devSnap = await db.ref(`/devices/${id}`).get();
  const device = devSnap.exists() ? devSnap.val() : null;
  const latest = await getLatest(id);
  res.json({ device, latest });
});

// Latest by deviceId or vehicleId
router.get('/telemetry/latest', async (req, res) => {
  const { deviceId, vehicleId } = req.query;
  let id = deviceId;
  if (!id && vehicleId) {
    const snap = await db.ref('/devices').get();
    const devs = snap.exists() ? snap.val() : {};
    const match = Object.entries(devs).find(([, v]) => v.vehicleId === vehicleId);
    if (match) id = match[0];
  }
  if (!id) return res.status(400).json({ error: 'deviceId or vehicleId required' });
  const latest = await getLatest(id);
  res.json({ latest });
});

// Track by vehicle
router.get('/vehicles/:vehicleId/track', async (req, res) => {
  const vehicleId = req.params.vehicleId;
  const fromTs = Number(req.query.from) || (Date.now() - 3600_000);
  const toTs = Number(req.query.to) || Date.now();

  const allDevsSnap = await db.ref('/devices').get();
  const all = allDevsSnap.exists() ? allDevsSnap.val() : {};
  const deviceIds = Object.entries(all).filter(([, v]) => v.vehicleId === vehicleId).map(([id]) => id);
  if (deviceIds.length === 0) return res.json({ points: [] });

  const points = await getTelemetryRangeByDevice(deviceIds[0], fromTs, toTs);
  res.json({ points });
});

// Track by device
router.get('/devices/:id/track', async (req, res) => {
  const id = req.params.id;
  const fromTs = Number(req.query.from) || (Date.now() - 3600_000);
  const toTs = Number(req.query.to) || Date.now();
  const points = await getTelemetryRangeByDevice(id, fromTs, toTs);
  res.json({ points });
});

// Health (simple numeric write/read)
router.get('/health', async (req, res) => {
  try {
    const t0 = Date.now();
    const ref = db.ref('/__health__/ping');
    await ref.set({ t: Date.now() });
    const snap = await ref.get();
    const ok = snap.exists() && typeof snap.val()?.t === 'number';
    res.json({ ok, rtMs: Date.now() - t0, now: Date.now() });
  } catch (e) {
    console.error('[health] error:', e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

export default router;
