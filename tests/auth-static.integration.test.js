import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function freePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

test('anonymous visitors can load login assets but cannot load dashboard or private APIs', { timeout: 15000 }, async () => {
  const port = await freePort();
  const password = 'integration-test-password-123';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port),
      PROJECT1_PASSWORD: password,
      PROJECT1_SESSION_SECRET: 'testing-only-secret-which-is-over-thirty-two-characters' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 8000);
      const onOutput = bytes => {
        if (String(bytes).includes('Project 1 listening')) {
          clearTimeout(timeout);
          resolve();
        }
      };
      child.stdout.on('data', onOutput);
      child.once('exit', code => {
        clearTimeout(timeout);
        reject(new Error('Server exited unexpectedly: ' + code));
      });
      child.once('error', reject);
    });

    const base = 'http://127.0.0.1:' + port;
    for (const path of ['/', '/style.css', '/login.js']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
    }
    for (const path of ['/index.html', '/app.js', '/formulas.js',
      '/independent-formulas.js', '/api/history', '/api/history-quality']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 401, path);
    }
    const login = await fetch(base + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie?.startsWith('p1session='));
    for (const path of ['/', '/index.html', '/app.js', '/independent-formulas.js']) {
      const response = await fetch(base + path, { headers: { Cookie: cookie } });
      assert.equal(response.status, 200, path);
    }
    const session = await fetch(base + '/api/me', { headers: { Cookie: cookie } });
    assert.deepEqual(await session.json(), { authenticated: true });
  } finally {
    child.kill('SIGTERM');
  }
});
