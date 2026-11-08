import test from 'node:test';
import assert from 'node:assert/strict';
import { describeHistoryAvailability } from '../public/history-availability.js';

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
