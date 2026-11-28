import test from 'node:test';
import assert from 'node:assert/strict';
import { createFormulaPanel } from '../public/formula-builder.js';

function element() {
  return {
    children: [],
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {},
  };
}

// The panel only needs a querySelector root plus the two globals it touches.
function panel(t, historyFor = () => [{ date: '2026-11-02', top3: '123', bottom2: '06' }]) {
  const previousDocument = globalThis.document;
  const previousOption = globalThis.Option;
  globalThis.document = { createElement: element };
  globalThis.Option = function (text, value) { Object.assign(this, { text, value }); };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousOption === undefined) delete globalThis.Option;
    else globalThis.Option = previousOption;
  });

  const fields = new Map();
  const field = id => {
    if (!fields.has(id)) fields.set(id, element());
    return fields.get(id);
  };
  const created = createFormulaPanel({
    root: { querySelector: selector => field(selector.slice(1)) },
    today: () => '2026-11-03',
    historyFor,
  });
  field('fLimit').value = '10';
  const card = name => field('fList').children.find(item => item.children[0]?.children[0]?.textContent === name);
  const button = (name, label) => {
    const found = card(name).children[3].children.find(item => item.textContent === label);
    assert.ok(found, `Expected button ${label} on ${name}`);
    return found;
  };
  return { ...created, field, card, button };
}

test('deleting the active formula clears its backtest without clearing a different active formula', t => {
  const { manager, field, button } = panel(t, () => [
    { date: '2026-11-02', top3: '123', bottom2: '06' },
    { date: '2026-11-01', top3: '006', bottom2: '12' },
  ]);
  manager.save({ name: 'Other formula', root: { operator: 'CONSTANT', value: 7 } });
  field('fName').value = 'Active formula';
  field('fKind').value = 'bottom2';
  field('fSave').onclick();

  assert.equal(field('fResult').children.length, 2, 'backtest is visible after saving');
  button('Other formula', 'ลบ').onclick();
  assert.equal(field('fResult').children.length, 2, 'active backtest stays visible');
  button('Active formula', 'ลบ').onclick();
  assert.equal(field('fResult').children.length, 0, 'deleted formula no longer has a visible backtest');
  assert.equal(field('fStatus').textContent, 'ลบสูตรแล้ว');
});

test('editing a saved formula keeps its base and steps when it is saved again', t => {
  const { manager, field, button } = panel(t);
  field('fName').value = 'Editable formula';
  field('fAddStep').onclick();
  const step = field('fSteps').children[0];
  step.children[0].value = 'ADD';
  step.children[0].onchange();
  step.children[2].value = '3';
  step.children[2].oninput();
  field('fSave').onclick();

  const before = field('fList').children[0].children[1].textContent;
  button('Editable formula', 'แก้ไข').onclick();
  field('fSave').onclick();

  assert.equal(field('fList').children[0].children[1].textContent, before, 'description is unchanged after re-saving');
  assert.equal(manager.list().length, 1, 're-saving updates instead of adding a second formula');
});

test('resetting the form clears the base, the constant and the kind', t => {
  const { field, tree } = panel(t);
  field('fBase').value = 'CONSTANT';
  field('fBase').onchange();
  field('fConst').value = '9';
  field('fConst').oninput();
  field('fKind').value = 'top3';
  field('fName').value = 'จะทิ้ง';
  field('fReset').onclick();

  assert.deepEqual(tree(), { operator: 'LAST_DIGIT' }, 'base is back to the default leaf');
  assert.equal(field('fBase').value, 'LAST_DIGIT');
  assert.equal(field('fConst').value, '0');
  assert.equal(field('fKind').value, 'bottom2');
  assert.equal(field('fName').value, '');
});

test('the notify toggle subscribes, shows the options and can be turned off again', t => {
  const { manager, field, card } = panel(t);
  field('fName').value = 'Notify formula';
  field('fSave').onclick();

  const notify = card('Notify formula').children[2];
  const [notifyLabel, notifyToggle, matchLabel, matchOnly, nearLabel, nearOnly] = notify.children;
  assert.equal(notifyLabel.textContent, 'แจ้งเตือน');
  assert.equal(matchOnly.disabled, true, 'options are disabled until subscribed');

  notifyToggle.checked = true;
  notifyToggle.onchange();
  assert.equal(manager.subscriptions().length, 1, 'subscribed');
  assert.equal(manager.subscriptions()[0].notifyOnMatch, true);
  assert.equal(manager.subscriptions()[0].notifyOnNearMiss, false);
  assert.equal(matchOnly.disabled, false);

  nearOnly.checked = true;
  nearOnly.onchange();
  assert.equal(manager.subscriptions()[0].notifyOnNearMiss, true, 'near-miss option is stored');
  assert.match(field('fAlerts').children[0].textContent, /Notify formula: ใกล้เคียง .* กับผล 06/);

  notifyToggle.checked = false;
  notifyToggle.onchange();
  assert.equal(manager.subscriptions().length, 0, 'unsubscribed');
});

test('a matching latest draw is reported in the alert list', t => {
  const { field } = panel(t, () => [{ date: '2026-11-02', top3: '006', bottom2: '06' }]);
  field('fName').value = 'Exact formula';
  field('fBase').value = 'LAST_2_DIGITS';
  field('fBase').onchange();
  field('fSave').onclick();

  const notifyToggle = field('fList').children[0].children[2].children[1];
  notifyToggle.checked = true;
  notifyToggle.onchange();

  const alert = field('fAlerts').children[0];
  assert.match(alert.textContent, /Exact formula: ตรง 06 กับผล 06/);
});
