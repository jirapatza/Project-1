const width = 900;
const height = 1200;
let loadedBackground;

function loadBackground() {
  if (!loadedBackground) {
    const image = new Image();
    image.src = './formula-poster-background.webp';
    loadedBackground = image.decode().then(() => image).catch(error => {
      loadedBackground = undefined;
      throw error;
    });
  }
  return loadedBackground;
}

export function formulaPosterSections(result) {
  return [
    { label: 'เด่น', values: result.primary.map(String), weight: 1.28, perRow: 4, inset: true },
    { label: 'รูด–วิ่ง · เลขเบิ้ล', values: result.primary.map(digit => String(digit).repeat(2)), weight: 0.8, perRow: 4 },
    { label: '2 ตัว', values: result.pairs, weight: result.pairs.length > 4 ? 1.25 : 0.92, perRow: 4 },
    { label: '3 ตัว', values: result.triples, weight: 0.92, perRow: 4 },
  ].filter(section => section.values.length);
}

function print(ctx, text, x, y, maxWidth, fontSize, color, outline = null) {
  while (fontSize > 14) {
    ctx.font = `900 ${fontSize}px system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize--;
  }
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y, maxWidth);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y, maxWidth);
}

function panel(ctx, x, y, w, h, fill, radius = 24) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#e6a207';
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x + 5, y + 5, w - 10, h - 10, radius - 5);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff1a2';
  ctx.stroke();
}

export async function createFormulaPoster({ lotteryName, drawDate, formulaName, result }) {
  const background = await loadBackground();
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.drawImage(background, 0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  panel(ctx, 292, 58, 316, 62, '#6e1017');
  print(ctx, 'FORMULA LAB', 450, 91, 274, 30, '#fff0a8');
  print(ctx, lotteryName, 450, 203, 752, 91, '#ffda57', '#6e1017');
  panel(ctx, 240, 268, 420, 56, '#fff0c0');
  const dateLabel = new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long', timeZone: 'Asia/Bangkok',
  }).format(new Date(drawDate + 'T12:00:00+07:00'));
  print(ctx, 'งวด ' + dateLabel, 450, 297, 378, 32, '#651019');

  const sections = formulaPosterSections(result);
  const totalWeight = sections.reduce((sum, section) => sum + section.weight, 0);
  const space = Math.min(650, sections.length * 168) - (sections.length - 1) * 17;
  let y = 362;
  for (const { label, values, weight, perRow, inset } of sections) {
    const h = space * weight / totalWeight;
    const x = 345;
    const w = 505;
    panel(ctx, x, y + 16, w, h - 16, inset ? '#132046' : '#fff0c1');
    panel(ctx, x + 125, y, 255, 43, inset ? '#75101c' : '#142557', 17);
    print(ctx, label, x + w / 2, y + 23, 225, 27, '#fff1a1');
    const rowCount = Math.ceil(values.length / perRow);
    const rowHeight = (h - 53) / rowCount;
    for (let row = 0; row < rowCount; row++) {
      const numbers = values.slice(row * perRow, (row + 1) * perRow);
      const columnWidth = (w - 34) / numbers.length;
      for (const [column, value] of numbers.entries()) {
        print(ctx, value, x + 17 + columnWidth * (column + 0.5), y + 48 + rowHeight * (row + 0.5),
          columnWidth - 8, Math.min(inset ? 124 : 64, rowHeight * 0.92),
          inset ? '#ffdf60' : '#861722', inset ? '#841423' : null);
      }
    }
    y += h + 17;
  }

  panel(ctx, 334, 1032, 527, 88, '#6e1017');
  print(ctx, 'เลขจากสูตร · ' + formulaName, 597, 1060, 475, 24, '#fff1a1');
  print(ctx, 'ใช้ประกอบการวิเคราะห์', 597, 1091, 475, 22, '#fff1a1');
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('png_export_failed')), 'image/png',
  ));
}
