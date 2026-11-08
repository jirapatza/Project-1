import { auditHistoricalRows } from './history-audit.js';

// Diagnostic catalog coverage. Historical records are never changed or invented.
export function summarizeHistoryCoverage(history, catalog, asOf) {
  const { accepted, rejected } = auditHistoricalRows(history, catalog, asOf);
  const byId = new Map(catalog.map(item => [item.id, {
    id: item.id, name: item.name, validDraws: 0, firstDraw: null, lastDraw: null,
  }]));
  for (const row of accepted) {
    const entry = byId.get(row.id);
    if (!entry) continue;
    entry.validDraws++;
    if (entry.firstDraw === null || row.date < entry.firstDraw) entry.firstDraw = row.date;
    if (entry.lastDraw === null || row.date > entry.lastDraw) entry.lastDraw = row.date;
  }
  const lotteries = [...byId.values()].map(item => ({
    ...item,
    readiness: {
      last10: item.validDraws >= 10,
      last20: item.validDraws >= 20,
      last30: item.validDraws >= 30,
    },
  }));
  const missingLotteries = lotteries.filter(item => item.validDraws === 0);
  const rejectionReasons = {};
  for (const { reason } of rejected) {
    rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
  }
  // Group unmatched records for source reconciliation, without exposing any result digits.
  const unknownSources = new Map();
  for (const { index, reason } of rejected) {
    if (reason !== 'unknown_lottery') continue;
    const row = history[index] ?? {};
    const sourceId = String(row.หวย ?? '').trim().slice(0, 120);
    const sourceName = String(row.ชื่อหวย ?? '').trim().slice(0, 120);
    const key = JSON.stringify([sourceId, sourceName]);
    const existing = unknownSources.get(key) ?? { sourceId, sourceName, rows: 0 };
    existing.rows++;
    unknownSources.set(key, existing);
  }
  const unmatchedSources = [...unknownSources.values()].sort(
    (a, b) => b.rows - a.rows || a.sourceName.localeCompare(b.sourceName),
  );
  return {
    asOf, catalogCount: catalog.length, historyRows: history.length,
    matchedLotteries: lotteries.length - missingLotteries.length,
    missingLotteries, lotteries, unmatchedSources, acceptedDraws: accepted.length,
    rejectedRows: rejected.length, rejectionReasons,
    // A matched source label is not proof of independent result verification.
    independentlyVerified: false,
  };
}
