export const formulas = [
  { id: 'previous', version: 1, name: 'เลข 2 ตัวจากงวดก่อน', lookback: 1,
    calculate: ([previous]) => previous },
  { id: 'reverse', version: 1, name: 'กลับเลข 2 ตัวจากงวดก่อน', lookback: 1,
    calculate: ([previous]) => previous[1] + previous[0] },
  { id: 'sum', version: 1, name: 'บวกเลข 2 ตัวจากสองงวดก่อน (เก็บสองหลักท้าย)', lookback: 2,
    calculate: ([previous, older]) => String((Number(previous) + Number(older)) % 100).padStart(2, '0') },
];

export function backtest(draws, formula, limit) {
  const results = [];
  const start = Math.max(formula.lookback, draws.length - limit);
  for (let index = start; index < draws.length; index++) {
    const draw = draws[index];
    const inputs = draws.slice(index - formula.lookback, index).reverse();
    if (!draw.number || inputs.some(input => !input.number)) continue;
    const calculated = formula.calculate(inputs.map(input => input.number));
    results.push({ ...draw, calculated, hit: calculated === draw.number });
  }
  return results.reverse();
}
