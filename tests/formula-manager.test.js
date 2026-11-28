import test from 'node:test';
import assert from 'node:assert/strict';
import { createFormulaManager, memoryStorage } from '../public/formula-manager.js';
import { contextForDate } from '../public/formula-engine.js';

const root = { operator: 'CONSTANT', value: 6 };

test('saved formulas and profile persist; deleting removes subscriptions', () => {
  const storage = memoryStorage();
  const manager = createFormulaManager({ storage });
  const { value: formula } = manager.save({ name: 'สูตรแรก', kind: 'top3', root });
  manager.subscribe(formula.id);
  manager.setProfile({ birthDay: 12, birthMonth: 3, birthYear: 2540 });
  const reopened = createFormulaManager({ storage });
  assert.equal(reopened.get(formula.id).outputLength, 3);
  assert.equal(reopened.profile().birthDay, 12);
  reopened.setEnabled(formula.id, false);
  assert.deepEqual(reopened.run(contextForDate('2026-11-05')), []);
  assert.equal(reopened.remove(formula.id), true);
  assert.deepEqual(reopened.subscriptions(), []);
});

test('local alert candidates honor exact and near preferences', () => {
  const manager = createFormulaManager({ storage: memoryStorage() });
  const { value: formula } = manager.save({ name: 'ทดลอง', root });
  const check = bottom2 => manager.alertsFor(manager.run(contextForDate('2026-11-05'), { bottom2 }));
  manager.subscribe(formula.id, { notifyOnMatch: false, notifyOnNearMiss: true });
  assert.deepEqual(check('06'), []);
  assert.equal(check('45')[0].matchType, 'near');
  manager.subscribe(formula.id);
  assert.deepEqual(check('45'), []);
  assert.equal(check('06')[0].matchType, 'exact');
});
