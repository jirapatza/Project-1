import { readBombimSource } from '../bombim-source.js';
import { publicSnapshot } from '../snapshot-validation.js';

const maxAgeMs = 20 * 60 * 1000;
const maxSnapshotBytes = 1_000_000;

async function refresh(db, observedAt) {
  const keys = ['catalog', 'history'];
  const [catalog, history] = await Promise.all(keys.map(async key => {
    const rows = await readBombimSource(key, 'runtime-live');
    return JSON.stringify(publicSnapshot(key, rows));
  }));
  if (new TextEncoder().encode(catalog + history).byteLength > maxSnapshotBytes) {
    throw new Error('Historical snapshot exceeds storage budget');
  }
  await db.prepare(`
    INSERT INTO history_snapshot (id, catalog, history, fetched_at) VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET catalog = excluded.catalog, history = excluded.history,
      fetched_at = excluded.fetched_at
    WHERE excluded.fetched_at > history_snapshot.fetched_at
  `).bind(catalog, history, observedAt).run();
}

function unavailable() {
  return Response.json({ error: 'Historical snapshot unavailable' }, { status: 503 });
}

export default {
  async fetch(request, env) {
    const key = new URL(request.url).pathname;
    if (request.method !== 'GET' || (key !== '/api/catalog' && key !== '/api/history')) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    const column = key === '/api/catalog' ? 'catalog' : 'history';
    try {
      const row = await env.HISTORY_DB.prepare(
        `SELECT ${column} AS payload, fetched_at FROM history_snapshot WHERE id = 1`,
      ).first();
      if (!row || Date.now() - row.fetched_at > maxAgeMs) return unavailable();
      return new Response(row.payload, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=30',
          'X-Content-Type-Options': 'nosniff',
          'X-Project1-Fetched-At': new Date(row.fetched_at).toISOString(),
        },
      });
    } catch {
      return unavailable();
    }
  },
  async scheduled(controller, env) {
    await refresh(env.HISTORY_DB, controller.scheduledTime);
  },
};
