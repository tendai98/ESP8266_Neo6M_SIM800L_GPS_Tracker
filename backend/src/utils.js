export function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

export function dateKeyUTC(ts){
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth()+1).padStart(2,'0');
  const dd   = String(d.getUTCDate()).padStart(2,'0');
  return `${yyyy}${mm}${dd}`;
}

export function daysBetweenUTC(fromMs, toMs){
  const days = [];
  let d = new Date(new Date(fromMs).toISOString().slice(0,10));
  const endD = new Date(new Date(toMs).toISOString().slice(0,10));
  while (d <= endD) {
    days.push(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`);
    d.setUTCDate(d.getUTCDate()+1);
  }
  return days;
}

export function isValidMsg(m){
  return m && typeof m==='object'
    && typeof m.Id==='string'
    && typeof m.vId==='string'
    && typeof m.lt==='number'
    && typeof m.ln==='number'
    && typeof m.s==='number'
    && typeof m.h==='number';
}
