// Keep origin and staleness explicit for historical records. This module is
// independent of prediction, presentation and notification behavior.
export async function loadHistoricalData(key, {
  cache, fetchUpstream, loadArchive, now = Date.now, ttlMs = 60_000,
  retryUntil = new Map(), retryDelayMs = 30_000
}) {
  if (!['catalog', 'history'].includes(key)) throw new Error('Unknown data source');
  const clock = now();
  const cached = cache.get(key);
  if (cached && clock - cached.time >= 0 && clock - cached.time < ttlMs) {
    return { data: cached.data, source: 'cache', fetchedAt: cached.time };
  }
  async function fallback() {
    if (cached) return { data: cached.data, source: 'stale-cache', fetchedAt: cached.time };
    const data = await loadArchive(key);
    if (!Array.isArray(data)) throw new Error('Invalid bundled archive');
    return { data, source: 'archive', fetchedAt: null };
  }
  // A failed upstream must not be hammered by every website visitor.
  const nextAttempt = retryUntil.get(key);
  if (typeof nextAttempt === 'number' && clock < nextAttempt) return fallback();
  try {
    const data = await fetchUpstream(key);
    if (!Array.isArray(data)) throw new Error('Invalid upstream response');
    const fetchedAt = now();
    cache.set(key, { data, time: fetchedAt });
    retryUntil.delete(key);
    return { data, source: 'upstream', fetchedAt };
  } catch {
    retryUntil.set(key, now() + retryDelayMs);
    return fallback();
  }
}
