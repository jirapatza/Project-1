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
  const lotteries = [...byId.values()];
  const missingLotteries = lotteries.filter(item => item.validDraws === 0);
  const rejectionReasons = {};
  for (const { reason } of rejected) {
    rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
  }
  return {
    asOf, catalogCount: catalog.length, historyRows: history.length,
    matchedLotteries: lotteries.length - missingLotteries.length,
    missingLotteries, lotteries, acceptedDraws: accepted.length,
    rejectedRows: rejected.length, rejectionReasons,
    // A matched source label is not proof of independent result verification.
    independentlyVerified: false,
  };
}
