// Adapted from the separate -1 project. These are experiments, not verified predictions.
export const formulaOptions = [
  { id: 'weekday', name: 'กำลังวันมหาทักษา (ไม่ใช้ผลย้อนหลัง)' },
  { id: 'sum', name: 'ผลรวมร้อยสิบหน่วย' },
  { id: 'frequency', name: 'ความถี่เลขเด่นจากผลย้อนหลัง' },
  { id: 'matrix', name: 'จับคู่เมทริกซ์จากสูตรผลรวม' },
];

const weekdayDigits = [
  [[1, 8], [4, 7], ['18', '14', '17', '84', '87']],
  [[2, 9], [5, 7], ['29', '25', '27', '95', '97']],
  [[3, 8], [0, 5], ['38', '30', '35', '80', '85']],
  [[4, 2], [8, 6], ['42', '48', '46', '28', '26']],
  [[5, 4], [7, 1], ['54', '57', '51', '47', '41']],
  [[6, 3], [9, 2], ['63', '69', '62', '39', '32']],
  [[7, 0], [8, 3], ['70', '78', '73', '08', '03']],
];
const validTop = value => typeof value === 'string' && /^\d{3}$/.test(value);
const validBottom = value => typeof value === 'string' && /^\d{2}$/.test(value);

export function validDrawDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

// Preserve a conflicting date as a barrier instead of silently skipping it.
export function resolveFormulaDraws(rows) {
  const byDate = new Map();
  for (const row of rows) {
    if (!validDrawDate(row.date)) continue;
    const existing = byDate.get(row.date);
    if (!existing) byDate.set(row.date, { date: row.date, top3: row.top3, bottom2: row.bottom2 });
    else if (existing.conflict || existing.top3 !== row.top3 || existing.bottom2 !== row.bottom2) {
      byDate.set(row.date, { date: row.date, conflict: true });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateFormula(id, date, history) {
  if (!validDrawDate(date)) return { error: 'กรุณาเลือกวันงวดที่ถูกต้อง' };
  if (!formulaOptions.some(item => item.id === id)) return { error: 'ไม่พบสูตรที่เลือก' };
  const day = weekdayDigits[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const prior = history.filter(row => validDrawDate(row.date) && row.date < date)
    .sort((a, b) => b.date.localeCompare(a.date));
  let primary, secondary, pairs, latestDraw = null, usedDraws = 0;
  if (id === 'weekday') {
    [primary, secondary, pairs] = day;
  } else if (id === 'frequency') {
    const recent = prior.slice(0, 10);
    if (recent.some(row => row.conflict)) return { error: 'ผลย้อนหลังมีข้อมูลขัดกันใน 10 งวดล่าสุด' };
    const usable = recent.filter(row => validTop(row.top3) && validBottom(row.bottom2));
    if (!usable.length) return { error: 'สูตรนี้ต้องมีผล 3 ตัวบนและ 2 ตัวล่างย้อนหลังอย่างน้อย 1 งวด' };
    usedDraws = usable.length;
    latestDraw = usable[0].date;
    const counts = Array(10).fill(0);
    for (const row of usable) for (const digit of row.top3 + row.bottom2) counts[Number(digit)]++;
    const ranked = counts.map((count, digit) => ({ digit, count })).filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count || a.digit - b.digit);
    if (ranked.length < 4) return { error: 'ข้อมูลความถี่ยังมีเลขที่พบไม่ครบ 4 หลัก' };
    primary = ranked.slice(0, 2).map(item => item.digit);
    secondary = ranked.slice(2, 4).map(item => item.digit);
  } else {
    const row = prior[0];
    if (!row || row.conflict || !validTop(row.top3) || !validBottom(row.bottom2)) {
      return { error: 'สูตรนี้ต้องมีผล 3 ตัวบนและ 2 ตัวล่างของงวดก่อนหน้า' };
    }
    const base = (Number(row.top3[0]) + Number(row.top3[1]) + Number(row.bottom2[0]) + 5) % 10;
    usedDraws = 1;
    latestDraw = row.date;
    primary = [base, (base + 5) % 10];
    secondary = [(base + 1) % 10, (base + 9) % 10];
  }
  if (id === 'matrix') {
    const combined = [];
    for (const p of primary) for (const d of [...day[0], ...day[1]]) {
      if (p !== d) combined.push(`${p}${d}`, `${d}${p}`);
    }
    pairs = [...new Set(combined)].slice(0, 6);
  } else if (!pairs) {
    const combined = [];
    for (const p of primary) {
      for (const s of secondary) combined.push(`${p}${s}`, `${s}${p}`);
      for (const d of day[0]) if (p !== d) combined.push(`${p}${d}`);
    }
    pairs = [...new Set(combined)].slice(0, 6);
  }
  const [p0, p1] = primary, [s0, s1] = secondary;
  const triples = [...new Set([`${p0}${p1}${s0}`, `${p0}${s0}${s1}`, `${p1}${s0}${s1}`, `${day[0][0]}${p0}${p1}`])];
  return { primary, secondary, pairs, triples, usedDraws, latestDraw };
}

export function backtestFormula(id, history, limit = 10) {
  const rows = [...history].filter(row => validDrawDate(row.date)).sort((a, b) => a.date.localeCompare(b.date));
  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.conflict || (!validBottom(row.bottom2) && !validTop(row.top3))) continue;
    const prediction = calculateFormula(id, row.date, rows.slice(0, i));
    if (prediction.error) continue;
    results.push({ date: row.date, bottom2: validBottom(row.bottom2) ? row.bottom2 : null,
      top3: validTop(row.top3) ? row.top3 : null, prediction,
      pairHit: validBottom(row.bottom2) ? prediction.pairs.includes(row.bottom2) : null,
      tripleHit: validTop(row.top3) ? prediction.triples.includes(row.top3) : null });
  }
  return results.slice(-limit).reverse();
}
