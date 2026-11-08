import weekdays from './draw-weekdays.js';
import { bangkokDate } from '../public/history-records.js';
import { auditSchedule } from '../guide-schedule.js';
import { guideSourceUrl, readPublishedGuide } from '../guide-input-source.js';
import { indexGuideHistory, prepareGuideInput } from '../guide-inputs.js';

const minute = 60_000;
const retentionMs = 24 * 60 * minute;
const historyUrl = 'https://project1-history.jirapatcip2557.workers.dev/api/history';

async function readSnapshot(db, now) {
  const snapshot = await db.prepare('SELECT catalog, history, fetched_at FROM history_snapshot WHERE id = 1').first();
  if (!snapshot || now - snapshot.fetched_at > 20 * minute || snapshot.fetched_at > now) {
    throw new Error('Current historical snapshot unavailable');
  }
  return { catalog: JSON.parse(snapshot.catalog), history: JSON.parse(snapshot.history), fetchedAt: snapshot.fetched_at };
}

async function readInputs(db, date, now) {
  const { results } = await db.prepare(
    'SELECT lottery_id, checked_at, payload FROM guide_inputs WHERE draw_date = ? AND expires_at > ? ORDER BY lottery_id',
  ).bind(date, now).all();
  return results.map(row => ({ id: row.lottery_id, checkedAt: row.checked_at, ...JSON.parse(row.payload) }));
}

export async function collectGuideInputs(db, clock = Date.now, fetchImpl = fetch) {
  const now = clock();
  const date = bangkokDate(new Date(now));
  await db.prepare('DELETE FROM guide_inputs WHERE expires_at <= ?').bind(now).run();
  const { catalog, history } = await readSnapshot(db, now);
  const schedule = auditSchedule(catalog, weekdays, date);
  const prior = new Map((await readInputs(db, date, now)).map(row => [row.id, row]));
  const indexed = indexGuideHistory(catalog, history);

  const candidates = schedule.flatMap(row => {
    if (row.status !== 'matches_weekly_rule') return [];
    const startAt = Date.parse(row.startAt), deadline = Date.parse(row.targetReadyAt);
    if (now > deadline) return [];
    const url = guideSourceUrl(row.id, date, row.drawTime);
    if (now < startAt && !url) return [];
    const last = prior.get(row.id);
    // Refresh hourly while prefetched and once at the start of the render window.
    if (last && (now < startAt ? now - last.checkedAt < 60 * minute : last.checkedAt >= startAt && last.status === 'ready')) return [];
    return [{ row, url, deadline }];
  });

  const reports = await Promise.all(candidates.map(async ({ row, url, deadline }) => {
    let external;
    let sourceStatus = url ? 'missing' : 'unmapped';
    if (url) {
      try {
        external = await readPublishedGuide(url, Date.parse(row.closeAt), clock, fetchImpl);
        if (external) sourceStatus = 'published';
      } catch {
        sourceStatus = 'unreachable';
        if (prior.get(row.id)?.status === 'ready') return { id: row.id, status: 'kept_ready' };
      }
    }
    const observedAt = clock();
    if (observedAt > deadline || bangkokDate(new Date(observedAt)) !== date) return { id: row.id, status: 'late' };
    const payload = {
      ...prepareGuideInput({ row, date, catalog, history: indexed.get(row.id), external, observedAt, historyUrl }),
      sourceStatus, startAt: row.startAt, targetReadyAt: row.targetReadyAt,
    };
    await db.prepare(`
      INSERT INTO guide_inputs (draw_date, lottery_id, checked_at, expires_at, payload) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(draw_date, lottery_id) DO UPDATE SET checked_at = excluded.checked_at,
        expires_at = excluded.expires_at, payload = excluded.payload
      WHERE excluded.checked_at > guide_inputs.checked_at
    `).bind(date, row.id, observedAt, observedAt + retentionMs, JSON.stringify(payload)).run();
    return { id: row.id, status: payload.status, sourceStatus };
  }));
  return { date, reports };
}

async function getInputs(db, now) {
  const date = bangkokDate(new Date(now));
  const [snapshot, rows] = await Promise.all([readSnapshot(db, now), readInputs(db, date, now)]);
  const eligible = rows.filter(row => row.status === 'ready' && now >= Date.parse(row.startAt) &&
    now <= Date.parse(row.targetReadyAt));
  const schedule = auditSchedule(snapshot.catalog, weekdays, date).map(row => ({
    ...row, publishedSource: guideSourceUrl(row.id, date, row.drawTime),
  }));
  return {
    date, historyFetchedAt: new Date(snapshot.fetchedAt).toISOString(),
    catalog: snapshot.catalog, weekdays, schedule, entries: rows,
    confirmedDraws: eligible.map(({ id }) => ({ lotteryId: id, drawDate: date })),
    guides: eligible.map(({ guide }) => guide),
  };
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' || new URL(request.url).pathname !== '/api/guide-inputs') {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    try {
      return Response.json(await getInputs(env.HISTORY_DB, Date.now()), {
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      });
    } catch {
      return Response.json({ error: 'Guide data unavailable' }, { status: 503 });
    }
  },
  async scheduled(_controller, env) {
    const { date, reports } = await collectGuideInputs(env.HISTORY_DB);
    if (reports.length) console.log(JSON.stringify({ event: 'guide_inputs_collected', date, reports }));
  },
};
