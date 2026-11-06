import test from 'node:test';
import assert from 'node:assert/strict';
import { formulaOptions, calculateFormula, backtestFormula, validDrawDate, resolveFormulaDraws } from '../public/independent-formulas.js';

test('weekday formula works without results and uses the selected draw weekday', () => {
  assert.equal(formulaOptions.length, 5);
  const monday = calculateFormula('weekday', '2026-11-09', []);
  assert.deepEqual(monday.primary, [2, 9]);
  assert.deepEqual(monday.pairs, ['29', '25', '27', '95', '97']);
  assert.equal(monday.usedDraws, 0);
  assert.deepEqual(calculateFormula('weekday', '2026-11-08', []).primary, [1, 8]);
});

test('Lao video formula reproduces 06 + 18, and does not guess fractional quotients', () => {
  const history = [{ date: '2026-11-03', top3: '006', bottom2: '18' }];
  const result = calculateFormula('lao_divide_three', '2026-11-04', history);
  assert.deepEqual(result.primary, [8, 9]);
  assert.equal(result.calculation, '06 + 18 = 24; 24 ÷ 3 = 8');
  assert.deepEqual(result.pairs, []);
  assert.deepEqual(result.triples, []);
  assert.match(calculateFormula('lao_divide_three', '2026-11-04', [{ date: '2026-11-03', top3: '006', bottom2: '19' }]).error, /มีเศษ/);
  assert.ok(calculateFormula('lao_divide_three', '2026-11-04', [{ date: '2026-11-03', conflict: true }]).error);
  assert.deepEqual(calculateFormula('lao_divide_three', '2026-11-04', [{ date: '2026-11-03', top3: '006', bottom2: '21' }]).primary, [9, 0]);
});

test('backtest range does not replace an uncomputable recent draw with an older one', () => {
  const draws = [
    { date: '2026-11-01', top3: '006', bottom2: '18' },
    { date: '2026-11-02', top3: '006', bottom2: '19' },
    { date: '2026-11-03', top3: '123', bottom2: '45' },
  ];
  assert.deepEqual(backtestFormula('lao_divide_three', draws, 1), []);
  assert.equal(backtestFormula('lao_divide_three', draws, 2).length, 1);
});

test('Lao video backtest counts only independently available digits and omits unsupported pairs', () => {
  const draws = [{ date: '2026-11-03', top3: '006', bottom2: '18' }, { date: '2026-11-04', top3: '123', bottom2: '89' }];
  const result = backtestFormula('lao_divide_three', draws);
  assert.equal(result.length, 1);
  assert.equal(result[0].primaryHit, true);
  assert.equal(result[0].pairHit, null);
  assert.equal(result[0].tripleHit, null);
});

test('past-result formulas require actual data and ignore the target and future draws', () => {
  assert.match(calculateFormula('sum', '2026-11-09', []).error, /ย้อนหลัง|ก่อนหน้า/);
  const history = [
    { date: '2026-11-08', top3: '012', bottom2: '03' },
    { date: '2026-11-09', top3: '999', bottom2: '99' },
    { date: '2026-11-10', top3: '999', bottom2: '99' },
  ];
  const result = calculateFormula('sum', '2026-11-09', history);
  assert.deepEqual(result.primary, [6, 1]);
  assert.equal(result.latestDraw, '2026-11-08');
  assert.equal(result.usedDraws, 1);
  assert.ok(result.triples.every(value => /^\d{3}$/.test(value)));
  assert.ok(calculateFormula('sum', '2026-11-09', [{ date: '2026-11-08', top3: '', bottom2: '03' }]).error);
});

test('frequency counts actual historical digits and matrix filters doubles', () => {
  const history = [{ date: '2026-11-08', top3: '001', bottom2: '23' }];
  const frequency = calculateFormula('frequency', '2026-11-09', history);
  assert.deepEqual(frequency.primary, [0, 1]);
  assert.equal(frequency.usedDraws, 1);
  assert.ok(calculateFormula('frequency', '2026-11-09', [{ date: '2026-11-08', top3: '000', bottom2: '00' }]).error);
  const matrix = calculateFormula('matrix', '2026-11-09', history);
  assert.ok(matrix.pairs.length > 0);
  assert.ok(matrix.pairs.every(pair => pair[0] !== pair[1]));
});

test('backtest scores each draw using only earlier draws and preserves leading zeros', () => {
  const rows = [
    { date: '2026-11-07', top3: '001', bottom2: '02' },
    { date: '2026-11-08', top3: '020', bottom2: '03' },
    { date: '2026-11-09', top3: '105', bottom2: '06' },
  ];
  const tested = backtestFormula('sum', rows, 10);
  assert.equal(tested.length, 2);
  assert.equal(tested[0].prediction.latestDraw, '2026-11-08');
  assert.equal(tested[1].bottom2, '03');
  assert.deepEqual(tested[1].prediction.primary, [5, 0]);
  assert.deepEqual(backtestFormula('sum', rows.slice(0, 1), 10), []);
  assert.equal(backtestFormula('weekday', rows, 1).length, 1);
});

test('invalid dates and unknown formulas fail without generating numbers', () => {
  assert.equal(validDrawDate('2026-02-30'), false);
  assert.ok(calculateFormula('weekday', '2026-02-30', []).error);
  assert.ok(calculateFormula('unknown', '2026-11-09', []).error);
});

test('conflicting latest draw blocks previous-result formulas without falling back to an older draw', () => {
  const rows = resolveFormulaDraws([
    { date: '2026-11-07', top3: '123', bottom2: '45' },
    { date: '2026-11-08', top3: '001', bottom2: '02' },
    { date: '2026-11-08', top3: '003', bottom2: '02' },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].conflict, true);
  assert.ok(calculateFormula('sum', '2026-11-09', rows).error);
  assert.ok(calculateFormula('frequency', '2026-11-09', rows).error);
  assert.equal(backtestFormula('weekday', rows).length, 1);
});

test('numeric result fields cannot be treated as strings or silently lose leading zeros', () => {
  const rows = [{ date: '2026-11-08', top3: 123, bottom2: '02' }];
  assert.ok(calculateFormula('sum', '2026-11-09', rows).error);
  assert.ok(calculateFormula('frequency', '2026-11-09', rows).error);
  const checked = backtestFormula('weekday', rows);
  assert.equal(checked.length, 1);
  assert.equal(checked[0].top3, null);
  assert.equal(checked[0].tripleHit, null);
  assert.equal(typeof checked[0].pairHit, 'boolean');
});
