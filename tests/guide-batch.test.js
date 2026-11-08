import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runGuideBatch } from '../guide-batch.js';
import { createGuideStore } from '../guide-store.js';

const drawDate = '2026-11-08';
const start = new Date('2026-11-08T12:10:00Z');
const weekdays = { Daily: [0, 1, 2, 3, 4, 5, 6] };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7a0AAAAASUVORK5CYII=', 'base64');

function sampleGuide({ lotteryId }) {
  return { lotteryId, drawDate, fetchedAt: start.toISOString(),
    sourceUrl: 'https://example.test/guide',
    numbers: { standout: ['0'], running: ['9'], twoDigit: ['09'], threeDigit: ['009'] } };
}

function item(id) {
  return { id, name: id, drawDays: 'Daily', closeTimeStr: '20:00', drawTimeStr: '20:15' };
}

async function testDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'project1-guides-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('34 eligible jobs report outcomes and retry without duplicates after reopening the store', async t => {
  const directory = await testDirectory(t);
  const catalog = Array.from({ length: 34 }, (_, i) => item(`round_${i}`));
  catalog.push({ ...item('next_day'), closeTimeStr: '00:05', drawTimeStr: '00:30' });
  const confirmedDraws = catalog.slice(1).map(({ id }) => ({ lotteryId: id, drawDate }));
  let calls = 0;
  const input = { catalog, weekdays, confirmedDraws, directory, clock: () => start,
    fetchGuide: async key => {
      calls++;
      if (key.lotteryId === 'round_1') throw new Error('test_network_error');
      if (key.lotteryId === 'round_2') return { ...sampleGuide(key), drawDate: '2026-11-09' };
      return sampleGuide(key);
    },
    renderPng: async guide => {
      assert.equal(guide.lotteryName, guide.lotteryId);
      assert.deepEqual(guide.numbers.threeDigit, ['009']);
      return png;
    } };
  const first = await runGuideBatch(input);
  assert.equal(first.length, 34);
  assert.deepEqual(first.slice(0, 3).map(row => row.status),
    ['awaiting_confirmation', 'retryable_error', 'awaiting_data']);
  assert.equal(first.filter(row => row.status === 'published').length, 31);
  assert.equal(calls, 33);
  assert.equal((await readdir(directory)).length, 31);

  const retry = await runGuideBatch({ ...input, fetchGuide: async key => { calls++; return sampleGuide(key); } });
  assert.equal(retry.filter(row => row.status === 'already_published').length, 31);
  assert.equal(retry.filter(row => row.status === 'published').length, 2);
  assert.equal(calls, 35);
  assert.equal((await readdir(directory)).length, 33);
  const stored = await createGuideStore(directory).read('round_2', drawDate, start);
  assert.deepEqual(stored.png, png);
  assert.equal(stored.guide.numbers.twoDigit[0], '09');
});

test('store publishes once under concurrent writers and purges transient data at 24 hours', async t => {
  const directory = await testDirectory(t);
  const store = createGuideStore(directory);
  const catalog = [item('lao')];
  const input = { lotteryId: 'lao', drawDate, catalog, png, guide: sampleGuide({ lotteryId: 'lao' }) };
  await writeFile(join(directory, 'historical-results.json'), '[]');
  const outcomes = await Promise.all([store.publish(input, start), store.publish(input, start)]);
  assert.deepEqual(outcomes.sort(), ['already_published', 'published']);
  await assert.rejects(store.publish({ ...input, drawDate: '2026-11-09' }, start), /not_current_draw/);
  await assert.rejects(store.publish({ ...input, guide: {
    ...input.guide, numbers: { ...input.guide.numbers, twoDigit: ['09', '09'] },
  } }, start), /invalid_twoDigit/);

  const afterMidnight = new Date('2026-11-08T17:00:00Z');
  assert.equal(await store.read('lao', drawDate, afterMidnight), null);
  assert.equal(await store.purge(new Date('2026-11-09T12:09:59Z')), 0);
  assert.equal(await store.purge(new Date('2026-11-09T12:10:00Z')), 1);
  assert.deepEqual(await readdir(directory), ['historical-results.json']);
  assert.equal(await readFile(join(directory, 'historical-results.json'), 'utf8'), '[]');
});

test('an irregular draw runs only after a confirmation for the same Bangkok date', async t => {
  const directory = await testDirectory(t);
  const catalog = [{ ...item('irregular'), drawDays: 'ตามประกาศวันงวดจริง (อาจเลื่อน)' }];
  const input = { catalog, weekdays, directory, clock: () => start,
    fetchGuide: async key => sampleGuide(key), renderPng: async () => png };
  const tomorrow = [{ lotteryId: 'irregular', drawDate: '2026-11-09' }];
  assert.equal((await runGuideBatch({ ...input, confirmedDraws: tomorrow }))[0].status, 'awaiting_confirmation');
  const today = [{ lotteryId: 'irregular', drawDate }];
  assert.equal((await runGuideBatch({ ...input, confirmedDraws: today }))[0].status, 'published');
});
