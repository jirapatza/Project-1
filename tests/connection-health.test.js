import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectConnections } from '../connection-health.js';

const load = async key => ({ data: key === 'catalog' ? [{ id: 'a' }] : [{ date: '2026-11-08' }], source: 'upstream', fetchedAt: Date.parse('2026-11-08T00:00:00Z') });

test('reports available catalog/history and marks unconfigured input', async () => {
  const report = await inspectConnections({ load });
  assert.deepEqual(report.history.catalog, {
    available: true, origin: 'upstream', records: 1,
    fetchedAt: '2026-11-08T00:00:00.000Z',
  });
  assert.deepEqual(report.guideInput, { configured: false, reachable: false, currentDate: null, records: 0 });
});

test('reports upstream metadata without returning result numbers', async () => {
  const fetchImpl = async url => {
    assert.equal(url.href, 'https://example.test/api/guide-inputs');
    return Response.json({
      date: '2026-11-08', entries: [{ id: 'a', numbers: { twoDigit: ['42'] } }],
      catalog: [{ id: 'a' }], guides: [{ numbers: { threeDigit: ['123'] } }],
    });
  };
  const report = await inspectConnections({ load, guideUrl: 'https://example.test', fetchImpl });
  assert.deepEqual(report.guideInput, { configured: true, reachable: true, currentDate: '2026-11-08', records: 1 });
  assert.equal(JSON.stringify(report).includes('42'), false);
  assert.equal(JSON.stringify(report).includes('123'), false);
});

test('reports guide upstream failure without hiding history availability', async () => {
  const report = await inspectConnections({
    load: async key => {
      if (key === 'history') throw new Error('private token');
      return { data: [], source: 'archive', fetchedAt: null };
    },
    guideUrl: 'http://insecure.test',
    fetchImpl: async () => { throw Error('should not fetch'); },
  });
  assert.equal(report.history.catalog.available, true);
  assert.equal(report.history.history.available, false);
  assert.equal(report.history.history.origin, 'unavailable');
  assert.equal(report.guideInput.configured, true);
  assert.equal(report.guideInput.reachable, false);
  assert.equal(JSON.stringify(report).includes('private token'), false);
});

test('rejects invalid guide schema and HTTP failure without revealing upstream detail', async () => {
  for (const response of [Response.json({ entries: [], catalog: [] }), new Response('', { status: 503 })]) {
    const report = await inspectConnections({
      load, guideUrl: 'https://example.test', fetchImpl: async () => response,
    });
    assert.equal(report.guideInput.reachable, false);
  }
});

test('uses private service credentials only on HTTPS with redirects disabled', async () => {
  const report = await inspectConnections({
    load, guideUrl: 'https://example.test', clientId: 'test-id', clientSecret: 'test-secret',
    fetchImpl: async (url, options) => {
      assert.equal(url.href, 'https://example.test/api/guide-inputs');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers['CF-Access-Client-Id'], 'test-id');
      assert.equal(options.headers['CF-Access-Client-Secret'], 'test-secret');
      return Response.json({ date: '2026-11-23', catalog: [], entries: [] });
    },
  });
  assert.equal(report.guideInput.reachable, true);
  assert.doesNotMatch(JSON.stringify(report), /test-id|test-secret/);
});
