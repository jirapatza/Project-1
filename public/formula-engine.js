// User-built formula trees. Experiments only: no prediction is verified.
// A tree is {operator, value?, left?, right?}. Evaluation is a whitelist walk, never `eval`.
export const POOL_SIZE = { 2: 100, 3: 1000 };
export const MAX_NODES = 32;
export const MAX_DEPTH = 8;
export const MAX_PREDICTIONS = 15;

export const leafOperators = [
  { id: 'CONSTANT', name: 'ตัวเลขคงที่', arity: 0 },
  { id: 'DATE_DAY', name: 'วันที่งวด', arity: 0 },
  { id: 'DATE_MONTH', name: 'เดือนงวด', arity: 0 },
  { id: 'DATE_YEAR', name: 'ปี (พ.ศ.) งวด', arity: 0 },
  { id: 'DATE_WEEKDAY', name: 'วันของงวด', arity: 0 },
  { id: 'BIRTH_DAY', name: 'วันเกิด', arity: 0 },
  { id: 'BIRTH_MONTH', name: 'เดือนเกิด', arity: 0 },
  { id: 'BIRTH_YEAR', name: 'ปีเกิด (พ.ศ.)', arity: 0 },
  { id: 'LAST_DIGIT', name: 'หลักหน่วยรางวัลบน', arity: 0 },
  { id: 'LAST_2_DIGITS', name: '2 หลักท้ายรางวัลบน', arity: 0 },
  { id: 'LAST_3_DIGITS', name: '3 หลักท้ายรางวัลบน', arity: 0 },
  { id: 'FIRST_DIGIT', name: 'หลักแรกรางวัลบน', arity: 0 },
  { id: 'FIRST_2_DIGITS', name: '2 หลักแรกรางวัลบน', arity: 0 },
  { id: 'FIRST_3_DIGITS', name: '3 หลักแรกรางวัลบน', arity: 0 },
  { id: 'SUM_DIGITS', name: 'ผลรวมทุกหลักรางวัลบน', arity: 0 },
  { id: 'MOD_10', name: 'เศษ 10 ของรางวัลบน', arity: 0 },
  { id: 'MOD_100', name: 'เศษ 100 ของรางวัลบน', arity: 0 },
];

export const binaryOperators = [
  { id: 'ADD', name: 'บวก', arity: 2 },
  { id: 'SUBTRACT', name: 'ลบ', arity: 2 },
  { id: 'MULTIPLY', name: 'คูณ', arity: 2 },
  { id: 'CONCAT', name: 'ต่อหลัก', arity: 2 },
];

export const operatorOptions = [...leafOperators, ...binaryOperators];
const operatorIds = new Map(operatorOptions.map(item => [item.id, item]));
const isBinary = id => binaryOperators.some(item => item.id === id);

export function validDrawDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function pad(value, length) {
  return digits(value).padStart(length, '0').slice(-length);
}

export function bangkokParts(isoDate, now = new Date()) {
  const date = validDrawDate(isoDate) ? new Date(`${isoDate}T12:00:00Z`) : now;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return {
    day: Number(get('day')),
    month: Number(get('month')),
    year: Number(get('year')) + 543,
    weekday: weekday < 0 ? 0 : weekday,
    isoDate: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

// The latest published draw is the only result a formula may read.
export function contextForDate(isoDate, latest = {}, profile = {}, now = new Date()) {
  const firstPrize = digits(latest.firstPrize ?? latest.top3);
  return {
    currentDate: bangkokParts(isoDate, now),
    profile: {
      birthDay: Number(profile.birthDay) || 1,
      birthMonth: Number(profile.birthMonth) || 1,
      birthYear: Number(profile.birthYear) || 2500,
    },
    latest: {
      firstPrize,
      top3: digits(latest.top3),
      bottom2: digits(latest.bottom2),
      drawDate: validDrawDate(latest.drawDate) ? latest.drawDate : null,
    },
  };
}

function leafValue(operator, context) {
  const { currentDate, profile, latest } = context;
  switch (operator) {
    case 'CONSTANT': return 0;
    case 'DATE_DAY': return currentDate.day;
    case 'DATE_MONTH': return currentDate.month;
    case 'DATE_YEAR': return currentDate.year;
    case 'DATE_WEEKDAY': return currentDate.weekday;
    case 'BIRTH_DAY': return profile.birthDay;
    case 'BIRTH_MONTH': return profile.birthMonth;
    case 'BIRTH_YEAR': return profile.birthYear;
    case 'LAST_DIGIT': return Number(digits(latest.firstPrize).slice(-1) || 0);
    case 'LAST_2_DIGITS': return Number(pad(latest.firstPrize, 2));
    case 'LAST_3_DIGITS': return Number(pad(latest.firstPrize, 3));
    case 'FIRST_DIGIT': return Number(digits(latest.firstPrize).slice(0, 1) || 0);
    case 'FIRST_2_DIGITS': return Number(digits(latest.firstPrize).slice(0, 2).padEnd(2, '0') || 0);
    case 'FIRST_3_DIGITS': return Number(digits(latest.firstPrize).slice(0, 3).padEnd(3, '0') || 0);
    case 'SUM_DIGITS': return [...digits(latest.firstPrize)].reduce((sum, digit) => sum + Number(digit), 0);
    case 'MOD_10': return Number(digits(latest.firstPrize) || 0) % 10;
    case 'MOD_100': return Number(digits(latest.firstPrize) || 0) % 100;
    default: return 0;
  }
}

const usesHistoryOperator = id => /^(FIRST_|LAST_|SUM_DIGITS$|MOD_)/.test(id);
const usesHistory = node => usesHistoryOperator(node.operator) ||
  (isBinary(node.operator) && (usesHistory(node.left) || usesHistory(node.right)));

export function validateFormulaTree(root) {
  if (!root || typeof root !== 'object' || Array.isArray(root)) return 'สูตรต้องมีโครงสร้างอย่างน้อยหนึ่งขั้น';
  let count = 0;
  const pending = [[root, 1]];
  while (pending.length) {
    const [node, depth] = pending.pop();
    if (depth > MAX_DEPTH) return `สูตรลึกเกิน ${MAX_DEPTH} ชั้น`;
    if (++count > MAX_NODES) return `สูตรยาวเกิน ${MAX_NODES} ขั้น`;
    if (!node || typeof node !== 'object' || Array.isArray(node)) return 'ขั้นการคำนวณไม่ถูกต้อง';
    const operator = operatorIds.get(node.operator);
    if (!operator) return `ไม่รู้จักคำสั่ง ${node.operator ?? '(ว่าง)'}`;
    if (operator.arity === 0) {
      if (node.left != null || node.right != null) return 'ขั้นนี้ต้องไม่มีคำสั่งย่อย';
      if (node.operator === 'CONSTANT' && !Number.isSafeInteger(node.value)) return 'ตัวเลขคงที่ต้องเป็นตัวเลขจำนวนเต็ม';
      continue;
    }
    if (!node.left || !node.right) return `${operator.name} ต้องมีสองด้าน`;
    pending.push([node.left, depth + 1], [node.right, depth + 1]);
  }
  return null;
}

export function evaluateNode(node, context) {
  const error = validateFormulaTree(node);
  if (error) throw new Error(error);
  const walk = current => {
    if (current.operator === 'CONSTANT') return Number(current.value) || 0;
    if (!isBinary(current.operator)) return leafValue(current.operator, context);
    const left = Number(walk(current.left)) || 0;
    const right = Number(walk(current.right)) || 0;
    switch (current.operator) {
      case 'ADD': return left + right;
      case 'SUBTRACT': return left - right;
      case 'MULTIPLY': return left * right;
      case 'CONCAT': return Number(`${digits(left)}${digits(right)}`) || 0;
      default: return 0;
    }
  };
  const value = walk(node);
  return Number.isFinite(value) ? value : 0;
}

// Left-deep tree from an ordered list of steps, which is what the builder edits.
export function buildFormulaTree(base, steps = []) {
  let root = typeof base === 'object' && base !== null ? base : { operator: 'CONSTANT', value: Number(base) || 0 };
  for (const step of steps) {
    if (!isBinary(step?.operator)) throw new Error(`ขั้นที่ไม่ถูกต้อง ${step?.operator ?? '(ว่าง)'}`);
    let operand;
    if (typeof step.operand === 'object' && step.operand !== null) {
      operand = step.operand;
    } else if (step.operand === 'CONSTANT' || step.constant !== undefined) {
      operand = { operator: 'CONSTANT', value: Number(step.constant) || 0 };
    } else if (typeof step.operand === 'string' && operatorIds.has(step.operand)) {
      operand = { operator: step.operand };
    } else {
      operand = { operator: 'CONSTANT', value: Number(step?.operand) || 0 };
    }
    root = { operator: step.operator, left: root, right: operand };
  }
  return root;
}

export function describeTree(root) {
  const name = id => operatorIds.get(id)?.name ?? id;
  const walk = node => {
    if (node.operator === 'CONSTANT') return String(Number(node.value) || 0);
    if (!isBinary(node.operator)) return name(node.operator);
    return `(${walk(node.left)} ${name(node.operator)} ${walk(node.right)})`;
  };
  return walk(root);
}

export function generatePredictions(rawValue, outputLength) {
  const length = Number(outputLength) === 3 ? 3 : 2;
  const pool = POOL_SIZE[length];
  const base = pad(rawValue, length);
  const number = Number(base) || 0;
  const results = new Set([base]);
  for (const delta of [-2, -1, 1, 2]) {
    results.add(String((number + delta + pool) % pool).padStart(length, '0'));
  }
  results.add([...base].reverse().join(''));
  results.add(String([...base].reduce((sum, digit) => sum + Number(digit), 0) % pool).padStart(length, '0'));
  return [...results].slice(0, MAX_PREDICTIONS);
}

export function nearMiss(predicted, actual, length) {
  const left = digits(predicted);
  const right = digits(actual);
  if (left.length !== length || right.length !== length) return false;
  let different = 0;
  for (let index = 0; index < length; index++) if (left[index] !== right[index]) different++;
  return different === 1;
}

export function matchNumbers(predictedNumbers, actual, outputLength) {
  const actualDigits = digits(actual);
  if (actualDigits.length !== Number(outputLength)) return { matchType: null, matched: [] };
  if (predictedNumbers.includes(actualDigits)) return { matchType: 'exact', matched: [actualDigits] };
  const near = predictedNumbers.filter(value => nearMiss(value, actualDigits, Number(outputLength)));
  return near.length ? { matchType: 'near', matched: near } : { matchType: null, matched: [] };
}

// Output length comes from the saved field, or from the kind for older records.
function outputLengthOf(formula) {
  const length = Number(formula?.outputLength ?? formula?.output_length);
  if (length === 2 || length === 3) return length;
  return formula?.kind === 'top3' ? 3 : 2;
}

export function calculateFormula(formula, context) {
  const root = formula?.root ?? formula?.root_json;
  const error = validateFormulaTree(root);
  if (error) return { error };
  const length = outputLengthOf(formula);
  if (usesHistory(root) && !/^\d{3}(?:\d{3})?$/.test(context.latest.firstPrize)) {
    return { error: 'ไม่มีผลรางวัลบนของงวดก่อนหน้า' };
  }
  const value = evaluateNode(root, context);
  return { value, outputLength: length, numbers: generatePredictions(value, length), description: describeTree(root) };
}

// Backtest walks forward only: each target draw is scored against the draw before it.
export function resolveTreeDraws(history) {
  const byDate = new Map();
  for (const row of history) {
    if (!validDrawDate(row?.date)) continue;
    const prior = byDate.get(row.date);
    const conflict = row.conflict || prior?.conflict || (prior &&
      ['top3', 'bottom2', 'firstPrize'].some(key => (prior[key] ?? '') !== (row[key] ?? '')));
    byDate.set(row.date, conflict ? { date: row.date, conflict: true } : row);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function backtestFormulaTree(formula, history, limit = 10, profile = {}) {
  const rows = resolveTreeDraws(history);
  const outputLength = outputLengthOf(formula);
  const results = [];
  const start = Math.max(1, rows.length - limit);
  for (let index = start; index < rows.length; index++) {
    const target = rows[index];
    const previous = rows[index - 1];
    const actual = outputLength === 3 ? target.top3 : target.bottom2;
    if (previous.conflict || target.conflict) {
      results.push({ date: target.date, reason: 'ผลงวดนี้ขัดกัน' });
      continue;
    }
    if (typeof actual !== 'string' || !/^\d+$/.test(actual) || actual.length !== outputLength) {
      results.push({ date: target.date, reason: 'ไม่มีผลรางวัลของงวดนี้' });
      continue;
    }
    const context = contextForDate(target.date, {
      firstPrize: previous.firstPrize ?? previous.top3,
      top3: previous.top3,
      bottom2: previous.bottom2,
      drawDate: previous.date,
    }, profile);
    const calculated = calculateFormula(formula, context);
    if (calculated.error) {
      results.push({ date: target.date, reason: calculated.error });
      continue;
    }
    const { matchType, matched } = matchNumbers(calculated.numbers, actual, outputLength);
    results.push({
      date: target.date, actual, numbers: calculated.numbers, value: calculated.value,
      matchType, matched, hit: matchType === 'exact',
    });
  }
  return results.reverse();
}

export function decomposeTree(root) {
  if (!root || typeof root !== 'object' || Array.isArray(root)) return null;
  const operatorIds = new Map([...leafOperators, ...binaryOperators].map(item => [item.id, item]));
  if (!operatorIds.has(root.operator)) return null;
  if (root.operator === 'CONSTANT') {
    return { base: 'CONSTANT', constant: String(Number(root.value) || 0), steps: [] };
  }
  if (!isBinary(root.operator)) {
    return { base: root.operator, constant: '0', steps: [] };
  }
  const steps = [];
  let current = root;
  while (isBinary(current.operator)) {
    const right = current.right;
    let operand;
    let constant = '0';
    if (right.operator === 'CONSTANT') {
      operand = 'CONSTANT';
      constant = String(Number(right.value) || 0);
    } else if (operatorIds.has(right.operator)) {
      operand = right.operator;
    } else {
      return null;
    }
    steps.unshift({ operator: current.operator, operand, constant });
    current = current.left;
  }
  const base = current.operator === 'CONSTANT' ? 'CONSTANT' : current.operator;
  const constant = base === 'CONSTANT' ? String(Number(current.value) || 0) : '0';
  return { base, constant, steps };
}

export function summarizeBacktest(rows) {
  const scored = rows.filter(row => !row.reason);
  const hits = scored.filter(row => row.hit).length;
  const near = scored.filter(row => row.matchType === 'near').length;
  const trials = scored.length;
  const expected = scored.reduce((total, row) => total + row.numbers.length / POOL_SIZE[row.numbers[0]?.length ?? 2], 0);
  return {
    trials, hits, near,
    rate: trials ? hits / trials : null,
    expectedHits: expected,
    expectedRate: trials ? expected / trials : null,
  };
}
