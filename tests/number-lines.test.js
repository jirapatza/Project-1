import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backtestLine, buildLine, doublePairs, evaluateLine, lineCount, lineOptions,
  pinPairs, pluckNumbers, resolveDraws, run19, siblingPairs, validDrawDate, winPairs,
} from '../public/number-lines.js';

const draw = (date, top3, bottom2, extra = {}) => ({ date, top3, bottom2, ...extra });

test('every offered line has a size that matches its rule', () => {
  assert.equal(run19('7').length, 19);
  assert.equal(lineCount('run19'), 19);
  assert.equal(pluckNumbers('4', 'tens').length, 10);
  assert.equal(pinPairs('127').length, 6);
  for (const option of lineOptions) assert.ok(lineCount(option.id) > 0, option.id);
});

test('run19 keeps leading zeros and covers exactly the numbers holding the digit', () => {
  const numbers = run19('3');
  assert.equal(numbers.length, 19);
  assert.ok(numbers.includes('03'));
  assert.ok(numbers.includes('30'));
  assert.ok(numbers.includes('33'));
  assert.ok(numbers.every(pair => pair.includes('3')));
  assert.deepEqual(run19('9').slice(0, 3), ['09', '19', '29']);
  assert.deepEqual(run19(''), []);
  assert.deepEqual(run19('x'), []);
});

test('sibling lines need consecutive digits or the 90 pair and keep both orderings', () => {
  assert.deepEqual(siblingPairs('12'), ['12', '21']);
  assert.deepEqual(siblingPairs('90'), ['90', '09']);
  assert.deepEqual(siblingPairs('09'), ['09', '90']);
  assert.deepEqual(siblingPairs('13'), []);
  assert.deepEqual(siblingPairs('77'), []);
  assert.deepEqual(siblingPairs(''), []);
});

test('double lines accept only a repeated pair', () => {
  assert.deepEqual(doublePairs('77'), ['77']);
  assert.deepEqual(doublePairs('78'), []);
  assert.deepEqual(doublePairs('7'), []);
});

test('win lines return both orderings and collapse a double', () => {
  assert.deepEqual(winPairs('07'), ['07', '70']);
  assert.deepEqual(winPairs('77'), ['77']);
  assert.deepEqual(winPairs(''), []);
});

test('pin lines use three distinct digits without doubles', () => {
  const numbers = pinPairs('127');
  assert.equal(numbers.length, 6);
  assert.ok(numbers.every(pair => pair[0] !== pair[1]));
  assert.deepEqual(numbers.slice(0, 2), ['12', '17']);
  assert.deepEqual(pinPairs('112'), []);
  assert.deepEqual(pinPairs('12'), []);
});

test('pluck lines fix the requested position only', () => {
  assert.deepEqual(pluckNumbers('4', 'tens').slice(0, 3), ['40', '41', '42']);
  assert.deepEqual(pluckNumbers('4', 'units').slice(0, 3), ['04', '14', '24']);
  assert.equal(pluckNumbers('4', 'units').length, 10);
  assert.deepEqual(pluckNumbers('4', 'hundreds'), []);
});

test('buildLine refuses an incomplete or conflicting latest draw', () => {
  assert.match(buildLine('run19', draw('2026-11-02', '12', '3')).error, /3 ตัวบน/);
  assert.match(buildLine('run19', draw('2026-11-02', '123', '4')).error, /2 ตัวล่าง/);
  assert.match(buildLine('sibling', draw('2026-11-02', '123', '13')).error, /ไม่ใช่เลขพี่น้อง/);
  assert.match(buildLine('double', draw('2026-11-02', '123', '13')).error, /ไม่ใช่เลขเบิ้ล/);
  assert.match(buildLine('pin', draw('2026-11-02', '123', '13'), { standout: '11' }).error, /สามตัว/);
  assert.match(buildLine('unknown', draw('2026-11-02', '123', '12')).error, /ไม่พบสาย/);
});

test('buildLine reports the rule and the numbers it produced', () => {
  const line = buildLine('run19', draw('2026-11-02', '123', '45'), { digit: '5' });
  assert.equal(line.numbers.length, 19);
  assert.match(line.rule, /รูดเลข 5/);
  assert.equal(line.top3, '123');
  assert.equal(line.bottom2, '45');
  const pluck = buildLine('pluck', draw('2026-11-02', '123', '45'), { digit: '2', position: 'units' });
  assert.deepEqual(pluck.numbers.slice(0, 2), ['02', '12']);
  assert.match(pluck.rule, /ปักหลักหน่วย/);
});

test('date validation rejects impossible and malformed dates', () => {
  assert.equal(validDrawDate('2026-11-02'), true);
  assert.equal(validDrawDate('2026-02-30'), false);
  assert.equal(validDrawDate('2026-1-2'), false);
  assert.equal(validDrawDate(''), false);
});

test('resolveDraws drops conflicts and orders oldest first', () => {
  const rows = [
    draw('2026-11-03', '333', '33'),
    draw('2026-11-01', '111', '11'),
    draw('2026-11-02', '222', '22', { conflict: true }),
    draw('2026-11-04', '44', '44'),
    null,
  ];
  assert.deepEqual(resolveDraws(rows).map(row => row.date), ['2026-11-01', '2026-11-03']);
  assert.deepEqual(resolveDraws(null), []);
});

test('evaluateLine compares the hit rate with the uniform baseline', () => {
  const rows = [
    draw('2026-11-01', '111', '03'),
    draw('2026-11-02', '222', '30'),
    draw('2026-11-03', '333', '77'),
    draw('2026-11-04', '444', '99'),
  ];
  const report = evaluateLine(buildLine('run19', rows[3], { digit: '3' }), rows);
  assert.equal(report.size, 19);
  assert.equal(report.trials, 4);
  assert.equal(report.hits, 2);
  assert.equal(report.baseline, 0.19);
  assert.equal(report.expected, 0.76);
  assert.equal(report.detail.length, 4);
  assert.equal(report.detail[0].hit, true);
  assert.equal(report.detail[2].hit, false);
  assert.ok(Number.isFinite(report.z));
  assert.match(report.verdict, /ฐานสุ่ม/);
});

test('evaluateLine refuses an empty line or an empty history', () => {
  assert.match(evaluateLine({ id: 'x', name: 'x', numbers: [] }, []).error, /ไม่มีตัวเลข/);
  assert.match(evaluateLine({ id: 'x', name: 'x', numbers: ['12'] }, []).error, /ผลย้อนหลัง/);
});

test('backtestLine scores only the requested window and keeps the baseline honest', () => {
  // 31 draws give 30 independent input/target pairs, not 31 scores.
  const rows = Array.from({ length: 31 }, (_, i) => draw(
    `2026-10-${String(i + 1).padStart(2, '0')}`, '123', i % 2 ? '12' : '34'));
  const full = backtestLine('sibling', rows, {}, 0);
  const window = backtestLine('sibling', rows, {}, 10);
  assert.equal(full.trials, 30);
  assert.equal(full.hits, 0); // Alternating pairs never repeat on the next draw.
  assert.equal(window.trials, 10);
  assert.equal(window.baseline, 0.02);
  assert.ok(window.expected < full.expected);
  assert.match(backtestLine('sibling', [draw('2026-11-01', '1', '12')], {}).error, /ผลย้อนหลัง/);
  assert.match(backtestLine('sibling', [draw('2026-11-01', '123', '13'), draw('2026-11-02', '123', '12')], {}).error, /ไม่มีงวดที่เข้าเงื่อนไข/);
});

test('win baseline changes with each prior draw, not the final draw', () => {
  const rows = [draw('2026-11-01','007','11'), draw('2026-11-02','077','70'), draw('2026-11-03','123','77')];
  const result = backtestLine('win', rows.reverse(), {});
  assert.equal(result.hits, 2);
  assert.equal(result.trials, 2);
  assert.equal(result.baseline, 0.015);
});
