import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('dashboard opens directly and retired login endpoints return 404', { timeout: 10000 }, async () => {
  const env = { ...process.env, HOST: '127.0.0.1', PORT: '0', POSTHOG_PROJECT_TOKEN: 'test-token' };
  delete env.PROJECT1_PASSWORD;
  delete env.PROJECT1_SESSION_SECRET;
  const child = spawn(process.argv0, ['server.js'], {
    cwd: new URL('../', import.meta.url),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 6000);
      child.stdout.on('data', bytes => {
        const address = String(bytes).match(/Project 1 listening on (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
        if (address) {
          clearTimeout(timeout);
          resolve(address);
        }
      });
      child.once('exit', code => {
        clearTimeout(timeout);
        reject(new Error('Server exited unexpectedly: ' + code));
      });
      child.once('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('set-cookie'), null);
    assert.match(await page.text(), /id="calculateView"/);
    for (const route of ['/style.css', '/app.js', '/history-records.js', '/history-availability.js', '/formulas.js', '/independent-formulas.js',
      '/studio', '/studio.js', '/api/lao-backtest', '/api/publishers']) {
      assert.equal((await fetch(base + route)).status, 200, route);
    }
    for (const route of ['/index.html', '/login.html', '/login.js', '/api/me']) {
      assert.equal((await fetch(base + route)).status, 404, route);
    }
    for (const route of ['/api/login', '/api/logout']) {
      assert.equal((await fetch(base + route, { method: 'POST' })).status, 404, route);
    }
    const invalid = await fetch(base + '/api/usage', {
      method: 'POST', headers: { origin: base }, body: '{',
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), {});
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});
