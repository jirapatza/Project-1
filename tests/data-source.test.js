import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHistoricalData } from '../data-source.js';

const fixture = [{หวย:'sample',วันที่จัดรูปแบบ:'2026-11-01'}];
test('labels a successful remote response upstream then cached within TTL', async () => {
  const cache = new Map();
  let calls = 0, clock = 1000;
  const config = {cache, now:()=>clock,fetchUpstream:async()=>{calls++; return fixture;},loadArchive:async()=>[]};
  const first=await loadHistoricalData('history',config);
  assert.deepEqual(first,{data:fixture,source:'upstream',fetchedAt:1000});
  clock=2000;
  const second=await loadHistoricalData('history',config);
  assert.equal(second.source,'cache');
  assert.equal(calls,1);
});
test('uses stale cache after an upstream error and retains timestamp',async()=>{
  const cache=new Map([['history',{data:fixture,time:1000}]]);
  const result=await loadHistoricalData('history',{cache,now:()=>100000,fetchUpstream:async()=>{throw Error('403');},loadArchive:async()=>{throw Error('should not read archive')}});
  assert.deepEqual(result,{data:fixture,source:'stale-cache',fetchedAt:1000});
});
test('uses bundled archive when no cached records exist',async()=>{
  const result=await loadHistoricalData('history',{cache:new Map(),fetchUpstream:async()=>{throw Error('timeout');},loadArchive:async()=>fixture});
  assert.deepEqual(result,{data:fixture,source:'archive',fetchedAt:null});
});
test('rejects invalid data from both sources',async()=>{
  await assert.rejects(loadHistoricalData('history',{cache:new Map(),fetchUpstream:async()=>({}),loadArchive:async()=>({})}),/Invalid bundled archive/);
});
test('cannot route unknown source names into local files',async()=>{
  await assert.rejects(loadHistoricalData('../secret',{cache:new Map(),fetchUpstream:async()=>fixture,loadArchive:async()=>fixture}),/Unknown data source/);
});
