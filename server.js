import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calculate, version } from './lao-snapshot.mjs';
import { archivedResults, publishers } from './publishers.js';
import { readBombimSource } from './bombim-source.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const password = process.env.PROJECT1_PASSWORD || '';
const secret = process.env.PROJECT1_SESSION_SECRET || '';
if (password.length < 12 || secret.length < 32) {
  console.error('Configure PROJECT1_PASSWORD (12+ chars) and PROJECT1_SESSION_SECRET (32+ chars)');
  process.exit(1);
}
const branch = process.env.BOMBIM_DATA_BRANCH || 'runtime-live';
const cache = new Map();
const attempts = new Map();
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(x => x.trim().split('=')).filter(x => x.length === 2));
const hmac = value => createHmac('sha256', secret).update(value).digest('hex');
function equal(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
function authorized(req) {
  const token = cookies(req).p1session || '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !equal(hmac(payload), signature)) return false;
  try { const [expires] = Buffer.from(payload, 'base64url').toString().split(':'); return Number(expires) > Date.now(); }
  catch { return false; }
}
function json(res, code, value) { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
function secureCookie(req) { return process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''; }
async function body(req) {
  let data = '';
  for await (const part of req) { data += part; if (data.length > 4096) throw new Error('Request too large'); }
  return JSON.parse(data || '{}');
}
async function upstream(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < 60000) return hit.data;
  const data = await readBombimSource(key, branch, process.env.BOMBIM_READ_TOKEN?.trim());
  cache.set(key, {time:Date.now(),data});
  return data;
}
const files = new Map(Object.entries({'/':'index.html','/app.js':'app.js','/formulas.js':'formulas.js','/independent-formulas.js':'independent-formulas.js','/style.css':'style.css'}));
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  try {
    if (pathname === '/api/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const entry = attempts.get(ip) || {count:0,until:now+15*60000};
      if (now > entry.until) {entry.count=0;entry.until=now+15*60000;}
      if (entry.count >= 10) return json(res,429,{error:'ลองเข้าสู่ระบบใหม่ภายหลัง'});
      const submitted = String((await body(req)).password || '');
      if (!equal(submitted,password)) {entry.count++;attempts.set(ip,entry);return json(res,401,{error:'รหัสผ่านไม่ถูกต้อง'});}
      attempts.delete(ip);
      const payload = Buffer.from(`${now+30*86400000}:${randomBytes(16).toString('hex')}`).toString('base64url');
      res.setHeader('Set-Cookie',`p1session=${payload}.${hmac(payload)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secureCookie(req)}`);
      return json(res,200,{ok:true});
    }
    if (pathname === '/api/me' && req.method === 'GET') return json(res,200,{authenticated:authorized(req)});
    if (pathname === '/api/logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie',`p1session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie(req)}`);
      return json(res,200,{ok:true});
    }
    if (!authorized(req)) {
      if (pathname.startsWith('/api/')) return json(res,401,{error:'กรุณาเข้าสู่ระบบ'});
      if (pathname === '/' || files.get(pathname)) {
        if (pathname === '/') {const page=await readFile(path.join(root,'public','login.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(page);return;}
        if (pathname === '/style.css' || pathname === '/app.js') { /* login page needs styles and script */ }
      }
    }
    if (pathname === '/api/publishers' && req.method === 'GET') {
      const lao = JSON.parse(await readFile(path.join(root, 'lao-history-63.json'), 'utf8'));
      const dates = new Set(publishers.filter(row => row.lottery === 'lao_patthana').map(row => row.date));
      const results = [...archivedResults, ...lao.filter(row => dates.has(row.date)).map(row => ({
        ...row, lottery: 'lao_patthana', source: 'https://lottoth.co/lottery/laosdevelops/history',
      }))];
      return json(res, 200, { publishers, results });
    }
    if (pathname === '/api/usage' && req.method === 'POST') {
      if (!process.env.POSTHOG_PROJECT_TOKEN) return json(res, 200, { enabled: false });
      if (req.headers.origin !== 'https://' + req.headers.host &&
          req.headers.origin !== 'http://' + req.headers.host) return json(res, 403, {});
      const { menu } = await body(req);
      if (!['home', 'calculate', 'stats', 'publishers'].includes(menu)) return json(res, 400, {});
      const response = await fetch('https://us.i.posthog.com/capture/', {
        method: 'POST', signal: AbortSignal.timeout(2500),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.POSTHOG_PROJECT_TOKEN,
          event: 'project1_menu_selected',
          properties: { distinct_id: 'project1_aggregate', menu, $process_person_profile: false, $geoip_disable: true },
        }),
      });
      return json(res, response.ok ? 200 : 502, { enabled: true });
    }
    if (pathname === '/api/lao-backtest' && req.method === 'GET') {
      const rows = JSON.parse(await readFile(path.join(root, 'lao-history-63.json'), 'utf8'));
      const results = rows.slice(-30).map((draw, offset) => {
        const index = rows.length - 30 + offset;
        const history = rows.slice(index - 30, index);
        const { run, exact3 } = calculate(history);
        return { ...draw, run, exact3, runHit: run.some(n => draw.bottom2.includes(n)),
          exactRank: exact3.indexOf(draw.top3) + 1 };
      });
      return json(res, 200, { version, results: results.reverse() });
    }
    if ((pathname === '/api/catalog' || pathname === '/api/history') && req.method === 'GET') {
      const key = pathname === '/api/catalog' ? 'catalog' : 'history';
      let data;
      try {
        data = await upstream(key);
        res.setHeader('X-Project1-Data', 'live');
      } catch {
        data = cache.get(key)?.data ?? JSON.parse(await readFile(path.join(root, `bombim00-${key}.json`), 'utf8'));
        res.setHeader('X-Project1-Data', 'archive');
      }
      return json(res, 200, data);
    }
    const name = files.get(pathname) || (pathname === '/login.js' ? 'login.js' : null);
    if (!name) return json(res,404,{error:'Not found'});
    const data = await readFile(path.join(root,'public',name));
    const type = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html';
    res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store'});res.end(data);
  } catch (e) { json(res,502,{error:'เกิดข้อผิดพลาด',detail:String(e.message)}); }
});
server.listen(PORT,HOST,()=>console.log(`Project 1 listening on http://${HOST}:${PORT}`));
