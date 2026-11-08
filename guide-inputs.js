import { calculateFormula, resolveFormulaDraws } from './public/independent-formulas.js';
import { bangkokDate, buildLotteryMatcher, dateKey, isPublishedResult } from './public/history-records.js';
import { validateGuide } from './guide-validation.js';

export function indexGuideHistory(catalog, history) {
  const match = buildLotteryMatcher(catalog);
  const indexed = new Map(catalog.map(({ id }) => [id, []]));
  for (const row of history) {
    const id = match(row);
    if (!id || !isPublishedResult(row.status ?? row.สถานะผล)) continue;
    indexed.get(id).push({ date: dateKey(row), top3: row.เลขบน_3_ตัว,
      bottom2: row.เลขล่าง_2_ตัว || row.เลขท้าย_2_ตัว });
  }
  return indexed;
}

export function prepareGuideInput({ row, date, catalog, history, external, observedAt, historyUrl }) {
  if (bangkokDate(new Date(observedAt)) !== date) return { status: 'wrong_date' };
  const draws = resolveFormulaDraws(history);
  if (draws.some(draw => draw.date === date)) return { status: 'result_already_present' };
  const formulas = ['frequency', 'matrix', 'sum'].map(id => ({ id, result: calculateFormula(id, date, draws) }))
    .filter(({ result }) => !result.error);
  const frequency = formulas.find(({ id }) => id === 'frequency')?.result;
  const fallbackStandout = frequency?.primary.map(String) ?? [];
  const fallback = field => [...new Set(formulas.flatMap(({ result }) => result[field]))];

  const numbers = {
    standout: (external?.numbers.standout.length >= 2 ? external.numbers.standout : fallbackStandout).slice(0, 2),
    twoDigit: (external ? external.numbers.twoDigit : fallback('pairs')).slice(0, 8),
    threeDigit: (external ? external.numbers.threeDigit : fallback('triples')).slice(0, 6),
    running: (external?.numbers.running.length >= 2 ? external.numbers.running : fallbackStandout).slice(0, 2),
  };
  const guide = {
    lotteryId: row.id, drawDate: date, fetchedAt: new Date(observedAt).toISOString(),
    sourceUrl: external?.sourceUrl ?? historyUrl, numbers,
  };
  const missing = [
    numbers.standout.length !== 2 && 'standout',
    numbers.running.length !== 2 && 'running',
    numbers.twoDigit.length !== 8 && 'twoDigit',
    numbers.threeDigit.length < 4 && 'threeDigit',
  ].filter(Boolean);
  const validation = validateGuide(guide, { lotteryId: row.id, drawDate: date, catalog });
  return {
    status: missing.length || !validation.ok ? 'incomplete' : external ? 'ready' : 'needs_confirmation',
    guide,
    missing,
    provenance: {
      kind: external ? 'published_and_history' : 'history_formula',
      publishedAt: external?.publishedAt ?? null,
      modifiedAt: external?.modifiedAt ?? null,
      history: historyUrl,
      historyThrough: frequency?.latestDraw ?? null,
      formulas: formulas.map(({ id }) => id),
      standoutFrom: external?.numbers.standout.length >= 2 ? 'published' : 'history_formula',
      runningFrom: external?.numbers.running.length >= 2 ? 'published' : 'history_formula',
    },
    runningDoubles: numbers.standout.map(digit => digit + digit),
  };
}
