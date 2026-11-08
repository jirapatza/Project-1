const markets = Object.freeze({
  hanoi_regular: { slug: 'hanoi-normal', drawTime: '18:30' },
  hanoi_special: { slug: 'hanoi-special', drawTime: '17:30' },
  hanoi_vip: { slug: 'hanoi-vip', drawTime: '19:30' },
  lao_patthana: { slug: 'lao-development', drawTime: '20:30' },
});

export function guideSourceUrl(lotteryId, date, drawTime) {
  const market = Object.hasOwn(markets, lotteryId) ? markets[lotteryId] : null;
  if (!market || market.drawTime !== String(drawTime).match(/^\d{2}:\d{2}/)?.[0]) return null;
  return `https://lotterychecks.com/lucky-picks/${market.slug}/${date}`;
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
    const columns = headings === 'สำนัก|เลขสองตัว|เลขสามตัว';
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

export async function readPublishedGuide(url, closeAt, clock = Date.now, fetchImpl = fetch) {
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
  return parsePublishedGuide(html, url, clock(), closeAt);
}
