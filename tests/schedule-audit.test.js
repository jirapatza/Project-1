import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSchedule } from '../schedule-audit.mjs';

const weekdays = { 'จันทร์ - ศุกร์': [1, 2, 3, 4, 5], 'ทุกวัน': [0, 1, 2, 3, 4, 5, 6] };
const draw = (id, drawDays, closeTimeStr = '20:15 น.', drawTimeStr = '20:30 น.') =>
  ({ id, name: id, drawDays, closeTimeStr, drawTimeStr });

test('keeps regular, VIP and special rounds distinct and uses the requested Bangkok weekday', () => {
  const catalog = [draw('regular', 'จันทร์- ศุกร์'), draw('vip', 'ทุกวัน'), draw('special', 'ทุกวัน')];
  const sunday = auditSchedule(catalog, weekdays, '2026-11-08');
  assert.deepEqual(sunday.map(row => [row.id, row.status]), [
    ['regular', 'off_day'], ['vip', 'matches_weekly_rule'], ['special', 'matches_weekly_rule'],
  ]);
  assert.equal(sunday[1].startAt, '2026-11-08T12:25:00.000Z');
  assert.equal(sunday[1].targetReadyAt, '2026-11-08T12:45:00.000Z');
  assert.equal(auditSchedule(catalog, weekdays, '2026-11-09')[0].status, 'matches_weekly_rule');
});

test('reports uncertain schedules, invalid times and windows that start before Bangkok midnight', () => {
  const rows = auditSchedule([
    draw('irregular', 'ตามประกาศวันงวดจริง (อาจเลื่อน)'),
    draw('unknown', 'เมื่อมีประกาศ'),
    draw('malformed', 'ทุกวัน', '24:12 น.'),
    draw('inverted', 'ทุกวัน', '21:00 น.'),
    draw('overnight', 'ทุกวัน', '00:05 น.', '00:30 น.'),
  ], weekdays, '2026-11-08');
  assert.deepEqual(rows.map(row => row.status), [
    'requires_draw_date', 'unknown_day_rule', 'invalid_times', 'invalid_times', 'starts_previous_day',
  ]);
  assert.equal(rows[4].startAt, '2026-11-07T16:15:00.000Z');
});

test('rejects a nonexistent date or duplicated catalog identity', () => {
  const entry = draw('same', 'ทุกวัน');
  assert.throws(() => auditSchedule([entry], weekdays, '2026-02-30'), /Invalid Bangkok date/);
  assert.throws(() => auditSchedule([entry, entry], weekdays, '2026-11-08'), /unique IDs/);
});
