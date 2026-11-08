export const FONT_FAMILIES = ['sans-serif', 'serif', 'monospace'];
// Versioned, serializable model shared by manual and automatic rendering.
export function createTemplate() {
  return { version: 1, width: 900, height: 1200, background: '#750e20', boxes: [
    { id: 'title', field: 'lotteryName', x: 50, y: 40, width: 800, height: 100, fontSize: 48, color: '#ffe0a0' },
    { id: 'date', field: 'drawDate', x: 50, y: 150, width: 800, height: 60, fontSize: 32, color: '#ffe0a0' },
    ...['standout', 'twoDigit', 'threeDigit', 'running'].map((field, index) => ({ id: field, field, x: 50, y: 220 + index * 220, width: 800, height: 180, fontSize: 48, color: '#ffffff' }))
  ] };
}
export function validateTemplate(value) {
  if (!value || value.version !== 1 || value.width !== 900 || value.height !== 1200 || !/^#[a-f\d]{6}$/i.test(value.background) || !Array.isArray(value.boxes) || value.boxes.length > 100) return false;
  if (value.backgroundImage !== undefined && (typeof value.backgroundImage !== 'string' || value.backgroundImage.length > 2800000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.backgroundImage))) return false;
  const ids = new Set();
  return value.boxes.every(box => {
    if (!box || typeof box.id !== 'string' || !box.id || ids.has(box.id)) return false;
    ids.add(box.id);
    return ['lotteryName', 'drawDate', 'standout', 'twoDigit', 'threeDigit', 'running', 'text'].includes(box.field)
      && ['x', 'y', 'width', 'height', 'fontSize'].every(key => Number.isFinite(box[key]))
      && box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0
      && box.x + box.width <= value.width && box.y + box.height <= value.height
      && (box.fontFamily === undefined || FONT_FAMILIES.includes(box.fontFamily))
      && box.fontSize >= 8 && box.fontSize <= 200 && /^#[a-f\d]{6}$/i.test(box.color)
      && (box.field !== 'text' || typeof box.text === 'string' && box.text.length <= 1000);
  });
}
export function resolveBoxText(box, guide) {
  if (box.field === 'text') return box.text;
  const value = ['lotteryName', 'drawDate'].includes(box.field) ? guide[box.field] : guide.numbers?.[box.field];
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value.join(' · ');
  if (typeof value === 'string') return value;
  throw new Error('missing_template_value');
}
