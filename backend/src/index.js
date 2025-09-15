import { startTcpServer } from './tcpServer.js';
import { startHttpServer } from './api/index.js';
import { cfg } from './config.js';

const tcp = startTcpServer();
const http = startHttpServer();

function shutdown(sig){
  console.log(`\n${sig} received, shutting down...`);
  try { tcp.close?.(); } catch(_){}
  try { http.close?.(); } catch(_){}
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
