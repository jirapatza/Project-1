import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeHistoryCoverage } from '../history-coverage.js';

const catalog = [
  { id: 'alpha', name: 'Alpha' },
  { id: 'beta', name: 'Beta' },
  { id: 'empty', name: 'Empty' },
];
const row = (id, date, top3='007', bottom2='03') => ({
  หวย: id, วันที่จัดรูปแบบ: date, เลขบน_3_ตัว: top3, เลขล่าง_2_ตัว: bottom2,
});

test('reports actual catalog coverage without mistaking unknown source codes for missing records', () => {
  const history = [
    row('alpha', '2026-11-01'), row('alpha', '2026-11-03'),
    row('alpha', '2026-11-03'), row('beta', '2026-11-02'),
    row('other', '2026-11-02'),
  ];
  const result = summarizeHistoryCoverage(history, catalog, '2026-11-08');
  assert.equal(result.catalogCount, 3);
  assert.equal(result.historyRows, 5);
  assert.equal(result.matchedLotteries, 2);
  assert.deepEqual(result.missingLotteries, [
    { id: 'empty', name: 'Empty', validDraws: 0, firstDraw: null, lastDraw: null },
  ]);
  assert.deepEqual(result.lotteries[0], {
    id: 'alpha', name: 'Alpha', validDraws: 2,
    firstDraw: '2026-11-01', lastDraw: '2026-11-03',
  });
  assert.equal(result.acceptedDraws, 3);
  assert.deepEqual(result.rejectionReasons, { duplicate_draw: 1, unknown_lottery: 1 });
  assert.equal(result.independentlyVerified, false);
});

test('conflicting results do not count toward lottery coverage and future rows are excluded', () => {
  const result = summarizeHistoryCoverage([
    row('alpha', '2026-11-01', '007'), row('alpha', '2026-11-01', '008'),
    row('beta', '2026-11-09'),
  ], catalog, '2026-11-08');
  assert.equal(result.matchedLotteries, 0);
  assert.equal(result.missingLotteries.length, 3);
  assert.equal(result.rejectionReasons.conflicting_draw, 2);
  assert.equal(result.rejectionReasons.future_date, 1);
});
