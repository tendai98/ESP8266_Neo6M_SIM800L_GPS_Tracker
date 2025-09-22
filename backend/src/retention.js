import { db } from './firebase.js'
import { cfg } from './config.js'

function daysAgoStart(days) {
  const d = new Date()
  d.setUTCHours(0,0,0,0)
  d.setUTCDate(d.getUTCDate() - days)
  return d
}
function ymd(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth()+1).padStart(2,'0')
  const dd = String(d.getUTCDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
}
async function pruneOnce() {
  const keepDays = Number(cfg.retentionDays || 0)
  if (!keepDays || keepDays <= 0) {
    console.log('[retention] retentionDays=0, nothing to prune')
    return
  }
  const cutoffKey = ymd(daysAgoStart(keepDays))
  console.log(`[retention] keeping >= ${cutoffKey}, removing older`)
  const snap = await db.ref('/telemetry').get()
  if (!snap.exists()) { console.log('[retention] /telemetry empty'); return }
  const days = Object.keys(snap.val()).sort()
  let removed = 0, kept = 0
  for (const dayKey of days) {
    if (dayKey < cutoffKey) {
      try { await db.ref(`/telemetry/${dayKey}`).remove(); removed++; console.log(`[retention] removed ${dayKey}`) }
      catch (e) { console.error(`[retention] failed ${dayKey}:`, e) }
    } else { kept++ }
  }
  console.log(`[retention] done: removed=${removed} kept=${kept}`)
}

const argOnce = process.argv.includes('--once')
const intervalMs = Number(process.env.RETENTION_INTERVAL_MS || 6*60*60*1000)

if (argOnce) {
  pruneOnce().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})
} else {
  console.log(`[retention] daemon every ${Math.round(intervalMs/3600000)}h`)
  ;(async () => {
    try { await pruneOnce() } catch (e) { console.error(e) }
    setInterval(() => { pruneOnce().catch(e=>console.error(e)) }, intervalMs)
  })()
}

