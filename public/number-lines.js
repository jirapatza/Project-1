// Number-line generators inspired by popular Thai lottery "สูตร" presentations.
// These are deterministic transformations of one published draw, not predictions.
// Every line is scored against a uniform-random baseline by the backtest below.

export const lineOptions = [
  { id: 'sibling', name: 'เลขพี่น้อง (กลับเลข + คู่ 90)' },
  { id: 'double', name: 'เลขเบิ้ล (สองหลักเหมือนกัน)' },
  { id: 'run19', name: 'รูด 19 ประตู (ทุกเลขที่มีเลขเด่น)' },
  { id: 'win', name: 'สายวิน (จับคู่ 2 ตัวแล้วกลับ)' },
  { id: 'pin', name: 'สายพิกัด (เลขเด่น 3 ตัวต่างกัน)' },
  { id: 'pluck', name: 'สายปัก (ปักหลักสิบหรือหลักหน่วย)' },
];

const TOP3 = /^\d{3}$/;
const BOTTOM2 = /^\d{2}$/;
const DIGIT = /^[0-9]$/;

export function validDrawDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function unique(values) {
  return [...new Set(values)];
}

// 00–99 that contain the digit, leading zero included: 19 numbers per digit.
export function run19(digit) {
  const text = String(digit ?? '');
  if (!DIGIT.test(text)) return [];
  const out = [];
  for (let n = 0; n <= 99; n++) {
    const pair = String(n).padStart(2, '0');
    if (pair.includes(text)) out.push(pair);
  }
  return out;
}

// Consecutive digits and the 90 pair produce both orderings.
export function siblingPairs(pair) {
  if (!BOTTOM2.test(pair || '')) return [];
  const [a, b] = [...pair];
  const consecutive = Math.abs(Number(a) - Number(b)) === 1 || pair === '90' || pair === '09';
  return consecutive ? unique([pair, `${b}${a}`]) : [];
}

export function doublePairs(pair) {
  if (!BOTTOM2.test(pair || '')) return [];
  return pair[0] === pair[1] ? [pair] : [];
}

export function winPairs(pair) {
  if (!BOTTOM2.test(pair || '')) return [];
  const [a, b] = [...pair];
  return a === b ? [pair] : unique([pair, `${b}${a}`]);
}

// Three distinct digits produce every two-digit ordering between them (6 numbers).
export function pinPairs(standout) {
  const digits = unique(String(standout ?? '').split('').filter(d => DIGIT.test(d)));
  if (digits.length !== 3) return [];
  const out = [];
  for (const a of digits) for (const b of digits) if (a !== b) out.push(`${a}${b}`);
  return unique(out);
}

// Pluck a fixed position: every two-digit number sharing that digit in that slot.
export function pluckNumbers(digit, position) {
  const text = String(digit ?? '');
  if (!DIGIT.test(text) || !['tens', 'units'].includes(position)) return [];
  const out = [];
  for (let n = 0; n <= 99; n++) {
    const pair = String(n).padStart(2, '0');
    if (pair[position === 'tens' ? 0 : 1] === text) out.push(pair);
  }
  return out;
}

export function lineCount(id) {
  return { sibling: 2, double: 1, run19: 19, win: 2, pin: 6, pluck: 10 }[id] ?? 0;
}

// Build one line from the latest published draw plus the player's picks.
export function buildLine(id, draw, picks = {}) {
  const option = lineOptions.find(item => item.id === id);
  if (!option) return { error: 'ไม่พบสายที่เลือก' };
  if (!draw || draw.conflict || typeof draw.top3 !== 'string' || typeof draw.bottom2 !== 'string' || !TOP3.test(draw.top3) || !BOTTOM2.test(draw.bottom2)) {
    return { error: 'ต้องมีผล 3 ตัวบนและ 2 ตัวล่างของงวดล่าสุดที่ไม่ขัดกัน' };
  }
  const base = { id, name: option.name, top3: draw.top3, bottom2: draw.bottom2, numbers: [], rule: '' };
  if (id === 'sibling') {
    const numbers = siblingPairs(draw.bottom2);
    if (!numbers.length) return { error: `เลขล่าง ${draw.bottom2} ไม่ใช่เลขพี่น้องและไม่ใช่คู่ 90` };
    return { ...base, numbers, rule: 'กลับเลขล่างเป็นสองทาง เมื่อเป็นเลขเรียงติดกันหรือคู่ 90' };
  }
  if (id === 'double') {
    const numbers = doublePairs(draw.bottom2);
    if (!numbers.length) return { error: `เลขล่าง ${draw.bottom2} ไม่ใช่เลขเบิ้ล` };
    return { ...base, numbers, rule: 'ใช้เลขล่างที่สองหลักเหมือนกันเท่านั้น' };
  }
  if (id === 'run19') {
    const digit = String(picks.digit ?? draw.top3.slice(-1));
    if (!DIGIT.test(digit)) return { error: 'กรุณาเลือกเลขเด่นหนึ่งหลัก' };
    return { ...base, numbers: run19(digit),
      rule: `รูดเลข ${digit} ทุกเลขที่มี ${digit} ในสองหลัก รวมเบิ้ล` };
  }
  if (id === 'win') {
    const pair = String(picks.pair ?? draw.top3.slice(-2));
    const numbers = winPairs(pair);
    if (!numbers.length) return { error: 'กรุณาใส่คู่สองหลักที่ถูกต้อง' };
    return { ...base, numbers, rule: 'จับคู่สองตัวแล้วกลับเลข' };
  }
  if (id === 'pin') {
    const numbers = pinPairs(picks.standout ?? draw.top3);
    if (!numbers.length) return { error: 'กรุณาใส่เลขเด่นสามตัวที่ต่างกัน' };
    return { ...base, numbers, rule: 'จับคู่ทุกแบบจากเลขเด่นสามตัว' };
  }
  const position = picks.position === 'units' ? 'units' : 'tens';
  const digit = String(picks.digit ?? draw.top3[0]);
  const numbers = pluckNumbers(digit, position);
  if (!numbers.length) return { error: 'กรุณาเลือกเลขเด่นหนึ่งหลักและตำแหน่งที่ปัก' };
  return { ...base, numbers,
    rule: `ปักหลัก${position === 'tens' ? 'สิบ' : 'หน่วย'}ด้วยเลข ${digit} ทุกสองหลัก` };
}

// Historical rows are newest first; the backtest needs oldest first.
export function resolveDraws(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter(row => row && !row.conflict && TOP3.test(row.top3 || '') && BOTTOM2.test(row.bottom2 || '')
      && validDrawDate(row.date))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Score one line against the uniform-random baseline: each two-digit number has
// the same chance, so the baseline hit rate is the line size divided by 100.
export function evaluateLine(line, rows) {
  const numbers = unique(line.numbers || []);
  if (!numbers.length) return { error: 'สายนี้ไม่มีตัวเลขให้ตรวจ' };
  const draws = resolveDraws(rows);
  if (!draws.length) return { error: 'ยังไม่มีผลย้อนหลังที่ใช้ตรวจได้' };
  const chance = numbers.length / 100;
  let hits = 0;
  const detail = [];
  for (const draw of draws) {
    const hit = numbers.includes(draw.bottom2);
    if (hit) hits += 1;
    detail.push({ date: draw.date, bottom2: draw.bottom2, hit });
  }
  const trials = draws.length;
  const expected = trials * chance;
  const sd = Math.sqrt(trials * chance * (1 - chance));
  const z = sd > 0 ? (hits - expected) / sd : 0;
  return {
    id: line.id, name: line.name, rule: line.rule, size: numbers.length,
    trials, hits, hitRate: hits / trials, baseline: chance, expected,
    lift: chance > 0 ? (hits / trials) / chance : 0, z,
    verdict: Math.abs(z) < 2 ? 'ต่างจากฐานสุ่มไม่ชัดเจน'
      : z >= 2 ? 'สูงกว่าฐานสุ่มแบบมีนัยสำคัญ' : 'ต่ำกว่าฐานสุ่มแบบมีนัยสำคัญ',
    detail,
  };
}

export function backtestLine(id, rows, picks, limit = 100) {
  const draws = resolveDraws(rows);
  if (draws.length < 2) return { error: 'ต้องมีผลย้อนหลังอย่างน้อยสองงวด' };
  const first = limit > 0 ? Math.max(1, draws.length - Math.floor(limit)) : 1;
  let trials = 0, hits = 0, totalSize = 0;
  for (let i = first; i < draws.length; i++) {
    const line = buildLine(id, draws[i - 1], picks);
    if (line.error) continue;
    trials++;
    totalSize += line.numbers.length;
    if (line.numbers.includes(draws[i].bottom2)) hits++;
  }
  if (!trials) return { error: 'ไม่มีงวดที่เข้าเงื่อนไขของสายนี้' };
  const size = totalSize / trials;
  const expected = totalSize / 100;
  return { trials, hits, size, baseline: size / 100, expected, hitRate: hits / trials,
    lift: hits / expected, skipped: draws.length - first - trials };
}
