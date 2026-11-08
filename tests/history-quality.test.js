import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeHistoryQuality, bangkokDate } from '../history-quality.js';

const catalog = [{ id: 'sample', name: 'Example' }];
const row = (date, top3 = '007') => ({
  หวย: 'sample', วันที่จัดรูปแบบ: date, เลขบน_3_ตัว: top3, เลขล่าง_2_ตัว: '03'
});

test('reports accepted and rejected counts without exposing result digits', () => {
  const history = [row('2026-11-07'), row('2026-11-07'),
    row('2026-11-08', '123'), row('2026-11-08', '999'), row('2026-11-09')];
  const summary = summarizeHistoryQuality(history, catalog, '2026-11-08');
  assert.deepEqual(summary, {
    checked: 5, accepted: 1, rejected: 4,
    reasons: { duplicate_draw: 1, conflicting_draw: 2, future_date: 1 },
    asOf: '2026-11-08', independentlyVerified: false,
  });
  assert.equal(JSON.stringify(summary).includes('007'), false);
});

test('reports source catalog unknown IDs and pending statuses', () => {
  const result = summarizeHistoryQuality([
    { ...row('2026-11-08'), หวย: 'other' },
    { ...row('2026-11-08'), status: 'pending' }
  ], catalog, '2026-11-08');
  assert.equal(result.accepted, 0);
  assert.equal(result.reasons.unknown_lottery, 1);
  assert.equal(result.reasons.unconfirmed, 1);
});

test('Bangkok calendar date switches at UTC 17:00 and validates timestamps', () => {
  assert.equal(bangkokDate(new Date('2026-11-07T16:59:59Z')), '2026-11-07');
  assert.equal(bangkokDate(new Date('2026-11-07T17:00:00Z')), '2026-11-08');
  assert.throws(() => bangkokDate(new Date('invalid')), TypeError);
});
