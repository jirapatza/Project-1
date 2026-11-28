// DOM panel for building, saving and testing user formulas.
import { createFormulaManager, KINDS } from './formula-manager.js';
import {
  bangkokParts, binaryOperators, leafOperators, backtestFormulaTree, summarizeBacktest,
  contextForDate, decomposeTree,
} from './formula-engine.js';

export function createFormulaPanel({ root, historyFor, today = () => bangkokParts('').isoDate }) {
  const $ = id => root.querySelector('#' + id);
  const manager = createFormulaManager();
  const draft = { name: '', kind: 'bottom2', base: 'LAST_DIGIT', constant: '0', steps: [] };
  let activeId = null;

  const option = (value, label) => new Option(label, String(value));

  const baseSelect = $('fBase');
  baseSelect.replaceChildren(...leafOperators.map(item => option(item.id, item.name)));
  baseSelect.value = draft.base;
  const syncBase = () => {
    draft.base = baseSelect.value;
    $('fConst').hidden = draft.base !== 'CONSTANT';
    renderResult();
  };
  baseSelect.onchange = syncBase;
  $('fConst').oninput = () => { draft.constant = $('fConst').value; renderResult(); };
  $('fKind').onchange = renderResult;
  syncBase();

  function leafSelect(selected) {
    const select = document.createElement('select');
    select.append(...leafOperators.map(item => option(item.id, item.name)));
    select.value = selected;
    return select;
  }

  function operandRow(step, index) {
    const row = document.createElement('div');
    row.className = 'f-step';
    const operator = document.createElement('select');
    operator.append(...binaryOperators.map(item => option(item.id, item.name)));
    operator.value = step.operator;
    const operand = leafSelect(step.operand);
    const constant = document.createElement('input');
    constant.inputMode = 'numeric';
    constant.maxLength = 6;
    constant.value = step.constant ?? '0';
    constant.setAttribute('aria-label', 'ตัวเลขคงที่');
    const drop = document.createElement('button');
    drop.type = 'button';
    drop.className = 'f-drop';
    drop.textContent = 'ลบขั้น';
    drop.setAttribute('aria-label', `ลบขั้นที่ ${index + 1}`);
    const sync = () => {
      step.operator = operator.value;
      step.operand = operand.value;
      step.constant = constant.value;
      constant.hidden = operand.value !== 'CONSTANT';
    };
    operator.onchange = sync;
    operand.onchange = sync;
    constant.oninput = sync;
    drop.onclick = () => { draft.steps.splice(index, 1); renderSteps(); };
    row.append(operator, operand, constant, drop);
    sync();
    return row;
  }

  function renderSteps() {
    const host = $('fSteps');
    host.replaceChildren(...draft.steps.map(operandRow));
    const add = $('fAddStep');
    add.disabled = draft.steps.length >= 6;
  }

  function tree() {
    let root = draft.base === 'CONSTANT'
      ? { operator: 'CONSTANT', value: Number(draft.constant) || 0 }
      : { operator: draft.base };
    for (const step of draft.steps) {
      const right = step.operand === 'CONSTANT'
        ? { operator: 'CONSTANT', value: Number(step.constant) || 0 }
        : { operator: step.operand };
      root = { operator: step.operator, left: root, right };
    }
    return root;
  }

  function status(message) {
    $('fStatus').textContent = message;
  }

  function renderList() {
    const host = $('fList');
    const formulas = manager.list();
    if (!formulas.length) {
      const empty = document.createElement('p');
      empty.className = 'note';
      empty.textContent = 'ยังไม่มีสูตรที่บันทึกไว้';
      host.replaceChildren(empty);
      return;
    }
    host.replaceChildren(...formulas.map(formula => {
      const card = document.createElement('article');
      card.className = 'f-card';
      const head = document.createElement('div');
      head.className = 'f-card-head';
      const title = document.createElement('strong');
      title.textContent = formula.name;
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = formula.enabled;
      toggle.id = `f-enabled-${formula.id}`;
      toggle.setAttribute('aria-label', `เปิดใช้สูตร ${formula.name}`);
      toggle.onchange = () => { manager.setEnabled(formula.id, toggle.checked); renderList(); };
      const label = document.createElement('label');
      label.htmlFor = toggle.id;
      label.textContent = 'เปิดใช้';
      head.append(title, label, toggle);

      const detail = document.createElement('p');
      detail.className = 'note';
      detail.textContent = `${formula.description} · ${KINDS[formula.kind]?.name ?? formula.kind}`;

      const subscription = manager.subscriptions().find(item => item.formulaId === formula.id) ?? null;
      const notify = document.createElement('div');
      notify.className = 'f-actions';
      const notifyToggle = document.createElement('input');
      notifyToggle.type = 'checkbox';
      notifyToggle.id = `f-notify-${formula.id}`;
      notifyToggle.checked = Boolean(subscription?.enabled);
      notifyToggle.setAttribute('aria-label', `แจ้งเตือนสูตร ${formula.name}`);
      const notifyLabel = document.createElement('label');
      notifyLabel.htmlFor = notifyToggle.id;
      notifyLabel.textContent = 'แจ้งเตือน';
      const matchOnly = document.createElement('input');
      matchOnly.type = 'checkbox';
      matchOnly.id = `f-notify-match-${formula.id}`;
      matchOnly.checked = subscription ? subscription.notifyOnMatch : true;
      matchOnly.setAttribute('aria-label', `แจ้งเตือนเมื่อตรงสูตร ${formula.name}`);
      const matchLabel = document.createElement('label');
      matchLabel.htmlFor = matchOnly.id;
      matchLabel.textContent = 'เมื่อตรง';
      const nearOnly = document.createElement('input');
      nearOnly.type = 'checkbox';
      nearOnly.id = `f-notify-near-${formula.id}`;
      nearOnly.checked = Boolean(subscription?.notifyOnNearMiss);
      nearOnly.setAttribute('aria-label', `แจ้งเตือนเมื่อใกล้เคียงสูตร ${formula.name}`);
      const nearLabel = document.createElement('label');
      nearLabel.htmlFor = nearOnly.id;
      nearLabel.textContent = 'เมื่อใกล้เคียง';
      const syncNotify = () => {
        if (!notifyToggle.checked) {
          manager.unsubscribe(formula.id);
        } else {
          manager.subscribe(formula.id, { notifyOnMatch: matchOnly.checked, notifyOnNearMiss: nearOnly.checked });
        }
        matchOnly.disabled = !notifyToggle.checked;
        nearOnly.disabled = !notifyToggle.checked;
        renderAlerts();
      };
      notifyToggle.onchange = syncNotify;
      matchOnly.onchange = syncNotify;
      nearOnly.onchange = syncNotify;
      for (const box of [matchOnly, nearOnly]) box.disabled = !notifyToggle.checked;
      notify.append(notifyLabel, notifyToggle, matchLabel, matchOnly, nearLabel, nearOnly);

      const actions = document.createElement('div');
      actions.className = 'f-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'แก้ไข';
      edit.onclick = () => {
        activeId = formula.id;
        const decomposed = decomposeTree(formula.root);
        if (decomposed) {
          draft.base = decomposed.base;
          draft.constant = decomposed.constant;
          draft.steps = decomposed.steps.map(s => ({ operator: s.operator, operand: s.operand, constant: s.constant }));
        } else {
          draft.base = 'LAST_DIGIT';
          draft.constant = '0';
          draft.steps = [];
        }
        draft.name = formula.name;
        draft.kind = formula.kind;
        $('fName').value = formula.name;
        $('fKind').value = formula.kind;
        $('fBase').value = draft.base;
        $('fConst').value = draft.constant;
        $('fConst').hidden = draft.base !== 'CONSTANT';
        renderSteps();
        status(`กำลังแก้ไข ${formula.name}`);
      };
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'f-danger';
      remove.textContent = 'ลบ';
      remove.onclick = () => {
        manager.remove(formula.id);
        if (activeId === formula.id) {
          activeId = null;
          renderResult();
        }
        renderList();
        status('ลบสูตรแล้ว');
      };
      actions.append(edit, remove);
      card.append(head, detail, notify, actions);
      return card;
    }));
  }

  function renderResult() {
    const host = $('fResult');
    host.replaceChildren();
    const formula = activeId ? manager.get(activeId) : null;
    if (!formula) {
      status('เลือกสูตรจากรายการด้านบนเพื่อคำนวณ');
      return;
    }
    const lottery = $('fLottery').value;
    const draws = historyFor(lottery);
    const latest = draws.find(row => row && row.date) ?? null;
    const context = contextForDate(today(), {
      firstPrize: latest?.top3, top3: latest?.top3, bottom2: latest?.bottom2, drawDate: latest?.date,
    }, manager.profile());
    const results = manager.run(context, {});
    const mine = results.find(item => item.formulaId === formula.id);
    if (!mine || mine.error) {
      status(mine?.error ?? 'คำนวณไม่ได้');
      return;
    }
    const parts = [`ค่าดิบ ${mine.value}`, `${mine.numbers.length} เลข: ${mine.numbers.join(', ')}`];
    if (latest?.date) parts.push(`อ้างอิงงวด ${latest.date}`);
    else parts.push('ไม่มีผลย้อนหลังของหวยนี้');
    status(parts.join(' · '));

    const limit = Number($('fLimit').value);
    const backtest = backtestFormulaTree(formula, draws, limit);
    const summary = summarizeBacktest(backtest);
    const summaryRow = document.createElement('p');
    summaryRow.className = 'note';
    summaryRow.textContent = summary.trials
      ? `ตรวจ ${summary.trials} งวด · ตรง ${summary.hits} · ใกล้เคียง ${summary.near} · อัตราตรง ${(summary.rate * 100).toFixed(1)}% · ฐานสุ่ม ${(summary.expectedRate * 100).toFixed(1)}%`
      : 'ไม่มีงวดที่ตรวจได้ในช่วงที่เลือก';
    const table = document.createElement('div');
    table.className = 'scroll';
    table.tabIndex = 0;
    table.setAttribute('role', 'region');
    table.setAttribute('aria-label', 'ตารางผลทดสอบสูตร เลื่อนดูข้อมูลเพิ่มเติมได้');
    const body = document.createElement('tbody');
    body.replaceChildren(...backtest.map(row => {
      const cells = row.reason
        ? [row.date, row.reason, '—', '—']
        : [row.date, row.numbers.join(', '), row.actual, row.hit ? 'ตรง' : row.matchType === 'near' ? 'ใกล้เคียง' : 'ไม่เข้า'];
      const tr = document.createElement('tr');
      for (const value of cells) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      return tr;
    }));
    const head = document.createElement('thead');
    const hr = document.createElement('tr');
    for (const value of ['งวด', 'เลขที่คำนวณ', 'ผลจริง', 'เทียบผล']) {
      const th = document.createElement('th');
      th.textContent = value;
      hr.append(th);
    }
    head.append(hr);
    table.append(head, body);
    host.append(summaryRow, table);
  }

  function renderAlerts() {
    const host = $('fAlerts');
    if (!host) return;
    const latest = historyFor($('fLottery').value).find(row => row && row.date) ?? null;
    const context = contextForDate(today(), {
      firstPrize: latest?.top3, top3: latest?.top3, bottom2: latest?.bottom2, drawDate: latest?.date,
    }, manager.profile());
    const alerts = manager.alertsFor(manager.run(context, {
      top3: latest?.top3 ?? '', bottom2: latest?.bottom2 ?? '',
    }));
    host.replaceChildren();
    if (!alerts.length) {
      const empty = document.createElement('p');
      empty.className = 'note';
      empty.textContent = latest?.date
        ? `ไม่มีการแจ้งเตือนของงวด ${latest.date}`
        : 'ยังไม่มีผลของงวดนี้ให้เทียบ';
      host.append(empty);
      return;
    }
    for (const alert of alerts) {
      const line = document.createElement('p');
      line.className = 'note';
      line.textContent = `${alert.name}: ${alert.matchType === 'exact' ? 'ตรง' : 'ใกล้เคียง'} ${alert.numbers.join(', ')} กับผล ${alert.actual}`;
      host.append(line);
    }
  }

  function render() {
    renderList();
    renderResult();
    renderAlerts();
  }

  $('fAddStep').onclick = () => {
    if (draft.steps.length >= 6) return;
    draft.steps.push({ operator: 'ADD', operand: 'CONSTANT', constant: '0' });
    renderSteps();
  };
  $('fSave').onclick = () => {
    const saved = manager.save({
      id: activeId ?? undefined,
      name: draft.name || $('fName').value,
      kind: $('fKind').value,
      root: tree(),
    });
    if (saved.error) { status(saved.error); return; }
    activeId = saved.value.id;
    render();
    status(`บันทึก ${saved.value.name} แล้ว`);
  };
  $('fReset').onclick = () => {
    activeId = null;
    draft.name = '';
    draft.kind = 'bottom2';
    draft.base = 'LAST_DIGIT';
    draft.constant = '0';
    draft.steps = [];
    $('fName').value = '';
    $('fKind').value = draft.kind;
    $('fBase').value = draft.base;
    $('fConst').value = draft.constant;
    $('fConst').hidden = true;
    renderSteps();
    render();
    status('ล้างฟอร์มแล้ว');
  };
  $('fProfileSave').onclick = () => {
    manager.setProfile({
      birthDay: $('fBirthDay').value,
      birthMonth: $('fBirthMonth').value,
      birthYear: $('fBirthYear').value,
    });
    renderResult();
    status('บันทึกวันเกิดที่ใช้คำนวณแล้ว');
  };
  for (const id of ['fLottery', 'fLimit']) $(id).onchange = () => { renderResult(); renderAlerts(); };

  const profile = manager.profile();
  $('fBirthDay').value = profile.birthDay;
  $('fBirthMonth').value = profile.birthMonth;
  $('fBirthYear').value = profile.birthYear;
  renderSteps();
  render();

  return { render, draft, tree, manager };
}
