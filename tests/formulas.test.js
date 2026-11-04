import test from 'node:test';
import assert from 'node:assert/strict';
import { backtest, formulas } from '../public/formulas.js';

const draws = ['02', '20', '22', null, '45', '03', '48']
  .map((number, index) => ({ number, date: `2026-01-0${index + 1}` }));

test('backtest uses previous draws only and preserves leading zero', () => {
  const results = backtest(draws, formulas[1], Infinity);
  assert.deepEqual(results.map(({ calculated }) => calculated), ['30', '54', '02', '20']);
  assert.equal(results.at(-1).hit, true);
});

test('last target can use earlier inputs outside the selected period', () => {
  assert.deepEqual(backtest(draws, formulas[2], 1), [
    { date: '2026-01-07', number: '48', calculated: '48', hit: true },
  ]);
  assert.deepEqual(backtest(draws.slice(0, 2), formulas[2], Infinity), []);
});
