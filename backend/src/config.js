import 'dotenv/config';

function parseOrigins(v) {
  if (!v || v.trim() === '*') return '*';
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

export const cfg = {
  fbDbUrl: process.env.FB_DB_URL,
  tcpHost: process.env.TCP_HOST || '0.0.0.0',
  tcpPort: Number(process.env.TCP_PORT || 9331),
  httpHost: process.env.HTTP_HOST || '0.0.0.0',
  httpPort: Number(process.env.HTTP_PORT || 8080),
  apiKey: process.env.API_KEY || '',
  retentionDays: Number(process.env.RETENTION_DAYS || 0),

  // CORS
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS || '*'),

  // ingest safety
  maxLineBytes: 1024,
  socketIdleMs: 90_000,
  rateBucketMs: 10_000,
  rateLimitPerBucket: 120
};
