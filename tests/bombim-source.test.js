import test from 'node:test';
import assert from 'node:assert/strict';
import { readBombimSource } from '../bombim-source.js';
import { readHistorySource } from '../history-api-source.js';

test('uses read-only authenticated GitHub API for a private history', async () => {
  let request;
  const result = await readBombimSource('history', 'runtime-live', 'test-token', async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => [{ date: '2026-11-05' }] };
  });
  assert.deepEqual(result, [{ date: '2026-11-05' }]);
  assert.equal(request.url, 'https://api.github.com/repos/jirapatza/Bombim00/contents/lottery_previous_results.json?ref=runtime-live');
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  assert.equal(request.options.redirect, 'manual');
});

test('public catalog fetch never sends a token', async () => {
  await readBombimSource('catalog', 'runtime-live', '', async (url, options) => {
    assert.equal(url, 'https://raw.githubusercontent.com/jirapatza/Bombim00/main/data/all_lotteries.json');
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, json: async () => [] };
  });
});

test('rejects unexpected sources and bad responses', async () => {
  await assert.rejects(readBombimSource('settings', 'main', 'test-token'), /Unknown data source/);
  await assert.rejects(readBombimSource('history', 'main', '', async () => ({ ok: false, status: 403 })), /HTTP 403/);
  await assert.rejects(readBombimSource('history', 'main', 'test-token', async () => ({ ok: false, status: 302 })), /HTTP 302/);
  await assert.rejects(readBombimSource('history', 'main', '', async () => ({ ok: true, json: async () => ({}) })), /Unexpected upstream/);
});

test('uses the valid mirror without sending GitHub credentials to it', async () => {
  const data = [{ id: 'one', name: 'One' }];
  const result = await readHistorySource('catalog', {
    historyApi: 'https://mirror.example', branch: 'runtime-live', token: 'test-token',
    fetchImpl: async (url, options) => {
      assert.equal(String(url), 'https://mirror.example/api/catalog');
      assert.equal(options.headers.Authorization, undefined);
      return new Response(JSON.stringify(data), {
        headers: { 'X-Project1-Fetched-At': new Date().toISOString() },
      });
    },
  });
  assert.deepEqual(result.data, data);
});

test('an expired mirror and an unusable credential fall back to validated public data', async () => {
  const calls = [];
  const result = await readHistorySource('catalog', {
    historyApi: 'https://mirror.example', branch: 'runtime-live', token: 'test-token',
    fetchImpl: async (url, options) => {
      const { hostname } = new URL(url);
      calls.push([hostname, Boolean(options.headers.Authorization)]);
      if (hostname === 'mirror.example') {
        return new Response('[]', { headers: { 'X-Project1-Fetched-At': '2025-01-01T00:00:00Z' } });
      }
      if (hostname === 'api.github.com') return new Response('', { status: 403 });
      return Response.json([{ id: 'one', name: 'One', extra: 'discard' }]);
    },
  });
  assert.deepEqual(calls, [['mirror.example', false], ['api.github.com', true], ['raw.githubusercontent.com', false]]);
  assert.deepEqual(result, [{ id: 'one', name: 'One' }]);
});

test('rejects invalid direct data so the historical loader can use its archive', async () => {
  await assert.rejects(readHistorySource('history', {
    branch: 'runtime-live', fetchImpl: async () => Response.json([{ invalid: true }]),
  }), /No usable historical records/);
});
