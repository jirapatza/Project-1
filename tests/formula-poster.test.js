import test from 'node:test';
import assert from 'node:assert/strict';
import { formulaPosterSections } from '../public/formula-poster.js';

test('the poster retains leading zeros and derives doubles from the computed standout digits', () => {
  const sections = formulaPosterSections({ primary: [0, 1], pairs: ['02', '10'], triples: ['012'] });
  assert.deepEqual(sections.map(section => section.values), [
    ['0', '1'], ['00', '11'], ['02', '10'], ['012'],
  ]);
});

test('a formula that produces standout digits only leaves the pair and triple panels out', () => {
  const sections = formulaPosterSections({ primary: [8, 9], pairs: [], triples: [] });
  assert.deepEqual(sections.map(section => section.values), [['8', '9'], ['88', '99']]);
});
