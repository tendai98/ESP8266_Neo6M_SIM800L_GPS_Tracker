import 'dotenv/config';
import { db } from '../firebase.js';
import { cfg } from '../config.js';

function dayKeyToDate(dayKey){ // "YYYYMMDD" -> Date UTC (midnight)
  const y = Number(dayKey.slice(0,4));
  const m = Number(dayKey.slice(4,6)) - 1;
  const d = Number(dayKey.slice(6,8));
  const dt = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  return dt;
}

(async () => {
  if (!cfg.retentionDays || cfg.retentionDays <= 0) {
    console.log('Retention disabled (RETENTION_DAYS not set).');
    process.exit(0);
  }

  const cutoff = new Date(Date.now() - cfg.retentionDays * 24*3600*1000);
  console.log(`Pruning telemetry older than ${cutoff.toISOString().slice(0,10)} (RETENTION_DAYS=${cfg.retentionDays})`);

  const telemSnap = await db.ref('/telemetry').get();
  if (!telemSnap.exists()) {
    console.log('No telemetry tree found.');
    process.exit(0);
  }

  const telem = telemSnap.val();
  let deletedDays = 0;

  for (const devId of Object.keys(telem)) {
    const devDaysSnap = await db.ref(`/telemetry/${devId}`).get();
    if (!devDaysSnap.exists()) continue;
    const dayNodes = devDaysSnap.val();
    for (const dayKey of Object.keys(dayNodes)) {
      const dayDate = dayKeyToDate(dayKey);
      if (dayDate < cutoff) {
        console.log(`Deleting /telemetry/${devId}/${dayKey}`);
        await db.ref(`/telemetry/${devId}/${dayKey}`).remove();
        deletedDays++;
      }
    }
  }

  console.log(`Done. Deleted day-nodes: ${deletedDays}`);
  process.exit(0);
})();
