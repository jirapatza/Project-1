import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker, { collectGuideInputs } from '../cloudflare/guide-input-worker.js';
import { parsePublishedGuide, guideSourceUrl } from '../guide-input-source.js';

const date = '2026-11-08';
const observedAt = Date.parse(date + 'T09:20:00Z');
const closeAt = Date.parse(date + 'T10:05:00Z');
const url = guideSourceUrl('hanoi_special', date, '17:30 น.');
const body = (source = url, modified = date + 'T03:00:00Z') => `
<script type="application/ld+json">${JSON.stringify({
  '@type': 'Article', url: source, datePublished: date + 'T02:00:00Z', dateModified: modified,
})}</script>
<table><thead><tr><th>สำนัก</th><th>เลขสองตัว</th><th>เลขสามตัว</th></tr></thead>
<tbody><tr><td>A</td><td>01 02 03 04</td><td>001 002 003</td></tr>
<tr><td>B</td><td>04 05 06 07 08</td><td>002 004 005 006</td></tr></tbody></table>`;

test('keeps provider rounds separate, preserves zeros and rejects wrong dates or late updates', () => {
  assert.equal(guideSourceUrl('hanoi_special', date, '18:30'), null);
  assert.equal(guideSourceUrl('hanoi_asean', date, '17:30'), null);
  assert.equal(parsePublishedGuide(body(url.replace(date, '2026-11-07')), url, observedAt, closeAt), null);
  assert.equal(parsePublishedGuide(body(url, date + 'T11:00:00Z'), url, closeAt + 3600000, closeAt), null);
  const source = parsePublishedGuide(body(), url, observedAt, closeAt);
  assert.equal(source.numbers.twoDigit[0], '04');
  assert.equal(source.numbers.threeDigit[0], '002');
  assert.deepEqual(source.numbers.standout, []);
});

test('scheduled intake serves complete current-day data within the renderer window and purges it', {
  skip: Number(process.versions.node.split('.')[0]) < 22,
}, async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  for (const name of ['schema.sql', 'guide-schema.sql']) {
    sql.exec(await readFile(new URL('../cloudflare/' + name, import.meta.url), 'utf8'));
  }
  const db = {
    prepare(query) {
      const statement = sql.prepare(query);
      return {
        first: async () => statement.get(),
        bind: (...args) => ({
          run: async () => statement.run(...args),
          all: async () => ({ results: statement.all(...args) }),
        }),
      };
    },
  };
  const catalog = [{ id: 'hanoi_special', name: 'ฮานอยพิเศษ',
    drawDays: 'ทุกวัน (จันทร์ - อาทิตย์)', closeTimeStr: '17:05 น.', drawTimeStr: '17:30 น.' }];
  const history = [{ หวย: 'hanoi_special', วันที่จัดรูปแบบ: '2026-11-07', เลขบน_3_ตัว: '013', เลขล่าง_2_ตัว: '45' }];
  let now = observedAt;
  sql.prepare('INSERT INTO history_snapshot VALUES (1, ?, ?, ?)').run(JSON.stringify(catalog), JSON.stringify(history), now);
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  const fetchSource = async () => {
    calls++;
    return new Response(body(), { headers: { 'content-type': 'text/html' } });
  };
  const reports = await collectGuideInputs(db, Date.now, fetchSource);
  assert.deepEqual(reports.reports, [{ id: 'hanoi_special', status: 'ready', sourceStatus: 'published' }]);
  await collectGuideInputs(db, Date.now, fetchSource);
  assert.equal(calls, 1);
  const request = new Request('https://test.example/api/guide-inputs');
  const response = await worker.fetch(request, { HISTORY_DB: db });
  const payload = await response.json();
  assert.deepEqual(payload.confirmedDraws, [{ lotteryId: 'hanoi_special', drawDate: date }]);
  assert.equal(payload.guides[0].numbers.twoDigit.length, 8);
  assert.equal(payload.entries[0].provenance.standoutFrom, 'history_formula');
  assert.ok(payload.entries[0].runningDoubles.every(number => /^([0-9])\1$/.test(number)));
  now += 24 * 60 * 60 * 1000;
  await assert.rejects(collectGuideInputs(db, Date.now, fetchSource), /snapshot unavailable/);
  assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM guide_inputs').get().count, 0);
  assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM history_snapshot').get().count, 1);
});

test('stock cards require a same-day page and one exact round header', async () => {
  const { parseStockGuide } = await import('../guide-input-source.js');
  const stock = `<link rel="canonical" href="https://leklnw.com/huay-ai-stock/" />
  <meta property="article:modified_time" content="2026-11-06T00:20:00Z" />
  <h1>AI ใบ้หวย หวยหุ้น 6/11/2569</h1>
  <table><tr><th>หวยหุ้นนิเคอิรอบเช้า</th></tr>
  <tr><td>เลขเด่น วิ่ง/รูด</td><td>0 &#8211; 9</td></tr>
  <tr><td>จับคู่ 2 ตัวเด่น</td><td>09 – 90 – 01 – 10<br>02 – 20 – 08 – 80</td></tr>
  <tr><td>จับคู่ 3 ตัวเด่น</td><td>009 – 090 – 098 – 980</td></tr></table>`;
  const today = '2026-11-06';
  const observed = Date.parse(today + 'T01:00:00Z'), close = Date.parse(today + 'T02:00:00Z');
  const source = parseStockGuide(stock, 'nikkei_morning', today, observed, close);
  assert.deepEqual(source.numbers.standout, ['0', '9']);
  assert.equal(source.numbers.twoDigit.length, 8);
  assert.equal(source.numbers.threeDigit[0], '009');
  assert.equal(parseStockGuide(stock, 'nikkei_afternoon', today, observed, close), null);
  assert.equal(parseStockGuide(stock, 'nikkei_morning', '2026-11-07', observed, close), null);
});
