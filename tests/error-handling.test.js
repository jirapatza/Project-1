import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('unexpected request errors return an incident ID without leaking internals', async () => {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      PROJECT1_PASSWORD: 'test-password-at-least-12',
      PROJECT1_SESSION_SECRET: 'test-session-secret-longer-than-32-characters',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const address = await Promise.race([
      new Promise((resolve, reject) => {
        let output = '';
        server.stdout.on('data', chunk => {
          output += chunk.toString();
          const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
          if (match) resolve(Number(match[1]));
        });
        server.once('exit', code => reject(new Error(`Server exited: ${code}`)));
        server.once('error', reject);
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Server start timeout')), 5000)),
    ]);
    const response = await fetch(`http://127.0.0.1:${address}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'x'.repeat(5000) }),
    });
    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.equal(payload.error, 'เกิดข้อผิดพลาด');
    assert.match(payload.incidentId, /^[a-f0-9]{16}$/);
    assert.equal(Object.hasOwn(payload, 'detail'), false);
    assert.equal(JSON.stringify(payload).includes('Request too large'), false);
  } finally {
    server.kill();
    await once(server, 'exit').catch(() => {});
  }
});
