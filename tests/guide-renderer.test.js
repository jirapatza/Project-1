import test from 'node:test';
import assert from 'node:assert/strict';
import { renderGuide } from '../public/guide-renderer.js';
import { createTemplate } from '../public/guide-template.js';
const fonts = {ready: Promise.resolve(), load: async () => []};
function mock() { const drawn = []; const ctx = {measureText: text => ({width:text.length * 10}), fillRect(){}, fillText(text){drawn.push(text);} }; return {drawn, getContext:()=>ctx}; }
test('renders exact values and all four Thai labels', async () => { const canvas = mock(); await renderGuide(canvas, createTemplate(), {lotteryName:'ทดสอบ', drawDate:'2026-11-09', numbers:{standout:['0'],twoDigit:['09'],threeDigit:['009'],running:['0']}}, fonts); assert.equal(canvas.width,900); assert.equal(canvas.height,1200); for (const text of ['09','009','เด่น','2 ตัว','3 ตัว','รูด–วิ่ง']) assert.ok(canvas.drawn.includes(text)); });
test('missing data fails before painting', async () => { const canvas = mock(); await assert.rejects(renderGuide(canvas,createTemplate(),{},fonts)); assert.deepEqual(canvas.drawn,[]); });
test('font loading cannot mix a changed guide or template into an in-flight image', async () => {
  let release;
  const pending = { ready: new Promise(resolve => { release = resolve; }), load: async () => [] };
  const canvas = mock();
  const template = createTemplate();
  const guide = {lotteryName:'ทดสอบ', drawDate:'2026-11-09', numbers:{standout:['0'],twoDigit:['09'],threeDigit:['009'],running:['0']}};
  const rendering = renderGuide(canvas, template, guide, pending);
  guide.numbers.twoDigit[0] = '99';
  template.boxes[0].field = 'text'; template.boxes[0].text = 'changed';
  release();
  await rendering;
  assert.ok(canvas.drawn.includes('09'));
  assert.ok(canvas.drawn.includes('ทดสอบ'));
  assert.ok(!canvas.drawn.includes('99'));
  assert.ok(!canvas.drawn.includes('changed'));
});
test('font failure rejects before replacing the existing preview', async () => {
  const canvas = mock(); canvas.width = 123;
  await assert.rejects(renderGuide(canvas, createTemplate(), {}, {ready: Promise.resolve(), load: async () => {throw new Error('font_failed');}}), /font_failed/);
  assert.equal(canvas.width, 123);
  assert.deepEqual(canvas.drawn, []);
});
