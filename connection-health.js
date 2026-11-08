// Read-only infrastructure checks. Do not expose credentials or individual lottery numbers.
export async function inspectConnections({ load, guideUrl, fetchImpl = fetch, timeoutMs = 5000 }) {
  const checks = await Promise.allSettled(['catalog', 'history'].map(key => load(key)));
  const result = { history: {} };
  for (const [index, key] of ['catalog', 'history'].entries()) {
    const checked = checks[index];
    const value = checked.status === 'fulfilled' ? checked.value : null;
    result.history[key] = {
      available: Array.isArray(value?.data),
      origin: typeof value?.source === 'string' ? value.source : 'unavailable',
      records: Array.isArray(value?.data) ? value.data.length : 0,
      fetchedAt: Number.isFinite(value?.fetchedAt) ? new Date(value.fetchedAt).toISOString() : null,
    };
  }

  result.guideInput = { configured: Boolean(guideUrl), reachable: false, currentDate: null, records: 0 };
  if (guideUrl) {
    try {
      const endpoint = new URL('/api/guide-inputs', guideUrl);
      if (endpoint.protocol !== 'https:') throw new Error('Invalid upstream scheme');
      const response = await fetchImpl(endpoint, {
        redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Upstream unavailable');
      const data = await response.json();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.date ?? '') ||
          !Array.isArray(data?.entries) || !Array.isArray(data?.catalog)) {
        throw new Error('Invalid upstream schema');
      }
      result.guideInput = {
        configured: true, reachable: true, currentDate: data.date,
        records: data.entries.length,
      };
    } catch {
      // No upstream host, URL, response content, or secret is exposed to clients.
    }
  }
  return result;
}
