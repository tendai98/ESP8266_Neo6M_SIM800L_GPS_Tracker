import express from 'express';
import { db } from '../firebase.js';
import { cfg } from '../config.js';

const sse = express.Router();

sse.get('/stream/latest', (req, res) => {
  // Decide allowed origin for this request
  let allowOrigin = '*';
  if (cfg.corsOrigins !== '*') {
    const reqOrigin = req.headers.origin;
    if (reqOrigin && cfg.corsOrigins.includes(reqOrigin)) allowOrigin = reqOrigin;
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin'
  });
  res.flushHeaders();

  const ref = db.ref('/latest');

  const onVal = (snap) => {
    const data = JSON.stringify(snap.val() || {});
    res.write(`event: latest\ndata: ${data}\n\n`);
  };

  ref.on('value', onVal, (err) => {
    res.write(`event: error\ndata: "${String(err)}"\n\n`);
  });

  req.on('close', () => {
    try { ref.off('value', onVal); } catch (_) {}
  });
});

export default sse;
