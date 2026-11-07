// Keep origin and staleness explicit for historical records. This module is
// independent of prediction, presentation and notification behavior.
export async function loadHistoricalData(key, {
  cache, fetchUpstream, loadArchive, now = Date.now, ttlMs = 60_000
}) {
  if (!['catalog', 'history'].includes(key)) throw new Error('Unknown data source');
  const cached = cache.get(key);
  if (cached && now() - cached.time >= 0 && now() - cached.time < ttlMs) {
    return { data: cached.data, source: 'cache', fetchedAt: cached.time };
  }
  try {
    const data = await fetchUpstream(key);
    if (!Array.isArray(data)) throw new Error('Invalid upstream response');
    const fetchedAt = now();
    cache.set(key, { data, time: fetchedAt });
    return { data, source: 'upstream', fetchedAt };
  } catch {
    if (cached) return { data: cached.data, source: 'stale-cache', fetchedAt: cached.time };
    const data = await loadArchive(key);
    if (!Array.isArray(data)) throw new Error('Invalid bundled archive');
    return { data, source: 'archive', fetchedAt: null };
  }
}
