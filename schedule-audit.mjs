import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { auditSchedule } from './guide-schedule.js';

export { auditSchedule };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , catalogPath, weekdaysPath, date] = process.argv;
  if (!catalogPath || !weekdaysPath) throw new Error('Usage: node schedule-audit.mjs CATALOG_JSON WEEKDAYS_JSON [YYYY-MM-DD]');
  const [catalog, weekdays] = await Promise.all([catalogPath, weekdaysPath].map(async file => JSON.parse(await readFile(file, 'utf8'))));
  console.log(JSON.stringify(auditSchedule(catalog, weekdays, date), null, 2));
}
