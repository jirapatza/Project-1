import test from 'node:test';
import assert from 'node:assert/strict';
import {thaiDate,acceptCurrentDraw,shouldDeleteTransient} from '../guide-retention.js';
test('current draw uses Bangkok midnight and rejects past/future draws',()=>{
 const now=new Date('2026-11-07T17:00:00Z');
 assert.equal(thaiDate(now),'2026-11-08');
 assert.equal(acceptCurrentDraw('2026-11-08',now),true);
 for(const date of ['2026-11-07','2026-11-09','08/11/2026',null]) assert.equal(acceptCurrentDraw(date,now),false);
});
test('transient images and guides expire at exactly 24 hours, never historical results',()=>{
 const createdAt='2026-11-07T06:00:00Z';
 for(const kind of ['external-guide','generated-poster']) {
  assert.equal(shouldDeleteTransient({kind,createdAt},new Date('2026-11-08T05:59:59Z')),false);
  assert.equal(shouldDeleteTransient({kind,createdAt},new Date('2026-11-08T06:00:00Z')),true);
 }
 assert.equal(shouldDeleteTransient({kind:'historical-result',createdAt},new Date('2027-01-01')),false);
 assert.throws(()=>shouldDeleteTransient({kind:'external-guide',createdAt:'bad'}));
});
