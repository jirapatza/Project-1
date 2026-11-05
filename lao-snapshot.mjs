// Node.js 20+
// Input JSON: [{"date":"2026-11-04","bottom2":"88","top3":"808"}, ...]
// Create before draw day (Thailand): node lao-snapshot.mjs create history.json YYYY-MM-DD snapshot.json
// Check result: node lao-snapshot.mjs check snapshot.json results.json
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const version = 'v1.0.0';
const [mode, input, argument, output] = process.argv.slice(2);
const thaiDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' });
const read = async path => JSON.parse(await readFile(path, 'utf8'));
function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    new Date(date).toISOString().slice(0, 10) === date;
}
function validate(rows) {
  const dates = new Set();
  for (const {date, bottom2, top3} of rows) {
    if (!validDate(date) || dates.has(date) || typeof bottom2 !== 'string' ||
        typeof top3 !== 'string' || !/^\d{2}$/.test(bottom2) || !/^\d{3}$/.test(top3)) {
      throw new Error('Invalid or duplicate draw: ' + date);
    }
    dates.add(date);
  }
  return rows;
}
function rank(numbers, count) {
  const frequencies = new Map();
  for (const number of numbers) frequencies.set(number, (frequencies.get(number) ?? 0) + 1);
  return [...frequencies].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, count).map(([number]) => number);
}
export function calculate(rows) {
  return {
    run: rank(rows.flatMap(row => [...new Set(row.bottom2)]), 2),
    exact3: rank(rows.map(row => row.top3), 10),
  };
}
async function main() {
  if (mode === 'create') {
    const now = new Date();
    const today = thaiDate.format(now);
    if (!validDate(argument) || argument <= today) throw new Error('Target must be after today in Thailand');
    const rows = validate(await read(input)).filter(row => row.date <= today)
      .sort((a,b) => a.date.localeCompare(b.date)).slice(-30);
    if (rows.length !== 30) throw new Error('30 valid source draws required');
    const snapshot = { lottery: 'lao_patthana', version, targetDate: argument,
      savedAt: now.toISOString(), drawsUsed: rows.map(row => row.date), ...calculate(rows) };
    await writeFile(output, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
  } else if (mode === 'check') {
    const s = await read(input);
    if (s.lottery !== 'lao_patthana' || s.version !== version ||
        !validDate(s.targetDate) || thaiDate.format(new Date(s.savedAt)) >= s.targetDate) {
      throw new Error('Invalid snapshot or not recorded before draw day');
    }
    const result = validate(await read(argument)).find(row => row.date === s.targetDate);
    if (!result) console.log(JSON.stringify({ status: 'pending', date: s.targetDate }));
    else console.log(JSON.stringify({ date: s.targetDate,
      runMatches: s.run.filter(digit => result.bottom2.includes(digit)),
      exact3Rank: s.exact3.includes(result.top3) ? s.exact3.indexOf(result.top3) + 1 : null }));
  } else {
    throw new Error('Use create or check. See usage at the top of this file.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
