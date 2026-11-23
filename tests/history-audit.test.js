import test from 'node:test';
import assert from 'node:assert/strict';
import { auditHistoricalRows } from '../history-audit.js';
const catalog = [{id:'lao_extra',name:'ลาว EXTRA'}];
const row = (date, top3='007', bottom2='03', extra={}) => ({หวย:'lao_extra',วันที่จัดรูปแบบ:date,เลขบน_3_ตัว:top3,เลขล่าง_2_ตัว:bottom2,...extra});
test('keeps leading zeros',()=>{
 const result=auditHistoricalRows([row('2026-11-02')],catalog,'2026-11-08');
 assert.equal(result.accepted[0].top3,'007'); assert.equal(result.accepted[0].bottom2,'03');
 assert.deepEqual(result.rejected,[]);
});
test('ignores exact duplicates',()=>{
 const result=auditHistoricalRows([row('2026-11-02'),row('2026-11-02')],catalog,'2026-11-08');
 assert.equal(result.accepted.length,1); assert.deepEqual(result.rejected,[{index:1,reason:'duplicate_draw'}]);
});
test('withholds every conflicting result for the same draw',()=>{
 const result=auditHistoricalRows([row('2026-11-02'),row('2026-11-02','123')],catalog,'2026-11-08');
 assert.equal(result.accepted.length,0); assert.equal(result.rejected.filter(x=>x.reason==='conflicting_draw').length,2);
});
test('rejects future, impossible, invalid and pending draws',()=>{
 const result=auditHistoricalRows([row('2026-11-09'),row('2026-02-30'),row('2026-11-02',7),row('2026-11-02','007','03',{status:'pending'})],catalog,'2026-11-08');
 assert.deepEqual(result.rejected.map(x=>x.reason),['future_date','invalid_date','invalid_digits','unconfirmed']);
});
test('rejects unknown catalog IDs and invalid asOf',()=>{
 const result=auditHistoricalRows([{...row('2026-11-02'),หวย:'unlisted'}],catalog,'2026-11-08');
 assert.equal(result.rejected[0].reason,'unknown_lottery');
 assert.throws(()=>auditHistoricalRows([],catalog,'2026-02-30'),TypeError);
});
test('does not mutate source records',()=>{
 const source=Object.freeze(row('2026-11-02'));
 auditHistoricalRows([source],catalog,'2026-11-08');
 assert.equal(source.เลขบน_3_ตัว,'007');
});

test('audits legacy Thai dates and names while keeping the lottery round distinct', () => {
 const lotteries = [
  { id: 'nikkei_vip_morning', name: 'นิเคอิเช้า VIP' },
  { id: 'nikkei_morning', name: 'นิเคอิรอบเช้า' },
 ];
 const legacy = row('2 พฤศจิกายน 2569', '007', '03', {
  หวย: 'หวยหุ้นนิคเคอิ VIP เช้า', ชื่อหวย: 'หวยหุ้นนิคเคอิ VIP เช้า',
 });
 const result = auditHistoricalRows([
  legacy,
  { ...legacy, หวย: 'nikkei_vip_morning', วันที่จัดรูปแบบ: '02.11.2026' },
  { ...legacy, หวย: 'nikkei_morning' },
 ], lotteries, '2026-11-08');
 assert.deepEqual(result.accepted.map(({ id, date }) => ({ id, date })), [
  { id: 'nikkei_vip_morning', date: '2026-11-02' },
 ]);
 assert.deepEqual(result.rejected.map(row => row.reason), ['duplicate_draw', 'unknown_lottery']);
});

test('does not assign an unregistered special round to STAR', () => {
 const result = auditHistoricalRows([
  row('2026-11-02', '007', '03', { หวย: 'หวยหุ้นดาวโจนส์พิเศษ' }),
 ], [{ id: 'dowjones_star', name: 'ดาวโจนส์ STAR' }], '2026-11-08');
 assert.deepEqual(result.rejected, [{ index: 0, reason: 'unknown_lottery' }]);
});

test('maps the legacy Hanoi special source key and withholds conflicting round labels', () => {
 const lotteries = [
  { id: 'hanoi_special', name: 'ฮานอยพิเศษ' },
  { id: 'hanoi_regular', name: 'ฮานอยปกติ' },
  { id: 'hanoi_vip', name: 'ฮานอย VIP' },
  { id: 'nikkei_vip_morning', name: 'นิเคอิเช้า VIP' },
 ];
 const result = auditHistoricalRows([
  row('2026-11-02', '007', '03', { หวย: 'hanoylottospecial', ชื่อหวย: 'หวยฮานอย รอบ 17:30' }),
  row('2026-11-03', '007', '03', { หวย: 'hanoylottospecial', ชื่อหวย: 'ฮานอยปกติ' }),
  row('2026-11-03', '007', '03', { หวย: 'หวยหุ้นนิคเคอิ VISA เช้า' }),
 ], lotteries, '2026-11-08');
 assert.deepEqual(result.accepted.map(item => item.id), ['hanoi_special']);
 assert.deepEqual(result.rejected.map(item => item.reason), ['unknown_lottery', 'unknown_lottery']);
});

test('supplemental archive has valid unique draws for the 13 catalog items', async () => {
 const { readFile } = await import('node:fs/promises');
 const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
 const [supplement, catalog] = await Promise.all([
   readJson('../supplemental-history-2026-11-22.json'),
   readJson('../bombim00-catalog.json'),
 ]);
 const { accepted, rejected } = auditHistoricalRows(supplement, catalog, '2026-11-22');
 assert.equal(accepted.length, 270);
 assert.equal(new Set(accepted.map(row => row.id)).size, 13);
 assert.deepEqual(rejected, []);
 assert.ok(accepted.every(row => /^https:\/\/(lotterychecks\.com|xn--t3cmiit\.com)\//.test(row.source)));
});
