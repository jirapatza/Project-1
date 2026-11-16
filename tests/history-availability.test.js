import test from 'node:test';
import assert from 'node:assert/strict';
import { describeHistoryAvailability, describeHistoryFreshness } from '../public/history-availability.js';

test('missing draws never look like complete data', () => {
  assert.deepEqual(describeHistoryAvailability(0, 10), {
    status: 'ยังไม่มีข้อมูล',
    message: 'ยังไม่พบผลย้อนหลังที่ตรวจสอบและจับคู่ได้ ไม่แสดงสถิติแทนข้อมูลที่ไม่มี',
  });
  const partial = describeHistoryAvailability(4, 30);
  assert.equal(partial.status, 'ข้อมูลบางส่วน');
  assert.match(partial.message, /4 จาก 30/);
  assert.match(partial.message, /ข้อมูลที่มีจริงเท่านั้น/);
});

test('only complete valid windows report history available', () => {
  assert.equal(describeHistoryAvailability(10, 10).status, 'มีข้อมูลย้อนหลัง');
  assert.equal(describeHistoryAvailability(20, 30).status, 'ข้อมูลบางส่วน');
  assert.equal(describeHistoryAvailability(30, 30).status, 'มีข้อมูลย้อนหลัง');
});

test('upstream errors override success and invalid windows throw', () => {
  assert.equal(describeHistoryAvailability(30, 30, true).status, 'โหลดไม่สำเร็จ');
  assert.throws(() => describeHistoryAvailability(-1, 10), TypeError);
  assert.throws(() => describeHistoryAvailability(1, 3), TypeError);
});


test('shows the last fetch time in Bangkok local time for upstream and cache', () => {
  for (const source of ['upstream', 'cache']) {
    const status = describeHistoryFreshness(source, '2026-11-13T17:12:00.000Z');
    assert.match(status, /^เวลาดึงข้อมูลล่าสุด/);
    assert.match(status, /00:12/);
  }
});

test('labels stale cache and bundled archive without implying freshness', () => {
  const stale = describeHistoryFreshness('stale-cache', '2026-11-13T17:12:00.000Z');
  assert.match(stale, /^สำเนาเดิม · เวลาดึงข้อมูลล่าสุด/);
  assert.match(describeHistoryFreshness('archive', null), /^ข้อมูลสำรองในแอป · ไม่ทราบเวลาเก็บ snapshot$/);
});

test('handles missing or invalid snapshot timestamps without hiding stale state', () => {
  assert.equal(describeHistoryFreshness('cache', 'not-a-date'), 'เวลาดึงข้อมูลล่าสุด ไม่ทราบ');
  assert.equal(describeHistoryFreshness('stale-cache', null), 'สำเนาเดิม · เวลาดึงข้อมูลล่าสุด ไม่ทราบ');
  assert.equal(describeHistoryFreshness('stale-cache', 'not-a-date'), 'สำเนาเดิม · เวลาดึงข้อมูลล่าสุด ไม่ทราบ');
  assert.equal(describeHistoryFreshness('other', null), '');
});
