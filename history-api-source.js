import { readBombimSource } from './bombim-source.js';
import { publicSnapshot, validateSnapshot } from './snapshot-validation.js';

export async function readHistoryApi(key, baseUrl, fetchImpl = fetch) {
  if (key !== 'catalog' && key !== 'history') throw new Error('Unknown data source');
  const url = new URL('/api/' + key, baseUrl);
  if (url.protocol !== 'https:') throw new Error('History API requires HTTPS');
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`History API HTTP ${response.status}`);
  const fetchedAt = Date.parse(response.headers.get('X-Project1-Fetched-At') ?? '');
  const ageMs = Date.now() - fetchedAt;
  if (!Number.isFinite(ageMs) || ageMs < -60_000 || ageMs > 21 * 60_000) {
    throw new Error('Invalid history API timestamp');
  }
  const data = validateSnapshot(key, await response.json());
  return { data, fetchedAt };
}

export async function readHistorySource(key, { historyApi, branch, token, fetchImpl = fetch }) {
  const direct = async credential => publicSnapshot(key, await readBombimSource(key, branch, credential, fetchImpl));
  if (historyApi) {
    try {
      return await readHistoryApi(key, historyApi, fetchImpl);
    } catch {
      // The read-only Bombim00 snapshot is also available without the mirror.
    }
  }
  try {
    return await direct(token);
  } catch (error) {
    if (!token) throw error;
    return direct();
  }
}
