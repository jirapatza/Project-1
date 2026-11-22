import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareGuideInput } from '../guide-inputs.js';

test('limits external three-digit combinations to four poster slots', () => {
  const date = '2026-11-20';
  const result = prepareGuideInput({
    row: { id: 'sample' }, date,
    catalog: [{ id: 'sample' }], history: [],
    observedAt: '2026-11-20T05:00:00+07:00',
    historyUrl: 'https://example.com/history',
    external: {
      sourceUrl: 'https://example.com/guide',
      numbers: {
        standout: ['1', '2'], running: ['1', '2'],
        twoDigit: ['10', '11', '12', '13', '20', '21', '22', '23'],
        threeDigit: ['123', '124', '125', '126', '127', '128'],
      },
    },
  });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.guide.numbers.threeDigit, ['123', '124', '125', '126']);
});
