import { thaiDate } from './guide-retention.js';
import { createGuideStore } from './guide-store.js';
import { validateGuide } from './guide-validation.js';
import { auditSchedule } from './schedule-audit.mjs';

// A single poll. The caller supplies independently confirmed draws, the source
// adapter, and a renderer. A weekly rule alone is never draw confirmation.
export async function runGuideBatch({
  catalog, weekdays, confirmedDraws, directory, fetchGuide, renderPng, clock = () => new Date(),
}) {
  const started = clock();
  const drawDate = thaiDate(started);
  const schedule = auditSchedule(catalog, weekdays, drawDate);
  const confirmed = new Set(confirmedDraws.filter(draw => draw.drawDate === drawDate).map(draw => draw.lotteryId));
  const store = createGuideStore(directory);
  await store.purge(started);
  const results = [];

  for (const row of schedule) {
    if (row.status !== 'matches_weekly_rule' && row.status !== 'requires_draw_date') continue;
    const start = Date.parse(row.startAt);
    const deadline = Date.parse(row.targetReadyAt);
    if (started.getTime() < start || started.getTime() > deadline) continue;
    const result = { lotteryId: row.id, drawDate };
    results.push(result);
    if (!confirmed.has(row.id)) {
      result.status = 'awaiting_confirmation';
      continue;
    }
    try {
      const context = { lotteryId: row.id, drawDate, catalog };
      if (await store.read(row.id, drawDate, clock())) {
        result.status = 'already_published';
        continue;
      }
      if (clock().getTime() > deadline) {
        result.status = 'deadline_passed';
        continue;
      }
      const guide = await fetchGuide({ lotteryId: row.id, drawDate });
      const validation = validateGuide(guide, context);
      if (!validation.ok) {
        result.status = 'awaiting_data';
        result.errors = validation.errors;
        continue;
      }
      if (clock().getTime() > deadline) {
        result.status = 'deadline_passed';
        continue;
      }
      const png = await renderPng({ ...validation.guide, lotteryName: row.name });
      const now = clock();
      result.status = now.getTime() > deadline ? 'deadline_passed' :
        await store.publish({ ...context, guide: validation.guide, png }, now);
    } catch {
      result.status = 'retryable_error';
    }
  }
  return results;
}
