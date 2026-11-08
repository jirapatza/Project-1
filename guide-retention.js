import { bangkokDate } from './public/history-records.js';

// Only transient external guides and generated posters expire; history is separate.
const DAY_MS = 24 * 60 * 60 * 1000;
export { bangkokDate as thaiDate };

export function acceptCurrentDraw(drawDate, now = new Date()) {
  return typeof drawDate === 'string' && drawDate === bangkokDate(now);
}
export function shouldDeleteTransient(record, now = new Date()) {
  if (!['external-guide','generated-poster'].includes(record?.kind)) return false;
  const created = Date.parse(record.createdAt);
  if (!Number.isFinite(created) || !Number.isFinite(now.getTime())) throw new Error('invalid_expiry_timestamp');
  return now.getTime() - created >= DAY_MS;
}
