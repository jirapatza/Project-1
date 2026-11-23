const width = 900;
const height = 1200;
const backgrounds = new Map();
const laoRedcross = 'lao_redcross';

function loadBackground(file) {
  if (!backgrounds.has(file)) {
    const image = new Image();
    image.src = file;
    backgrounds.set(file, image.decode().then(() => image).catch(error => {
      backgrounds.delete(file);
      throw error;
    }));
  }
  return backgrounds.get(file);
}

export function formulaPosterSections(result) {
  return [
    { label: 'เด่น', values: result.primary.map(String), weight: 1.28, perRow: 4, inset: true },
    { label: 'รูด–วิ่ง · เลขเบิ้ล', values: result.primary.map(digit => String(digit).repeat(2)), weight: 0.8, perRow: 4 },
    { label: '2 ตัว', values: result.pairs, weight: result.pairs.length > 4 ? 1.25 : 0.92, perRow: 4 },
    { label: '3 ตัว', values: result.triples, weight: 0.92, perRow: 4 },
  ].filter(section => section.values.length);
}

const gold = [[0, '#81430a'], [0.16, '#ffd675'], [0.31, '#fff3b4'],
  [0.52, '#ad6512'], [0.73, '#ffda71'], [1, '#8b4705']];
const goldText = [[0, '#fffce0'], [0.35, '#ffe084'], [0.55, '#e49b28'], [0.76, '#ffdf78'], [1, '#b16a13']];
const navy = [[0, '#283c81'], [0.42, '#16255c'], [1, '#080f30']];
const ivory = [[0, '#fff9e5'], [0.63, '#fff1c7'], [1, '#edc67b']];
const ruby = [[0, '#a32b37'], [0.52, '#731525'], [1, '#360b20']];
const wine = [[0, '#a3313c'], [0.44, '#7d1429'], [1, '#3e0b1b']];

function verticalGradient(ctx, top, bottom, stops) {
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  return gradient;
}

function print(ctx, text, x, y, maxWidth, fontSize, color, outline = null, family = 'system-ui, sans-serif') {
  ctx.save();
  while (fontSize > 14) {
    ctx.font = `900 ${fontSize}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize--;
  }
  if (outline) {
    ctx.shadowColor = '#040615bb';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y, maxWidth);
    ctx.shadowColor = 'transparent';
  }
  ctx.fillStyle = typeof color === 'string' ? color : verticalGradient(ctx, y - fontSize / 2, y + fontSize / 2, color);
  ctx.fillText(text, x, y, maxWidth);
  ctx.restore();
}

function panel(ctx, x, y, w, h, fill, radius = 25, rim = 6) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.shadowColor = '#07081ad9';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = verticalGradient(ctx, y, y + h, gold);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#57300d';
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(x + rim, y + rim, w - 2 * rim, h - 2 * rim, radius - rim);
  ctx.fillStyle = verticalGradient(ctx, y + rim, y + h - rim, fill);
  ctx.fill();
  ctx.strokeStyle = '#fff0a5';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(x + rim + 3, y + rim + 3, w - 2 * rim - 6, h - 2 * rim - 6, radius - rim - 3);
  ctx.strokeStyle = '#b77a4680';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function jewel(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(size * 0.22, -size * 0.28, size, 0);
  ctx.quadraticCurveTo(size * 0.22, size * 0.28, 0, size);
  ctx.quadraticCurveTo(-size * 0.22, size * 0.28, -size, 0);
  ctx.quadraticCurveTo(-size * 0.22, -size * 0.28, 0, -size);
  ctx.closePath();
  ctx.fillStyle = verticalGradient(ctx, -size, size, goldText);
  ctx.fill();
  ctx.strokeStyle = '#80460b';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function renderLockedLaoRedcross(ctx, drawDate, result) {
  const figures = 'Georgia, serif';
  const edge = '#4a110a';
  const [year, month, day] = drawDate.split('-');
  const shortYear = String(Number(year) + 543).slice(-2);
  const standout = result.primary.map(String);
  const doubles = standout.map(digit => digit.repeat(2));
  print(ctx, 'ลาวกาชาด', 450, 258, 610, 81, goldText, edge);
  print(ctx, `วันที่ ${day}/${month}/${shortYear}`, 450, 340, 385, 39, wine);
  print(ctx, 'เด่น', 450, 400, 220, 45, '#fff6d6', edge);
  print(ctx, standout.join(' '), 450, 512, 295, 146, goldText, edge, figures);

  print(ctx, 'รูด–วิ่ง', 317, 644, 179, 35, '#fff6d6', edge);
  print(ctx, doubles.join('–'), 554, 644, 280, 63, goldText, edge, figures);

  print(ctx, '2 ตัว', 450, 717, 215, 35, '#fff6d6', edge);
  if (!result.pairs.length) print(ctx, '—', 450, 805, 115, 55, wine);
  for (const [index, pair] of result.pairs.entries()) {
    const x = 188 + (index % 4) * 175;
    print(ctx, pair, x, 781 + Math.floor(index / 4) * 67, 133, 65, wine, null, figures);
  }

  print(ctx, '3 ตัว', 450, 920, 215, 35, '#fff6d6', edge);
  print(ctx, result.triples.join(' – ') || '—', 450, 997, 717, 68, goldText, edge, figures);
  print(ctx, 'FORMULA LAB  ·  ใบแนวจากสูตร', 432, 1126, 605, 34, '#fff0ab', edge);
}

export async function createFormulaPoster({ lotteryId, lotteryName, drawDate, formulaName, result }) {
  const usesLockedTemplate = lotteryId === laoRedcross;
  const background = await loadBackground(usesLockedTemplate
    ? './lao-redcross-poster.webp' : './formula-poster-background.webp');
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.drawImage(background, 0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (usesLockedTemplate) {
    renderLockedLaoRedcross(ctx, drawDate, result);
  } else {
    renderStandardPoster(ctx, lotteryName, drawDate, formulaName, result);
  }
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('png_export_failed')), 'image/png',
  ));
}

function renderStandardPoster(ctx, lotteryName, drawDate, formulaName, result) {
  panel(ctx, 285, 58, 330, 62, ruby, 28);
  jewel(ctx, 314, 89, 9);
  jewel(ctx, 586, 89, 9);
  print(ctx, 'FORMULA LAB', 450, 89, 247, 28, goldText, '#39200f', 'Georgia, serif');
  print(ctx, lotteryName, 450, 202, 750, 100, goldText, '#591421');
  panel(ctx, 226, 263, 448, 63, ivory, 29);
  jewel(ctx, 249, 295, 8);
  jewel(ctx, 651, 295, 8);
  const dateLabel = new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long', timeZone: 'Asia/Bangkok',
  }).format(new Date(drawDate + 'T12:00:00+07:00'));
  print(ctx, 'งวด ' + dateLabel, 450, 295, 375, 34, wine);

  const sections = formulaPosterSections(result);
  const totalWeight = sections.reduce((sum, section) => sum + section.weight, 0);
  const gap = 18;
  const space = Math.min(662, sections.length * 170) - (sections.length - 1) * gap;
  let y = 362;
  for (const { label, values, weight, perRow, inset } of sections) {
    const h = space * weight / totalWeight;
    const x = 337;
    const w = 523;
    panel(ctx, x, y + 15, w, h - 15, inset ? navy : ivory, inset ? 52 : 26, inset ? 9 : 6);
    const tabWidth = inset ? 200 : 252;
    const tabX = x + (w - tabWidth) / 2;
    panel(ctx, tabX, y, tabWidth, 43, inset ? ruby : navy, 21, 4);
    jewel(ctx, tabX + 19, y + 21, 6);
    jewel(ctx, tabX + tabWidth - 19, y + 21, 6);
    print(ctx, label, x + w / 2, y + 22, tabWidth - 55, 26, goldText);
    if (inset) {
      jewel(ctx, x + 28, y + h * 0.57, 12);
      jewel(ctx, x + w - 28, y + h * 0.57, 12);
    }
    const rowCount = Math.ceil(values.length / perRow);
    const rowHeight = (h - 52) / rowCount;
    const columns = Math.ceil(values.length / rowCount);
    const fieldWidth = w - (inset ? 110 : 44);
    const columnWidth = fieldWidth / columns;
    for (let row = 0; row < rowCount; row++) {
      const numbers = values.slice(row * columns, (row + 1) * columns);
      const middle = y + 46 + rowHeight * (row + 0.5);
      const start = x + (w - columnWidth * numbers.length) / 2;
      for (const [column, value] of numbers.entries()) {
        const center = start + columnWidth * (column + 0.5);
        print(ctx, value, center, middle, columnWidth - 11, Math.min(inset ? 140 : 70, rowHeight * 1.02),
          inset ? goldText : wine, inset ? '#63122b' : null, 'Georgia, serif');
        if (inset && column < numbers.length - 1) jewel(ctx, center + columnWidth / 2, middle, 8);
      }
    }
    y += h + gap;
  }

  const footerY = Math.min(y + 4, 1042);
  panel(ctx, 352, footerY, 493, 75, ruby, 24);
  print(ctx, 'เลขจากสูตร · ' + formulaName, 598, footerY + 25, 445, 23, '#fff1ac');
  print(ctx, 'ใช้ประกอบการวิเคราะห์', 598, footerY + 51, 445, 18, '#f0c98e');
}
