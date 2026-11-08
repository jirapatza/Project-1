import { auditHistoricalRows } from './history-audit.js';

/**
 * Diagnostic counts only: no historical result digits or predictive output.
 * Both inputs must be original, unmodified source arrays.
 */
export function summarizeHistoryQuality(history, catalog, asOf) {
  const report = auditHistoricalRows(history, catalog, asOf);
  const reasons = {};
  for (const { reason } of report.rejected) reasons[reason] = (reasons[reason] ?? 0) + 1;
  return {
    checked: history.length,
    accepted: report.accepted.length,
    rejected: report.rejected.length,
    reasons,
    asOf,
    // This counts valid unique draws, not independent source verification.
    independentlyVerified: false,
  };
}

export { bangkokDate } from './public/history-records.js';
