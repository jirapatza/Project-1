import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('upstream is read-only and no GitHub writes are implemented',async()=>{
 const s=await readFile(path.join(root,'bombim-source.js'),'utf8');
 assert.match(s,/raw\.githubusercontent\.com\/jirapatza\/Bombim00/);
 assert.doesNotMatch(s,/method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
});
test('private API requires authentication',async()=>{
 const s=await readFile(path.join(root,'server.js'),'utf8');
 assert.match(s,/if \(!authorized\(req\)\)/);
 assert.match(s,/HttpOnly/);
});
