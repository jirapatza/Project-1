import { readFile } from 'node:fs/promises';
import { createTemplate, validateTemplate } from './public/guide-template.js';

const origin = 'https://guide-render.invalid';
const requiredFields = ['lotteryName', 'drawDate', 'standout', 'twoDigit', 'threeDigit', 'running'];
const moduleNames = ['guide-template.js', 'guide-renderer.js'];

// Chromium runs the same Canvas exporter used by /studio without serving the
// worker or its input over the network.
export async function createGuidePngRenderer(browser, template = createTemplate()) {
  const layout = structuredClone(template);
  if (!validateTemplate(layout) ||
      !requiredFields.every(field => layout.boxes.some(box => box.field === field))) {
    throw new Error('incomplete_guide_template');
  }
  const modules = new Map(await Promise.all(moduleNames.map(async name => [
    `${origin}/${name}`, await readFile(new URL(`./public/${name}`, import.meta.url)),
  ])));
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await context.route('**/*', route => {
      const url = route.request().url();
      if (url === `${origin}/`) {
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="th"><title>Guide renderer</title></html>',
          headers: { 'Content-Security-Policy': "default-src 'none'; script-src 'self'; img-src data:" } });
      }
      const body = modules.get(url);
      return body ? route.fulfill({ contentType: 'text/javascript; charset=utf-8', body }) : route.abort();
    });
    const page = await context.newPage();
    await page.goto(`${origin}/`, { timeout: 15000 });
    return {
      async renderPng(guide) {
        const data = await page.evaluate(async ({ layout, guide }) => {
          const { exportGuidePng } = await import('/guide-renderer.js');
          const blob = await exportGuidePng(document.createElement('canvas'), layout, guide);
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
          });
        }, { layout, guide });
        return Buffer.from(data, 'base64');
      },
      close: () => context.close(),
    };
  } catch (error) {
    await context.close();
    throw error;
  }
}
