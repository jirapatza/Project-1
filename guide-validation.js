// Shared boundary for external guides. Never substitutes formulas or guesses digits.
export function validateGuide(guide, { lotteryId, drawDate, catalog }) {
  const errors = [];
  if (!guide || typeof guide !== 'object') return { ok: false, errors: ['missing_guide'] };
  if (!catalog.some(item => item.id === lotteryId) || guide.lotteryId !== lotteryId) errors.push('wrong_lottery');
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(drawDate) || !validDate(guide.drawDate) || guide.drawDate !== drawDate) errors.push('wrong_draw');
  if (typeof guide.fetchedAt !== 'string' || !Number.isFinite(Date.parse(guide.fetchedAt))) errors.push('missing_fetch_time');
  try { if (new URL(guide.sourceUrl).protocol !== 'https:') throw Error(); } catch { errors.push('invalid_source'); }
  for (const [key, width] of [['standout', 1], ['twoDigit', 2], ['threeDigit', 3], ['running', 1]]) {
    const values = guide.numbers?.[key];
    const pattern = new RegExp(`^[0-9]{${width}}$`);
    if (!Array.isArray(values) || !values.length || new Set(values).size !== values.length ||
        values.some(value => typeof value !== 'string' || !pattern.test(value))) errors.push(`invalid_${key}`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, guide: structuredClone(guide) };
}
