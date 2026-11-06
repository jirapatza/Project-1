import test from 'node:test';
import assert from 'node:assert/strict';
import { readBombimSource } from '../bombim-source.js';

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
  assert.equal(request.options.redirect, 'error');
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
  await assert.rejects(readBombimSource('history', 'main', '', async () => ({ ok: true, json: async () => ({}) })), /Unexpected upstream/);
});
