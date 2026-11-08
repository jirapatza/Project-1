import { validateTemplate, resolveBoxText } from './guide-template.js';
const labels = { standout: 'เด่น', twoDigit: '2 ตัว', threeDigit: '3 ตัว', running: 'รูด–วิ่ง' };
// Both preview and PNG export call this same renderer. Reject overflow instead of dropping digits.
export async function renderGuide(canvas, template, guide, fonts = document.fonts) {
  if (!validateTemplate(template)) throw new Error('invalid_template');
  template = structuredClone(template);
  guide = structuredClone(guide);
  await fonts.ready;
  await Promise.all([...new Set(template.boxes.map(b => b.fontFamily || 'sans-serif'))].map(f => fonts.load(`48px ${f}`, 'หวย เด่น รูดวิ่ง')));
  let backgroundImage;
  if (template.backgroundImage) {
    backgroundImage = new Image();
    backgroundImage.src = template.backgroundImage;
    await backgroundImage.decode();
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  const rows = template.boxes.map(box => {
    const text = resolveBoxText(box, guide);
    let size = box.fontSize;
    const family = box.fontFamily || 'sans-serif';
    const label = labels[box.field];
    if (label) { ctx.font = `28px ${family}`; if (ctx.measureText(label).width > box.width - 24) throw new Error(`label_overflow:${box.id}`); }
    const available = box.height - (label ? 44 : 0);
    for (; size >= 8; size--) {
      ctx.font = `${size}px ${family}`;
      if (ctx.measureText(text).width <= box.width - 24 && size * 1.4 <= available) break;
    }
    if (size < 8) throw new Error(`text_overflow:${box.id}`);
    return { box, text, size, label, family };
  });
  canvas.width = template.width; canvas.height = template.height;
  ctx.fillStyle = template.background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (backgroundImage) ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  for (const { box, text, size, label, family } of rows) {
    ctx.fillStyle = box.color;
    if (label) { ctx.font = `28px ${family}`; ctx.fillText(label, box.x + box.width / 2, box.y + 4); }
    ctx.font = `${size}px ${family}`;
    ctx.fillText(text, box.x + box.width / 2, box.y + (label ? 44 : 0));
  }
  return canvas;
}
export async function exportGuidePng(canvas, template, guide, fonts) {
  await renderGuide(canvas, template, guide, fonts);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('png_export_failed')), 'image/png'));
}
