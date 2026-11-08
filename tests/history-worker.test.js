import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../cloudflare/history-worker.js';
import { readHistoryApi } from '../history-api-source.js';
import { loadHistoricalData } from '../data-source.js';

test('one D1 snapshot supplies both endpoints and survives failed or older refreshes', {
  skip: Number(process.versions.node.split('.')[0]) < 22,
}, async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  database.exec(await readFile(new URL('../cloudflare/schema.sql', import.meta.url), 'utf8'));
  const env = {
    HISTORY_DB: {
      prepare(sql) {
        const statement = database.prepare(sql);
        return {
          first: async () => statement.get(),
          bind: (...args) => ({ run: async () => statement.run(...args) }),
        };
      },
    },
  };
  const base = 'https://history.example';
  const endpoint = (path, method) => worker.fetch(new Request(base + path, { method }), env);
  assert.equal((await endpoint('/api/history')).status, 503);
  assert.equal((await endpoint('/api/history', 'POST')).status, 404);
  assert.equal((await endpoint('/api/other')).status, 404);

  const now = Date.now();
  const catalog = [{ id: 'test', name: 'Sample', drawDays: [1], internalSetting: 'hidden' }];
  const row = { หวย: 'test', วันที่จัดรูปแบบ: '2026-11-02', เลขบน_3_ตัว: '009',
    เลขล่าง_2_ตัว: '01', notification_channels: ['hidden'] };
  let history = [row];
  t.mock.method(globalThis, 'fetch', async url => Response.json(
    String(url).includes('all_lotteries.json') ? catalog : history,
  ));
  await worker.scheduled({ scheduledTime: now }, env);
  const requestWorker = url => worker.fetch(new Request(url), env);
  assert.deepEqual(await readHistoryApi('catalog', base, requestWorker),
    { data: [{ id: 'test', name: 'Sample', drawDays: [1] }], fetchedAt: now });
  const options = { cache: new Map(), fetchUpstream: key => readHistoryApi(key, base, requestWorker),
    loadArchive: async () => [] };
  const initial = await loadHistoricalData('history', options);
  assert.equal(initial.source, 'upstream');
  assert.equal(initial.fetchedAt, now);
  assert.equal(initial.data[0].เลขบน_3_ตัว, '009');
  assert.equal(initial.data[0].notification_channels, undefined);
  assert.equal((await loadHistoricalData('history', options)).fetchedAt, now);

  history = [];
  await assert.rejects(worker.scheduled({ scheduledTime: now + 1000 }, env), /Empty/);
  history = [{ ...row, เลขบน_3_ตัว: '010' }];
  await worker.scheduled({ scheduledTime: now - 1000 }, env);
  assert.equal((await readHistoryApi('history', base, requestWorker)).data[0].เลขบน_3_ตัว, '009');
  database.exec('UPDATE history_snapshot SET fetched_at = 0');
  assert.equal((await endpoint('/api/history')).status, 503);
});
