import { bangkokDate } from './history-records.js';

const stockSource = 'https://leklnw.com/huay-ai-stock/';
const draftFields = [['standout', 1, 2], ['twoDigit', 2, 8], ['threeDigit', 3, 4], ['running', 1, 2]];

export function selectStockGuideDrafts({ date, entries = [], schedule = [] }, confirmedIds, now = Date.now()) {
  if (bangkokDate(new Date(now)) !== date) return [];
  const eligibleIds = new Set(schedule.filter(row =>
    row.publishedSource === stockSource && row.status === 'matches_weekly_rule' &&
    now >= Date.parse(row.startAt) && now <= Date.parse(row.targetReadyAt) &&
    now < Date.parse(row.closeAt)).map(row => row.id));

  return entries.filter(({ id, status, checkedAt, guide, provenance }) =>
    eligibleIds.has(id) && !confirmedIds.has(id) && status === 'needs_confirmation' &&
    Number.isFinite(checkedAt) && checkedAt <= now &&
    provenance?.kind === 'history_formula' && guide?.lotteryId === id && guide.drawDate === date &&
    draftFields.every(([key, width, count]) => {
      const values = guide.numbers?.[key];
      const supportedCount = values?.length === count || (key === 'threeDigit' && values?.length === 6);
      return Array.isArray(values) && supportedCount && new Set(values).size === values.length &&
        values.every(value => typeof value === 'string' && value.length === width && /^[0-9]+$/.test(value));
    })).map(({ guide }) => ({
      ...guide, numbers: { ...guide.numbers, threeDigit: guide.numbers.threeDigit.slice(0, 4) },
    }));
}
