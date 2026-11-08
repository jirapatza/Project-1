import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplate, validateTemplate, resolveBoxText } from '../public/guide-template.js';
test('portrait template survives save and reopen without sharing state', () => { const a = createTemplate(); assert.ok(validateTemplate(JSON.parse(JSON.stringify(a)))); a.boxes[0].x = 0; assert.equal(createTemplate().boxes[0].x, 50); });
test('rejects duplicate IDs, off-canvas positions and invalid font sizes', () => { for (const mutate of [t => t.boxes.push({...t.boxes[0]}), t => t.boxes[0].x = 850, t => t.boxes[0].fontSize = NaN]) { const t = createTemplate(); mutate(t); assert.equal(validateTemplate(t), false); } });
test('both modes resolve exact strings and do not invent missing numbers', () => { const box = createTemplate().boxes.find(b => b.field === 'twoDigit'); assert.equal(resolveBoxText(box, {numbers:{twoDigit:['00','09']}}), '00 · 09'); assert.throws(() => resolveBoxText(box, {numbers:{}})); });
test('font selection round-trips and rejects unknown families',()=>{const t=createTemplate();t.boxes[0].fontFamily='serif';assert.ok(validateTemplate(JSON.parse(JSON.stringify(t))));t.boxes[0].fontFamily='untrusted-font';assert.equal(validateTemplate(t),false);});
