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
