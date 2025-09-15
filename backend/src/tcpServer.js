import net from 'net';
import { cfg } from './config.js';
import { isValidMsg } from './utils.js';
import { persistTelemetry } from './persist.js';

export function startTcpServer() {
  const server = net.createServer(sock => {
    sock.setEncoding('utf8');
    sock.setTimeout(cfg.socketIdleMs);
    const ip = sock.remoteAddress;
    let buf = '';
    // simple per-connection rate limiting
    let bucketStart = Date.now();
    let count = 0;

    sock.on('data', async chunk => {
      buf += chunk;
      // basic memory cap
      if (buf.length > 4 * cfg.maxLineBytes) buf = buf.slice(-4 * cfg.maxLineBytes);

      // refill token bucket
      const now = Date.now();
      if (now - bucketStart >= cfg.rateBucketMs) {
        bucketStart = now; count = 0;
      }

      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
        line = line.trim();
        if (!line) continue;
        if (line.length > cfg.maxLineBytes) continue;

        if (count >= cfg.rateLimitPerBucket) {
          // drop silently under pressure
          continue;
        }
        count++;

        try {
          const msg = JSON.parse(line);
          if (!isValidMsg(msg)) continue;
          await persistTelemetry(msg, ip);
          // Optional ACK (device ignores): sock.write('OK\n');
        } catch(_){ /* ignore malformed */ }
      }
    });

    sock.on('timeout', () => { try { sock.destroy(); } catch(_){ } });
    sock.on('error', () => {});
  });

  server.listen(cfg.tcpPort, cfg.tcpHost, () => {
    console.log(`[TCP] Listen ${cfg.tcpHost}:${cfg.tcpPort}`);
  });

  return server;
}
