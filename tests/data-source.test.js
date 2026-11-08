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

test('upstream 403 cooldown uses archive instead of repeated requests',async()=>{
  const cache=new Map(), retryUntil=new Map();
  let calls=0, clock=1000;
  const options={cache,retryUntil,now:()=>clock,retryDelayMs:30000,
    fetchUpstream:async()=>{calls++;throw new Error('HTTP 403');},
    loadArchive:async()=>fixture};
  assert.equal((await loadHistoricalData('history',options)).source,'archive');
  clock=2000;
  assert.equal((await loadHistoricalData('history',options)).source,'archive');
  assert.equal(calls,1);
  clock=31000;
  await loadHistoricalData('history',options);
  assert.equal(calls,2);
});
test('successful retry clears cooldown and subsequent requests use cache',async()=>{
  const cache=new Map(),retryUntil=new Map();
  let clock=1000, attempts=0;
  const options={cache,retryUntil,now:()=>clock,retryDelayMs:1000,ttlMs:50,
    fetchUpstream:async()=>{attempts++; if(attempts===1)throw Error('unreachable');return fixture;},
    loadArchive:async()=>fixture};
  assert.equal((await loadHistoricalData('catalog',options)).source,'archive');
  clock=2200;
  assert.equal((await loadHistoricalData('catalog',options)).source,'upstream');
  assert.equal(retryUntil.has('catalog'),false);
  clock=2201;
  assert.equal((await loadHistoricalData('catalog',options)).source,'cache');
  assert.equal(attempts,2);
});
test('retry isolation keeps history outages from blocking catalog',async()=>{
  const retryUntil=new Map([['history',100000]]);
  const options={cache:new Map(),retryUntil,now:()=>2000,
    fetchUpstream:async()=>fixture,loadArchive:async()=>[]};
  assert.equal((await loadHistoricalData('catalog',options)).source,'upstream');
  assert.equal((await loadHistoricalData('history',options)).source,'archive');
});

test('concurrent history requests share a single upstream fetch', async () => {
  const cache = new Map(), retryUntil = new Map(), inFlight = new Map();
  let calls = 0, release;
  const options = {
    cache, retryUntil, inFlight, now: () => 1000,
    fetchUpstream: () => {
      calls++;
      return new Promise(resolve => { release = resolve; });
    },
    loadArchive: async () => { throw new Error('unnecessary fallback'); },
  };
  const pending = [
    loadHistoricalData('history', options),
    loadHistoricalData('history', options),
    loadHistoricalData('history', options),
  ];
  assert.equal(calls, 1);
  release(fixture);
  const results = await Promise.all(pending);
  assert.equal(results.length, 3);
  assert.ok(results.every(result => result.source === 'upstream'));
  assert.equal(inFlight.size, 0);
});

test('a failed shared fetch applies one cooldown and clears in-flight state', async () => {
  const cache = new Map(), retryUntil = new Map(), inFlight = new Map();
  let calls = 0, fail;
  const options = {
    cache, retryUntil, inFlight, now: () => 1000,
    fetchUpstream: () => {
      calls++;
      return new Promise((_, reject) => { fail = reject; });
    },
    loadArchive: async () => fixture,
  };
  const first = loadHistoricalData('history', options);
  const second = loadHistoricalData('history', options);
  assert.equal(calls, 1);
  fail(new Error('HTTP 403'));
  const results = await Promise.all([first, second]);
  assert.equal(results[0].source, 'archive');
  assert.equal(results[1].source, 'archive');
  assert.equal(inFlight.size, 0);
  assert.equal(retryUntil.get('history'), 31000);
  await loadHistoricalData('history', options);
  assert.equal(calls, 1);
});
