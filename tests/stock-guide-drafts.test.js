import test from 'node:test';
import assert from 'node:assert/strict';
import { selectStockGuideDrafts } from '../public/stock-guide-drafts.js';

const date = '2026-11-23';
const now = Date.parse(date + 'T09:00:00+07:00');
const id = 'nikkei_morning';
const guide = {
  lotteryId: id, drawDate: date,
  numbers: { standout: ['0', '1'], twoDigit: ['01', '02', '03', '04', '05', '06', '07', '08'],
    threeDigit: ['001', '002', '003', '004'], running: ['0', '1'] },
};
const entry = { id, guide, checkedAt: now - 60_000, status: 'needs_confirmation', provenance: { kind: 'history_formula' } };
const slot = {
  id, publishedSource: 'https://leklnw.com/huay-ai-stock/', status: 'matches_weekly_rule',
  startAt: date + 'T08:45:00+07:00', targetReadyAt: date + 'T09:05:00+07:00', closeAt: date + 'T09:35:00+07:00',
};
const feed = { date, entries: [entry], schedule: [slot] };

test('shows complete stock formula drafts and keeps leading zeroes', () => {
  assert.deepEqual(selectStockGuideDrafts(feed, new Set(), now), [guide]);
  assert.deepEqual(selectStockGuideDrafts(feed, new Set([id]), now), []);
});

test('omits expired, unscheduled, late and wrong-day drafts', () => {
  for (const when of [date + 'T08:44:59+07:00', date + 'T09:05:01+07:00', '2026-11-24T09:00:00+07:00']) {
    assert.deepEqual(selectStockGuideDrafts(feed, new Set(), Date.parse(when)), []);
  }
  for (const schedule of [[], [{ ...slot, status: 'off_day' }], [{ ...slot, publishedSource: null }]]) {
    assert.deepEqual(selectStockGuideDrafts({ ...feed, schedule }, new Set(), now), []);
  }
});

test('omits bad provenance, already-published results and incomplete numbers', () => {
  const invalidEntries = [
    { ...entry, provenance: { kind: 'published_and_history' } },
    { ...entry, status: 'result_already_present' },
    { ...entry, checkedAt: now + 1 },
    { ...entry, guide: { ...guide, drawDate: '2026-11-22' } },
    { ...entry, guide: { ...guide, numbers: { ...guide.numbers, threeDigit: ['001'] } } },
  ];
  assert.deepEqual(selectStockGuideDrafts({ ...feed, entries: invalidEntries }, new Set(), now), []);
});

test('imports the first four valid combinations from an older six-slot collector', () => {
  const legacy = { ...guide, numbers: { ...guide.numbers, threeDigit: [...guide.numbers.threeDigit, '005', '006'] } };
  assert.deepEqual(selectStockGuideDrafts({ ...feed, entries: [{ ...entry, guide: legacy }] }, new Set(), now), [guide]);
  assert.equal(legacy.numbers.threeDigit.length, 6);
});
