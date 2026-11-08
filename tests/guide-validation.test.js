import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGuide } from '../guide-validation.js';
const context = { lotteryId: 'lao', drawDate: '2026-11-09', catalog: [{ id: 'lao' }, { id: 'lao_vip' }] };
const fixture = () => ({ lotteryId: 'lao', drawDate: context.drawDate, fetchedAt: '2026-11-07T00:00:00Z', sourceUrl: 'https://example.com/test-fixture', numbers: { standout: ['0'], twoDigit: ['09'], threeDigit: ['009'], running: ['0'] } });
test('retains leading zeros and copies source without mutation', () => { const input = fixture(); const result = validateGuide(input, context); assert.equal(result.ok, true); assert.deepEqual(result.guide.numbers.threeDigit, ['009']); result.guide.numbers.twoDigit.push('99'); assert.equal(input.numbers.twoDigit.length, 1); });
test('rejects a different round and wrong or impossible date', () => { for (const patch of [{lotteryId:'lao_vip'}, {drawDate:'2026-11-08'}, {drawDate:'2026-02-30'}]) assert.equal(validateGuide({...fixture(), ...patch}, context).ok, false); });
test('rejects incomplete fields and numeric coercion', () => { for (const value of [undefined, [], [9], ['9'], ['009']]) { const input = fixture(); input.numbers.twoDigit = value; assert.equal(validateGuide(input, context).ok, false); } });
test('requires provenance and fetched time', () => { for (const patch of [{sourceUrl:'javascript:alert(1)'}, {fetchedAt:''}]) assert.equal(validateGuide({...fixture(), ...patch}, context).ok, false); });
