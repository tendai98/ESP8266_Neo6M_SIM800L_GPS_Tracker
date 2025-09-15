import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import routes from './routes.js';
import sse from './sse.js';
import { cfg } from '../config.js';

function makeCors() {
  const allowAll = cfg.corsOrigins === '*';
  return cors({
    origin: (origin, cb) => {
      if (allowAll) return cb(null, true);
      if (!origin) return cb(null, true); // same-origin/curl
      if (cfg.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS: origin not allowed'), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
    credentials: false,
    maxAge: 86400
  });
}

export function startHttpServer() {
  const app = express();
  app.disable('x-powered-by');

  const corsMw = makeCors();
  app.use(corsMw);
  app.options('*', corsMw); // preflight

  app.use(morgan('dev'));

  app.get('/', (req, res) => res.json({ service: 'tracker-backend', tcp: `${cfg.tcpHost}:${cfg.tcpPort}` }));
  app.use('/api', routes);
  app.use('/api', sse);

  app.use((req, res) => res.status(404).json({ error: 'not found' }));

  const server = app.listen(cfg.httpPort, cfg.httpHost, () => {
    console.log(`[HTTP] Listen ${cfg.httpHost}:${cfg.httpPort}`);
  });

  return server;
}
