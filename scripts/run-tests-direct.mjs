#!/usr/bin/env node
// Direct test runner for environments where `node --test` is broken
// (e.g. Android where process.execPath points to the linker, not node).
import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

// PROJECT1_TEST_DIR lets a test point the runner at a scratch directory.
const testDir = process.env.PROJECT1_TEST_DIR || new URL('../tests/', import.meta.url).pathname;
const files = (await readdir(testDir)).filter(f => f.endsWith('.test.js')).sort();

let totalPass = 0;
let totalFail = 0;
let broken = 0;

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
    // A crash before the TAP summary reports zero failures; it is still a failure.
    if (fail === 0) broken++;
    console.error(`✖ ${file} (${fail} failed)`);
    if (stderr) console.error(stderr.slice(0, 500));
  }
}

console.log(`\n${totalPass + totalFail} tests: ${totalPass} passed, ${totalFail} failed, ${broken} crashed`);
process.exit(totalFail > 0 || broken > 0 ? 1 : 0);
