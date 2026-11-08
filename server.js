import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calculate, version } from './lao-snapshot.mjs';
import { archivedResults, publishers } from './publishers.js';
import { readBombimSource } from './bombim-source.js';
import { readHistoryApi } from './history-api-source.js';
import { publicSnapshot } from './snapshot-validation.js';
import { loadHistoricalData } from './data-source.js';
import { summarizeHistoryQuality, bangkokDate } from './history-quality.js';
import { summarizeHistoryCoverage } from './history-coverage.js';
import { inspectConnections } from './connection-health.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const branch = process.env.BOMBIM_DATA_BRANCH || 'runtime-live';
const historyApi = process.env.PROJECT1_HISTORY_API?.trim();
const guideApi = process.env.PROJECT1_GUIDE_API?.trim();
const readSource = historyApi
  ? key => readHistoryApi(key, historyApi)
  : async key => publicSnapshot(key, await readBombimSource(key, branch, process.env.BOMBIM_READ_TOKEN?.trim()));
const cache = new Map();
const retryUntil = new Map();
const inFlight = new Map();
function json(res, code, value) { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
async function body(req) {
  let data = '';
  for await (const part of req) { data += part; if (data.length > 4096) throw new Error('Request too large'); }
  return JSON.parse(data || '{}');
}
async function upstream(key) {
  return loadHistoricalData(key, {
    cache, retryUntil, inFlight,
    fetchUpstream: readSource,
    loadArchive: async source => JSON.parse(await readFile(path.join(root, `bombim00-${source}.json`), 'utf8')),
  });
}
const files = new Map(Object.entries({
  '/': 'index.html',
  '/app.js': 'app.js',
  '/formulas.js': 'formulas.js',
  '/independent-formulas.js': 'independent-formulas.js',
  '/style.css': 'style.css',
  '/history-records.js': 'history-records.js',
  '/history-availability.js': 'history-availability.js',
  '/studio': 'studio.html',
  '/studio.css': 'studio.css',
  '/studio.js': 'studio.js',
  '/guide-geometry.js': 'guide-geometry.js',
  '/guide-template.js': 'guide-template.js',
  '/guide-renderer.js': 'guide-renderer.js',
}));
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  const studioImages = pathname === '/studio' ? "; img-src 'self' data:" : '';
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" + studioImages);

  try {
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
      let payload;
      try {
        payload = await body(req);
      } catch {
        return json(res, 400, {});
      }
      const menu = payload?.menu;
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
    if (pathname === '/api/guide-inputs' && req.method === 'GET') {
      if (!guideApi) return json(res, 503, { error: 'ยังไม่ได้เชื่อมแหล่งข้อมูลใบแนว' });
      const endpoint = new URL('/api/guide-inputs', guideApi);
      if (endpoint.protocol !== 'https:') return json(res, 503, { error: 'แหล่งข้อมูลใบแนวไม่พร้อม' });
      const upstream = await fetch(endpoint, {
        redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/json' },
      });
      if (!upstream.ok) return json(res, 503, { error: 'แหล่งข้อมูลใบแนวไม่พร้อม' });
      return json(res, 200, await upstream.json());
    }
    if (pathname === '/api/connection-status' && req.method === 'GET') {
      const report = await inspectConnections({ load: upstream, guideUrl: guideApi });
      return json(res, 200, report);
    }
    if (pathname === '/api/history-coverage' && req.method === 'GET') {
      const [catalog, history] = await Promise.all([upstream('catalog'), upstream('history')]);
      const report = summarizeHistoryCoverage(history.data, catalog.data, bangkokDate());
      return json(res, 200, report);
    }
    if (pathname === '/api/history-quality' && req.method === 'GET') {
      const [catalog, history] = await Promise.all([upstream('catalog'), upstream('history')]);
      const summary = summarizeHistoryQuality(history.data, catalog.data, bangkokDate());
      return json(res, 200, {
        ...summary,
        sources: {
          catalog: { origin: catalog.source, fetchedAt: catalog.fetchedAt == null ? null : new Date(catalog.fetchedAt).toISOString() },
          history: { origin: history.source, fetchedAt: history.fetchedAt == null ? null : new Date(history.fetchedAt).toISOString() },
        },
      });
    }
    if ((pathname === '/api/catalog' || pathname === '/api/history') && req.method === 'GET') {
      const key = pathname === '/api/catalog' ? 'catalog' : 'history';
      const snapshot = await upstream(key);
      res.setHeader('X-Project1-Data', snapshot.source);
      if (snapshot.fetchedAt != null) res.setHeader('X-Project1-Fetched-At', new Date(snapshot.fetchedAt).toISOString());
      return json(res, 200, snapshot.data);
    }
    const name = files.get(pathname);
    if (!name) return json(res,404,{error:'Not found'});
    const data = await readFile(path.join(root,'public',name));
    const type = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html';
    res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store'});res.end(data);
  } catch {
    const incidentId = randomUUID();
    console.error(JSON.stringify({ event: 'request_error', incidentId }));
    if (!res.headersSent) json(res, 502, { error: 'เกิดข้อผิดพลาด', incidentId });
    else res.end();
  }
});
server.listen(PORT, HOST, () => {
  console.log(`Project 1 listening on http://${HOST}:${server.address().port}`);
});
