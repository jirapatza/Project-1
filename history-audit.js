// Read-only quality checks for descriptive historical records only.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TOP3 = /^\d{3}$/;
const BOTTOM2 = /^\d{2}$/;
const FINAL = new Set(['complete', 'completed', 'published', 'success', 'final']);
function dateIsReal(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
/** Evaluate already-published rows without modifying the source. */
export function auditHistoricalRows(rows, catalog, asOf) {
  if (!Array.isArray(rows) || !Array.isArray(catalog) || !dateIsReal(asOf)) {
    throw new TypeError('Expected rows, catalog arrays and valid asOf date');
  }
  const known = new Set(catalog.map(x => x?.id).filter(x => typeof x === 'string' && x));
  const buckets = new Map();
  const rejected = [];
  for (const [index, row] of rows.entries()) {
    let reason = null;
    const id = row?.หวย, date = row?.วันที่จัดรูปแบบ;
    const top3 = row?.เลขบน_3_ตัว, bottom2 = row?.เลขล่าง_2_ตัว;
    const state = row?.status ?? row?.สถานะผล ?? null;
    if (typeof id !== 'string' || !known.has(id)) reason = 'unknown_lottery';
    else if (!dateIsReal(date)) reason = 'invalid_date';
    else if (date > asOf) reason = 'future_date';
    else if (state != null && (typeof state !== 'string' || !FINAL.has(state.toLowerCase()))) reason = 'unconfirmed';
    else if (typeof top3 !== 'string' || !TOP3.test(top3) || typeof bottom2 !== 'string' || !BOTTOM2.test(bottom2)) reason = 'invalid_digits';
    if (reason) { rejected.push({ index, reason }); continue; }
    const key = JSON.stringify([id, date]);
    const normalized = { id, date, top3, bottom2, source: typeof row.แหล่งข้อมูล === 'string' ? row.แหล่งข้อมูล : '' };
    const bucket = buckets.get(key) ?? [];
    bucket.push({ index, normalized });
    buckets.set(key, bucket);
  }
  const accepted = [];
  for (const entries of buckets.values()) {
    const values = new Set(entries.map(({normalized}) => `${normalized.top3}/${normalized.bottom2}`));
    if (values.size > 1) {
      for (const {index} of entries) rejected.push({ index, reason: 'conflicting_draw' });
      continue;
    }
    accepted.push(entries[0].normalized);
    for (const {index} of entries.slice(1)) rejected.push({ index, reason: 'duplicate_draw' });
  }
  return {
    accepted: accepted.sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    rejected: rejected.sort((a,b) => a.index-b.index)
  };
}
