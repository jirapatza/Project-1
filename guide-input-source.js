import { bangkokDate } from './public/history-records.js';

const markets = Object.freeze({
  hanoi_regular: { slug: 'hanoi-normal', drawTime: '18:30', fallbackHeading: 'หวยฮานอยปกติ' },
  hanoi_special: { slug: 'hanoi-special', drawTime: '17:30', fallbackHeading: 'หวยฮานอยพิเศษ' },
  hanoi_vip: { slug: 'hanoi-vip', drawTime: '19:30', fallbackHeading: 'หวยฮานอย VIP' },
  lao_patthana: { slug: 'lao-development', drawTime: '20:30' },
});

const stockUrl = 'https://leklnw.com/huay-ai-stock/';
const hanoiFallbackUrl = 'https://leklnw.com/all-huay/';
const stockHeadings = Object.freeze({
  nikkei_morning: 'หวยหุ้นนิเคอิรอบเช้า',
  nikkei_afternoon: 'หวยหุ้นนิเคอิรอบบ่าย',
  hangseng_morning: 'หวยหุ้นฮั่งเส็งรอบเช้า',
  hangseng_afternoon: 'หวยหุ้นฮั่งเส็งรอบบ่าย',
  china_morning: 'หวยหุ้นจีนรอบเช้า',
  china_afternoon: 'หวยหุ้นจีนรอบบ่าย',
  korea: 'หวยหุ้นเกาหลี',
  singapore: 'หวยหุ้นสิงคโปร์',
  taiwan: 'หวยหุ้นไต้หวัน',
  india: 'หวยหุ้นอินเดีย',
  russia: 'หวยหุ้นรัสเซีย',
  germany: 'หวยหุ้นเยอรมัน',
  england: 'หวยหุ้นอังกฤษ',
});

export function guideSourceUrl(lotteryId, date, drawTime) {
  if (Object.hasOwn(stockHeadings, lotteryId)) return stockUrl;
  const market = Object.hasOwn(markets, lotteryId) ? markets[lotteryId] : null;
  if (!market || market.drawTime !== String(drawTime).match(/^\d{2}:\d{2}/)?.[0]) return null;
  return `https://lotterychecks.com/lucky-picks/${market.slug}/${date}`;
}

export function guideSourceUrls(lotteryId, date, drawTime) {
  const primary = guideSourceUrl(lotteryId, date, drawTime);
  if (!primary) return [];
  return markets[lotteryId]?.fallbackHeading ? [primary, hanoiFallbackUrl] : [primary];
}

const plain = value => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();

function tokens(value, width) {
  return value.split(/[\s,]+/).filter(digit => digit.length === width && /^[0-9]+$/.test(digit));
}

export function parsePublishedGuide(html, sourceUrl, observedAt, closeAt) {
  const article = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(([, json]) => {
      try { return JSON.parse(json); } catch { return null; }
    }).find(value => value?.['@type'] === 'Article' && value.url === sourceUrl);
  if (!article) return null;
  const publishedAt = Date.parse(article.datePublished);
  const modifiedAt = Date.parse(article.dateModified ?? article.datePublished);
  if (!Number.isFinite(publishedAt) || !Number.isFinite(modifiedAt) || publishedAt > modifiedAt ||
      modifiedAt > observedAt || modifiedAt >= closeAt) return null;

  const counts = { twoDigit: new Map(), threeDigit: new Map(), standout: new Map(), running: new Map() };
  let matchedTables = 0;
  function add(key, publisher, values) {
    for (const value of new Set(values)) {
      const publishers = counts[key].get(value) ?? new Set();
      publishers.add(publisher);
      counts[key].set(value, publishers);
    }
  }
  for (const [table] of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const headings = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(([, cell]) => plain(cell)).join('|');
    const columns = headings === 'สำนัก|เลขสองตัว|เลขสามตัว' || headings === 'สำนัก|สองตัว|สามตัว';
    if (!columns && headings !== 'สำนัก|ประเภทเลข|เลขที่ประกาศ') continue;
    matchedTables++;
    for (const [row] of table.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
      const [publisher, second, third, ...extra] = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
        .map(([, cell]) => plain(cell));
      if (!publisher || !second || !third || extra.length) continue;
      if (columns) {
        add('twoDigit', publisher, tokens(second, 2));
        add('threeDigit', publisher, tokens(third, 3));
      } else {
        const keys = { สองตัว: ['twoDigit', 2], สามตัว: ['threeDigit', 3],
          เลขเด่น: ['standout', 1], เลขวิ่ง: ['running', 1] };
        const target = Object.hasOwn(keys, second) ? keys[second] : null;
        if (target) add(target[0], publisher, tokens(third, target[1]));
      }
    }
  }
  if (!matchedTables || (!counts.twoDigit.size && !counts.threeDigit.size)) return null;
  const numbers = Object.fromEntries(Object.entries(counts).map(([key, values]) => [key,
    [...values].sort((a, b) => b[1].size - a[1].size).map(([value]) => value),
  ]));
  return { sourceUrl, publishedAt: new Date(publishedAt).toISOString(), modifiedAt: new Date(modifiedAt).toISOString(), numbers };
}

export function parseStockGuide(html, lotteryId, date, observedAt, closeAt) {
  if (!Object.hasOwn(stockHeadings, lotteryId)) return null;
  return parseLekLNWGuide(html, stockUrl, 'หวยหุ้น', stockHeadings[lotteryId], date, observedAt, closeAt);
}

function parseLekLNWGuide(html, url, group, marketHeading, date, observedAt, closeAt) {
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
  const heading = plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const prefix = `AI ใบ้หวย ${group} `;
  if (canonical !== url || !heading.startsWith(prefix)) return null;
  const target = heading.slice(prefix.length).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!target) return null;
  const [, day, month, year] = target;
  const iso = `${Number(year) >= 2400 ? Number(year) - 543 : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const modified = html.match(/<meta\s+property=["']article:modified_time["']\s+content=["']([^"']+)["']/i)?.[1];
  const stamp = Date.parse(modified);
  if (iso !== date || !Number.isFinite(stamp) || bangkokDate(new Date(stamp)) !== date ||
      stamp > observedAt || stamp >= closeAt) return null;

  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].filter(([table]) =>
    plain(table.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i)?.[1] ?? '') === marketHeading,
  );
  if (tables.length !== 1) return null;
  const known = { 'เลขเด่น วิ่ง/รูด': ['standout', 1], 'จับคู่ 2 ตัวเด่น': ['twoDigit', 2],
    'จับคู่ 3 ตัวเด่น': ['threeDigit', 3] };
  const numbers = { standout: [], running: [], twoDigit: [], threeDigit: [] };
  for (const [row] of tables[0][0].matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
    const [label, value] = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, cell]) => plain(cell));
    if (!value || !Object.hasOwn(known, label)) continue;
    const [key, width] = known[label];
    const parts = value.replace(/&(?:#\d+|#x[0-9a-f]+|ndash|mdash);/gi, ' ').match(/[0-9]+/g) ?? [];
    numbers[key] = [...new Set(parts.filter(digit => digit.length === width))];
  }
  if (!numbers.twoDigit.length || !numbers.threeDigit.length) return null;
  numbers.running = [...numbers.standout];
  return { sourceUrl: url, publishedAt: null, modifiedAt: new Date(stamp).toISOString(), numbers };
}

export async function readGuideSourcePage(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(6500),
    headers: { Accept: 'text/html' },
  });
  if (response.status === 404) return null;
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
    throw new Error(`Guide source HTTP ${response.status}`);
  }
  if (Number(response.headers.get('content-length')) > 1_100_000) throw new Error('Guide source page too large');
  const html = await response.text();
  if (html.length > 1_100_000) throw new Error('Guide source page too large');
  return html;
}

export function parseGuideSourcePage(html, url, lotteryId, date, observedAt, closeAt) {
  if (!html) return null;
  if (url === stockUrl) return parseStockGuide(html, lotteryId, date, observedAt, closeAt);
  if (url === hanoiFallbackUrl) {
    const heading = markets[lotteryId]?.fallbackHeading;
    return heading ? parseLekLNWGuide(html, url, 'หวยลาวและหวยฮานอย', heading, date, observedAt, closeAt) : null;
  }
  return parsePublishedGuide(html, url, observedAt, closeAt);
}
