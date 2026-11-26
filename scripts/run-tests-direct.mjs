#!/usr/bin/env node
// Direct test runner for environments where `node --test` is broken
// (e.g. Android where process.execPath points to the linker, not node).
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const testDir = new URL('../tests/', import.meta.url).pathname;
const files = (await readdir(testDir)).filter(f => f.endsWith('.test.js')).sort();

const results = [];
let totalPass = 0;
let totalFail = 0;

for (const file of files) {
  const fullPath = join(testDir, file);
  const child = spawn(process.argv0, [fullPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });

  const exitCode = await new Promise(resolve => child.on('exit', resolve));

  const passMatch = stdout.match(/ℹ pass (\d+)/);
  const failMatch = stdout.match(/ℹ fail (\d+)/);
  const pass = passMatch ? parseInt(passMatch[1], 10) : 0;
  const fail = failMatch ? parseInt(failMatch[1], 10) : 0;

  totalPass += pass;
  totalFail += fail;

  if (exitCode === 0) {
    console.log(`✔ ${file} (${pass} passed)`);
  } else {
    console.error(`✖ ${file} (${fail} failed)`);
    if (stderr) console.error(stderr.slice(0, 500));
  }
}

console.log(`\n${totalPass + totalFail} tests: ${totalPass} passed, ${totalFail} failed`);
process.exit(totalFail > 0 ? 1 : 0);
