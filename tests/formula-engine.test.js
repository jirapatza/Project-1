import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bangkokParts, contextForDate, buildFormulaTree, describeTree, validateFormulaTree,
  evaluateNode, generatePredictions, matchNumbers, nearMiss, calculateFormula,
  backtestFormulaTree, summarizeBacktest, decomposeTree, POOL_SIZE,
} from '../public/formula-engine.js';

const context = (firstPrize, isoDate = '2026-11-05') => contextForDate(isoDate, {
  firstPrize, top3: firstPrize, bottom2: '18', drawDate: '2026-11-04',
}, { birthDay: 9, birthMonth: 8, birthYear: 2543 });

test('leaf operators read the latest draw, the draw date and the birth date', () => {
  const ctx = context('123456');
  assert.equal(evaluateNode({ operator: 'LAST_DIGIT' }, ctx), 6);
  assert.equal(evaluateNode({ operator: 'LAST_2_DIGITS' }, ctx), 56);
  assert.equal(evaluateNode({ operator: 'LAST_3_DIGITS' }, ctx), 456);
  assert.equal(evaluateNode({ operator: 'FIRST_DIGIT' }, ctx), 1);
  assert.equal(evaluateNode({ operator: 'FIRST_2_DIGITS' }, ctx), 12);
  assert.equal(evaluateNode({ operator: 'FIRST_3_DIGITS' }, ctx), 123);
  assert.equal(evaluateNode({ operator: 'SUM_DIGITS' }, ctx), 21);
  assert.equal(evaluateNode({ operator: 'MOD_10' }, ctx), 6);
  assert.equal(evaluateNode({ operator: 'MOD_100' }, ctx), 56);
  assert.equal(evaluateNode({ operator: 'DATE_DAY' }, ctx), 5);
  assert.equal(evaluateNode({ operator: 'DATE_MONTH' }, ctx), 11);
  assert.equal(evaluateNode({ operator: 'DATE_YEAR' }, ctx), 2569);
  assert.equal(evaluateNode({ operator: 'BIRTH_DAY' }, ctx), 9);
  assert.equal(evaluateNode({ operator: 'BIRTH_YEAR' }, ctx), 2543);
});

test('an empty result reads as zero instead of throwing', () => {
  const ctx = contextForDate('2026-11-05', {}, {});
  assert.equal(evaluateNode({ operator: 'LAST_2_DIGITS' }, ctx), 0);
  assert.equal(evaluateNode({ operator: 'SUM_DIGITS' }, ctx), 0);
  assert.equal(evaluateNode({ operator: 'MOD_100' }, ctx), 0);
});

test('binary operators combine two branches and CONCAT keeps digits', () => {
  const ctx = context('123456');
  const tree = (operator, left, right) => ({ operator, left, right });
  const constant = value => ({ operator: 'CONSTANT', value });
  assert.equal(evaluateNode(tree('ADD', { operator: 'LAST_DIGIT' }, constant(3)), ctx), 9);
  assert.equal(evaluateNode(tree('SUBTRACT', { operator: 'LAST_2_DIGITS' }, constant(6)), ctx), 50);
  assert.equal(evaluateNode(tree('MULTIPLY', { operator: 'LAST_DIGIT' }, constant(7)), ctx), 42);
  assert.equal(evaluateNode(tree('CONCAT', { operator: 'LAST_DIGIT' }, constant(3)), ctx), 63);
  assert.equal(validateFormulaTree(tree('ADD', { operator: 'LAST_DIGIT' }, constant(3))), null);
});

test('buildFormulaTree folds steps left-deep and describeTree names each step', () => {
  const root = buildFormulaTree({ operator: 'LAST_DIGIT' }, [
    { operator: 'ADD', operand: { operator: 'CONSTANT', value: 3 } },
    { operator: 'MULTIPLY', operand: { operator: 'DATE_DAY' } },
  ]);
  assert.deepEqual(root, {
    operator: 'MULTIPLY',
    left: { operator: 'ADD', left: { operator: 'LAST_DIGIT' }, right: { operator: 'CONSTANT', value: 3 } },
    right: { operator: 'DATE_DAY' },
  });
  assert.equal(describeTree(root), '((หลักหน่วยรางวัลบน บวก 3) คูณ วันที่งวด)');
  assert.equal(evaluateNode(root, context('123456')), 45);
});

test('validation rejects unknown operators, missing sides and oversized trees', () => {
  assert.match(validateFormulaTree({ operator: 'DROP TABLE' }), /ไม่รู้จักคำสั่ง/);
  assert.match(validateFormulaTree({ operator: 'ADD', left: { operator: 'LAST_DIGIT' } }), /ต้องมีสองด้าน/);
  assert.match(validateFormulaTree({ operator: 'CONSTANT', value: 'ศูนย์' }), /ตัวเลขคงที่/);
  assert.match(validateFormulaTree(null), /โครงสร้าง/);
  let deep = { operator: 'LAST_DIGIT' };
  for (let index = 0; index < 9; index++) deep = { operator: 'ADD', left: deep, right: { operator: 'CONSTANT', value: 1 } };
  assert.match(validateFormulaTree(deep), /ลึกเกิน/);
});

test('predictions keep leading zeros, stay inside the pool and cap at 15', () => {
  const two = generatePredictions(6, 2);
  assert.equal(two[0], '06');
  assert.ok(two.every(value => /^\d{2}$/.test(value)));
  assert.ok(two.every(value => Number(value) < POOL_SIZE[2]));
  assert.equal(new Set(two).size, two.length);
  assert.ok(two.length <= 15);
  const three = generatePredictions(1234, 3);
  assert.equal(three[0], '234');
  assert.ok(three.every(value => /^\d{3}$/.test(value) && Number(value) < POOL_SIZE[3]));
  assert.deepEqual(generatePredictions(0, 2), ['00', '98', '99', '01', '02']);
});

test('match reports exact, near (one digit apart) and no match', () => {
  const numbers = ['06', '04', '05', '07', '08', '60'];
  assert.deepEqual(matchNumbers(numbers, '06', 2), { matchType: 'exact', matched: ['06'] });
  assert.deepEqual(matchNumbers(numbers, '45', 2), { matchType: 'near', matched: ['05'] });
  assert.deepEqual(matchNumbers(numbers, '99', 2), { matchType: null, matched: [] });
  assert.equal(matchNumbers(numbers, '6', 2).matchType, null);
  assert.equal(nearMiss('06', '07', 2), true);
  assert.equal(nearMiss('06', '60', 2), false);
});

test('calculateFormula returns the value, the numbers and the tree description', () => {
  const formula = { kind: 'bottom2', root: { operator: 'LAST_2_DIGITS' } };
  const result = calculateFormula(formula, context('123456'));
  assert.equal(result.value, 56);
  assert.equal(result.outputLength, 2);
  assert.equal(result.numbers[0], '56');
  assert.equal(result.description, '2 หลักท้ายรางวัลบน');
  assert.ok(calculateFormula({ root: { operator: 'NOPE' } }, context('123456')).error);
});

test('backtest scores each draw only against the draw before it', () => {
  const history = [
    { date: '2026-11-01', top3: '006', bottom2: '18' },
    { date: '2026-11-02', top3: '123', bottom2: '45' },
    { date: '2026-11-03', top3: '789', bottom2: '32' },
  ];
  const formula = { kind: 'bottom2', root: { operator: 'LAST_2_DIGITS' } };
  const rows = backtestFormulaTree(formula, history, 10);
  assert.deepEqual(rows.map(row => row.date), ['2026-11-03', '2026-11-02']);
  assert.equal(rows[0].actual, '32');
  assert.equal(rows[0].matchType, 'exact');
  assert.equal(rows[0].hit, true);
  assert.equal(rows[1].matchType, 'near');
  assert.deepEqual(rows[1].matched, ['05']);
  const summary = summarizeBacktest(rows);
  assert.equal(summary.trials, 2);
  assert.equal(summary.hits, 1);
  assert.equal(summary.near, 1);
  assert.equal(summary.rate, 0.5);
  assert.ok(Math.abs(summary.expectedHits - 0.13) < 1e-9);
  assert.ok(Math.abs(summary.expectedRate - 0.065) < 1e-9);
});

test('changing the target and later results cannot change its predicted numbers', () => {
  const previous = { date: '2026-11-01', firstPrize: '900006', top3: '006', bottom2: '18' };
  const target = { date: '2026-11-02', firstPrize: '123006', top3: '006', bottom2: '06' };
  const later = { date: '2026-11-03', firstPrize: '456789', top3: '789', bottom2: '32' };
  const changedTarget = { ...target, firstPrize: '555999', top3: '999', bottom2: '99' };
  const changedLater = { ...later, firstPrize: '100111', top3: '111', bottom2: '11' };

  for (const [kind, expected] of [['bottom2', '06'], ['top3', '006']]) {
    const formula = { kind, root: { operator: 'LAST_3_DIGITS' } };
    const score = history => backtestFormulaTree(formula, history).find(row => row.date === target.date);
    const before = score([target, previous]);
    const after = score([changedLater, changedTarget, previous]);
    assert.equal(before.value, 6);
    assert.equal(before.numbers[0], expected);
    assert.equal(after.value, before.value);
    assert.deepEqual(after.numbers, before.numbers);
    assert.equal(before.hit, true);
    assert.equal(after.hit, false);
    assert.notEqual(after.actual, before.actual);
  }
});

test('backtest explains unscorable draws instead of borrowing an older one', () => {
  const history = [
    { date: '2026-11-01', top3: '006', bottom2: '18' },
    { date: '2026-11-02', top3: '123' },
    { date: '2026-11-03', top3: '789', bottom2: '32' },
    { date: '2026-11-04', conflict: true },
  ];
  const rows = backtestFormulaTree({ kind: 'bottom2', root: { operator: 'LAST_2_DIGITS' } }, history, 10);
  assert.equal(rows[0].reason, 'ผลงวดนี้ขัดกัน');
  assert.equal(rows[1].hit, true);
  assert.equal(rows[2].reason, 'ไม่มีผลรางวัลของงวดนี้');
  assert.equal(summarizeBacktest(rows).trials, 1);
});

test('a three-digit formula scores the top prize and needs three-digit results', () => {
  const history = [
    { date: '2026-11-01', top3: '006', bottom2: '18' },
    { date: '2026-11-02', top3: '123', bottom2: '45' },
    { date: '2026-11-03', top3: '321', bottom2: '32' },
  ];
  const rows = backtestFormulaTree({ kind: 'top3', root: { operator: 'LAST_3_DIGITS' } }, history, 10);
  assert.equal(rows[0].actual, '321');
  assert.equal(rows[0].hit, true);
  assert.match(rows[0].numbers[0], /^\d{3}$/);
});

test('bangkokParts converts the draw date to Thai year and weekday', () => {
  const parts = bangkokParts('2026-11-05');
  assert.equal(parts.isoDate, '2026-11-05');
  assert.equal(parts.year, 2569);
  assert.equal(parts.month, 11);
  assert.equal(parts.day, 5);
  assert.ok(parts.weekday >= 0 && parts.weekday <= 6);
  assert.equal(bangkokParts('2026-02-30').isoDate, bangkokParts('').isoDate);
});

test('deduplicates draws and does not score malformed or missing inputs', () => {
  const previous = { date: '2026-11-01', top3: '006', bottom2: '18' };
  const rows = backtestFormulaTree({ root: { operator: 'LAST_DIGIT' } }, [
    previous, { ...previous }, { date: '2026-11-02', bottom2: '06' },
    { date: '2026-11-03', top3: '123', bottom2: '06' },
    { date: '2026-11-04', top3: '456', bottom2: '6' },
  ]);
  assert.equal(rows.length, 3);
  assert.match(rows[0].reason, /ไม่มีผลรางวัล/);
  assert.match(rows[1].reason, /งวดก่อนหน้า/);
  assert.equal(rows[2].hit, true);
});

test('decomposeTree rebuilds the base and steps that buildFormulaTree folded', () => {
  const root = buildFormulaTree({ operator: 'LAST_DIGIT' }, [
    { operator: 'ADD', operand: 'CONSTANT', constant: '3' },
    { operator: 'CONCAT', operand: 'LAST_2_DIGITS' },
  ]);
  assert.deepEqual(decomposeTree(root), {
    base: 'LAST_DIGIT', constant: '0',
    steps: [
      { operator: 'ADD', operand: 'CONSTANT', constant: '3' },
      { operator: 'CONCAT', operand: 'LAST_2_DIGITS', constant: '0' },
    ],
  });
  assert.deepEqual(decomposeTree({ operator: 'CONSTANT', value: 7 }), {
    base: 'CONSTANT', constant: '7', steps: [],
  });
  assert.equal(decomposeTree({ operator: 'NOPE' }), null);
  assert.equal(decomposeTree(null), null);
});

test('validation bounds cyclic trees', () => {
  const root = { operator: 'ADD', right: { operator: 'CONSTANT', value: 1 } };
  root.left = root;
  assert.match(validateFormulaTree(root), /ลึกเกิน/);
});
