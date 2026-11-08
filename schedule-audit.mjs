import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { bangkokDate } from './public/history-records.js';

const irregular = 'ตามประกาศวันงวดจริง (อาจเลื่อน)';
const minute = 60000;

function timeOnDay(date, value) {
  const match = /^(\d{1,2}):(\d{2})(?:\s*น\.)?$/.exec(typeof value === 'string' ? value.trim() : '');
  if (!match || +match[1] > 23 || +match[2] > 59) return NaN;
  return Date.parse(`${date}T${match[1].padStart(2, '0')}:${match[2]}:00+07:00`);
}

export function auditSchedule(catalog, weekdays, date = bangkokDate()) {
  const day = timeOnDay(date, '00:00');
  if (!Number.isFinite(day) || bangkokDate(new Date(day)) !== date) throw new Error('Invalid Bangkok date');
  if (!Array.isArray(catalog) || !catalog.length || !weekdays || typeof weekdays !== 'object') {
    throw new Error('Invalid schedule inputs');
  }
  const weekday = new Date(day + 7 * 60 * minute).getUTCDay();
  const seen = new Set();
  return catalog.map(item => {
    if (typeof item?.id !== 'string' || !item.id.trim() || typeof item.name !== 'string' || !item.name.trim() || seen.has(item.id)) {
      throw new Error('Catalog requires unique IDs and nonempty names');
    }
    seen.add(item.id);
    const row = { id: item.id, name: item.name, drawDays: item.drawDays,
      closeTime: item.closeTimeStr, drawTime: item.drawTimeStr };
    const rule = String(item.drawDays || '').trim().replace(/\s*-\s*/g, ' - ');
    const needsDate = rule === irregular;
    if (!needsDate) {
      const days = Object.hasOwn(weekdays, rule) ? weekdays[rule] : undefined;
      if (!Array.isArray(days) || !days.length || !days.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
        return { ...row, status: 'unknown_day_rule' };
      }
      if (!days.includes(weekday)) return { ...row, status: 'off_day' };
    }
    const close = timeOnDay(date, item.closeTimeStr), draw = timeOnDay(date, item.drawTimeStr);
    if (!Number.isFinite(close) || !Number.isFinite(draw) || close >= draw) {
      return { ...row, status: 'invalid_times' };
    }
    const start = close - 50 * minute;
    const status = start < day ? 'starts_previous_day' : needsDate ? 'requires_draw_date' : 'matches_weekly_rule';
    return { ...row, status,
      startAt: new Date(start).toISOString(), targetReadyAt: new Date(close - 30 * minute).toISOString() };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , catalogPath, weekdaysPath, date] = process.argv;
  if (!catalogPath || !weekdaysPath) throw new Error('Usage: node schedule-audit.mjs CATALOG_JSON WEEKDAYS_JSON [YYYY-MM-DD]');
  const [catalog, weekdays] = await Promise.all([catalogPath, weekdaysPath].map(async file => JSON.parse(await readFile(file, 'utf8'))));
  console.log(JSON.stringify(auditSchedule(catalog, weekdays, date), null, 2));
}
