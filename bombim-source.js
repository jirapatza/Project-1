const paths = { catalog: 'data/all_lotteries.json', history: 'lottery_previous_results.json' };

// The credential is server-side and must have only Contents: read access.
export async function readBombimSource(key, branch, token, fetchImpl = fetch) {
  const file = paths[key];
  if (!file) throw new Error('Unknown data source');
  const ref = key === 'catalog' ? 'main' : branch;
  const url = token
    ? `https://api.github.com/repos/jirapatza/Bombim00/contents/${file}?ref=${encodeURIComponent(ref)}`
    : `https://raw.githubusercontent.com/jirapatza/Bombim00/${encodeURIComponent(ref)}/${file}`;
  const headers = token
    ? { Accept: 'application/vnd.github.raw+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
    : { Accept: 'application/json' };
  const response = await fetchImpl(url, { method: 'GET', headers, signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!response.ok) throw new Error(`Bombim00 HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Unexpected upstream response');
  return data;
}
