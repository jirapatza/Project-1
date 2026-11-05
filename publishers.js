function entries(lottery, slug, date, time, rows) {
  return rows.map(([name, two, three, run = '', prominent = '', secondary = '']) => ({
    lottery, date, name, collected: time,
    source: 'https://lotterychecks.com/lucky-picks/' + slug + '/' + date,
    ...Object.fromEntries(Object.entries({ two, three, run, prominent, secondary })
      .map(([key, numbers]) => [key, numbers ? numbers.split(' ') : []])),
  }));
}

export const publishers = [
  ...entries('hanoi_vip', 'hanoi-vip', '2026-11-04', '09:44', [
    ['อาจารย์เลขร้อน', '04 14 27', '024 031 036'],
    ['อาจารย์เลขอั้น', '81 17 26', '953 593 554'],
    ['อาจารย์เลขวิ่ง', '48 84 44', '166 616 661'],
  ]),
  ...entries('hanoi_regular', 'hanoi-normal', '2026-11-04', '13:24', [
    ['อาจารย์เลขร้อน', '43 81 88', '259 066 067'],
    ['อาจารย์เลขอั้น', '39 67 47', '462 485 732'],
    ['อาจารย์เลขวิ่ง', '17 71 18', '446 464 644'],
    ['แม่นิราศินี', '88 89 84 85 82 45 49 44 41 42', '', '8 4', '8 45 49', '4 8 88 89 84 85 82 45 49 44 41 42'],
    ['เจ๊ศรีนวล', '97 91 89 83 17 48 43 58 45 78', '', '9 4', '9 4 48 43 45', '89 45 4'],
  ]),
  ...entries('hanoi_special', 'hanoi-special', '2026-11-04', '07:34', [
    ['อาจารย์เลขร้อน', '12 16 81', '291 576 007'],
    ['อาจารย์เลขอั้น', '05 60 48', '290 611 331'],
    ['อาจารย์เลขวิ่ง', '78 87 18', '348 384 438'],
  ]),
  ...entries('lao_patthana', 'lao-development', '2026-11-04', '16:24', [
    ['เลขเด็ด เลขดัง', '', '280 286 820 826 608 585', '', '2 8 7 9', '0 6 5'],
  ]),
  ...entries('hanoi_vip', 'hanoi-vip', '2026-11-03', '11:54', [
    ['อาจารย์เลขร้อน', '04 14 27', '024 031 036'],
    ['อาจารย์เลขอั้น', '81 17 26', '953 593 554'],
    ['อาจารย์เลขวิ่ง', '06 60 00', '134 143 314'],
  ]),
  ...entries('lao_patthana', 'lao-development', '2026-11-03', '18:14', [
    ['เลขเด็ด เลขดัง', '58 50 27 10 15 59 19 51 95 91 11 54 56 57 81 84 86 87 89', '585 608 159 589 587 586 456', '5 8 0 3 9 1', '3 7'],
    ['พญานาคราช', '15 59 19', '159', '3 1 5 9', '1 5 9'],
  ]),
];

const hanoiSource = 'https://www.tnews.co.th/lotto-horo-belief/660957';
export const archivedResults = [
  ['hanoi_regular', '2026-11-04', '046', '75'],
  ['hanoi_special', '2026-11-04', '015', '40'],
  ['hanoi_vip', '2026-11-04', '396', '79'],
  ['hanoi_vip', '2026-11-03', '616', '84'],
].map(([lottery, date, top3, bottom2]) => ({lottery, date, top3, bottom2, source: hanoiSource}));
