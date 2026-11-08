import { dateKey } from './public/history-records.js';

const catalogFields = ['id', 'name', 'category', 'categoryLabel', 'period', 'periodLabel',
  'flag', 'drawTimeStr', 'closeTimeStr', 'drawDays'];
const historyFields = ['ชื่อหวย', 'หวย', 'งวดวันที่', 'วันที่จัดรูปแบบ', 'draw_date',
  'เลขบน_3_ตัว', 'เลขล่าง_2_ตัว', 'เลขท้าย_2_ตัว', 'แหล่งข้อมูล', 'status', 'สถานะผล'];

const top3 = /^\d{3}$/;
const bottom2 = /^\d{2}$/;
const matches = (value, pattern) => typeof value === 'string' && pattern.test(value);

export function validateSnapshot(key, rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Empty or invalid snapshot');
  if (key === 'catalog') {
    const ids = new Set();
    for (const row of rows) {
      if (typeof row?.id !== 'string' || !row.id.trim() || ids.has(row.id) ||
          typeof row.name !== 'string' || !row.name.trim()) throw new Error('Invalid catalog');
      ids.add(row.id);
    }
  } else if (key === 'history') {
    if (!rows.some(row => dateKey(row) && (typeof row.หวย === 'string' || typeof row.ชื่อหวย === 'string') &&
      (matches(row.เลขบน_3_ตัว, top3) || matches(row.เลขล่าง_2_ตัว, bottom2) ||
        matches(row.เลขท้าย_2_ตัว, bottom2)))) throw new Error('No usable historical records');
  } else {
    throw new Error('Unknown snapshot');
  }
  return rows;
}

export function publicSnapshot(key, rows) {
  const fields = key === 'catalog' ? catalogFields : historyFields;
  return validateSnapshot(key, rows).map(row => Object.fromEntries(
    fields.filter(field => Object.hasOwn(row ?? {}, field)).map(field => [field, row[field]]),
  ));
}
