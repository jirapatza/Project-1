import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import { runGuideBatch } from './guide-batch.js';
import { createGuidePngRenderer } from './guide-png.js';
import { createGuideStore } from './guide-store.js';

const [, , inputPath, directory, option, ...extra] = process.argv;
if (!inputPath || !directory || (option !== undefined && option !== '--watch') || extra.length) {
  throw new Error('Usage: node guide-poll.mjs INPUT_JSON TRANSIENT_DIRECTORY [--watch]');
}

const keyFor = ({ lotteryId, drawDate }) => JSON.stringify([lotteryId, drawDate]);

async function readInput() {
  if (!inputPath.startsWith('https://')) return JSON.parse(await readFile(inputPath, 'utf8'));
  const response = await fetch(inputPath, { redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Guide inputs HTTP ${response.status}`);
  return response.json();
}

async function poll() {
  const { catalog, weekdays, confirmedDraws, guides, template } = await readInput();
  const inputs = new Map();
  for (const guide of guides) {
    const key = keyFor(guide);
    if (inputs.has(key)) throw new Error('duplicate_guide_input');
    inputs.set(key, guide);
  }

  let browser;
  let renderer;
  try {
    return await runGuideBatch({
      catalog, weekdays, confirmedDraws, directory,
      fetchGuide: async key => inputs.get(keyFor(key)),
      renderPng: async guide => {
        browser ??= await chromium.launch({ executablePath: process.env.GUIDE_CHROMIUM_PATH || undefined, timeout: 15000 });
        renderer ??= await createGuidePngRenderer(browser, template);
        return renderer.renderPng(guide);
      },
    });
  } finally {
    try {
      await renderer?.close();
    } finally {
      await browser?.close();
    }
  }
}

if (option === '--watch') {
  const interval = Number(process.env.GUIDE_POLL_INTERVAL_SECONDS ?? 60);
  if (!Number.isInteger(interval) || interval < 1 || interval > 300) {
    throw new Error('GUIDE_POLL_INTERVAL_SECONDS must be an integer from 1 to 300');
  }
  const stop = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop.abort());

  while (!stop.signal.aborted) {
    const startedAt = new Date();
    try {
      const results = await poll();
      console.log(JSON.stringify({ startedAt, results }));
    } catch (error) {
      const reason = error.code === 'ENOENT' ? 'missing_input' :
        error instanceof SyntaxError ? 'invalid_json' : 'poll_failed';
      console.error(JSON.stringify({ startedAt, error: reason }));
      try {
        await createGuideStore(directory).purge(startedAt);
      } catch {
        console.error(JSON.stringify({ startedAt, error: 'cleanup_failed' }));
      }
    }
    if (stop.signal.aborted) break;
    // Wait after the current poll finishes so one worker never overlaps rounds.
    await delay(interval * 1000, undefined, { signal: stop.signal }).catch(error => {
      if (error.name !== 'AbortError') throw error;
    });
  }
} else {
  console.log(JSON.stringify(await poll()));
}
