import { bangkokDate, buildLotteryMatcher, dateKey, isPublishedResult, normalizeLotteryName as norm } from './history-records.js';
import { formulaOptions, calculateFormula, formulaBacktestReport, resolveFormulaDraws, summarizeFormulaBacktest } from './independent-formulas.js';
import { createFormulaPoster, formulaPosterTemplates } from './formula-poster.js';
import { describeHistoryAvailability, describeHistoryFreshness } from './history-availability.js';
const $=id=>document.getElementById(id);
const state={catalog:[],history:[],active:null,historySource:null,historyFetchedAt:null};
function indexHistory() {
  const matchLottery = buildLotteryMatcher(state.catalog);
  const today = bangkokDate();
  state.byLottery = new Map(state.catalog.map(item => [item.id, []]));
  let unmatched = 0;
  for (const row of state.history) {
    const id = matchLottery(row);
    const date = dateKey(row);
    const status = row?.status ?? row?.สถานะผล;
    if (!id) unmatched++;
    else if (date && date <= today && isPublishedResult(status)) state.byLottery.get(id).push(row);
  }
  $('unmatched').textContent = unmatched;
  for (const rows of state.byLottery.values()) rows.sort((a,b) => dateKey(b).localeCompare(dateKey(a)));
}
function tableRow(values) {
  const row = document.createElement('tr');
  for (const value of values) {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.append(cell);
  }
  return row;
}
function twoDigits(value) {
  return typeof value === 'string' && /^\d{2}$/.test(value) ? value : null;
}
function digits(row) {
  return twoDigits(row.เลขล่าง_2_ตัว) ?? twoDigits(row.เลขท้าย_2_ตัว);
}
function uniqueDraws(id, cutoff = '') {
  const byDate = new Map();
  for (const row of state.byLottery.get(id)) {
    const date = dateKey(row);
    if (!date || (cutoff && date > cutoff)) continue;
    const previous = byDate.get(date);
    if (previous === undefined) byDate.set(date, row);
    else if (!previous || digits(previous) !== digits(row) || previous.เลขบน_3_ตัว !== row.เลขบน_3_ตัว) byDate.set(date, null);
  }
  return [...byDate.values()];
}
function bars(target,counts){const max=Math.max(...counts,1);$(target).replaceChildren(...counts.map((n,i)=>{const wrap=document.createElement('div');wrap.className='barrow';const label=document.createElement('span');label.textContent=String(i);const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='fill';fill.classList.add('width-' + Math.round(n / max * 20));track.append(fill);const value=document.createElement('b');value.textContent=n;wrap.append(label,track,value);return wrap;}));}
function renderList(){const q=norm($('search').value);$('list').replaceChildren(...state.catalog.filter(x=>norm(x.name).includes(q)).map(x=>{const b=document.createElement('button');b.type='button';b.className='lottery '+(state.active===x.id?'active':'');b.textContent=x.name;b.dataset.lottery=x.id;b.setAttribute('aria-pressed',String(state.active===x.id));b.onclick=()=>select(x.id);return b;}));}
function select(id) {
  const item = state.catalog.find(x => x.id === id);
  if (!item) return;
  state.active = id;
  for (const button of $('list').children) {
    const active = button.dataset.lottery === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  const draws = uniqueDraws(id, $('historyDate').value);
  const rows = draws.filter(Boolean).slice(0, Number($('historyLimit').value));
  const skipped = draws.filter(row => !row).length;
  $('quality').textContent = `ใช้จริง ${rows.length} งวด · งวดที่ข้อมูลขัดกันและพักไว้ ${skipped}`;
  $('title').textContent = item.name;
  $('selectedCount').textContent = rows.length;
  $('n').textContent = rows.length;
  $('days').textContent = rows.length;
  $('latest').textContent = rows.length ? dateKey(rows[0]) : 'ไม่มีข้อมูล';
  const availability = describeHistoryAvailability(rows.length, Number($('historyLimit').value), state.historyFailed);
  $('status').textContent = availability.status;
  $('message').textContent = [availability.message, describeHistoryFreshness(state.historySource, state.historyFetchedAt)].filter(Boolean).join(' · ');
  const counts = Array(10).fill(0);
  const tens = Array(10).fill(0);
  const gaps = Array(10).fill(0);
  const last = Array(10).fill(-1);
  rows.forEach((row, index) => {
    const number = digits(row);
    if (!number) return;
    const unit = Number(number[1]);
    counts[unit]++;
    tens[Number(number[0])]++;
    if (last[unit] !== -1) gaps[unit] += index - last[unit] - 1;
    last[unit] = index;
  });
  bars('bars', counts);
  bars('tens', tens);
  bars('gaps', gaps);
  const periods = [];
  for (let i = 0; i < rows.length; i += 10) {
    const group = rows.slice(i, i + 10);
    periods.push(`ลำดับงวด ${i + 1}–${i + group.length} มีเลข 2 ตัว ${group.filter(digits).length} งวด`);
  }
  $('period').textContent = periods.join(' · ') || 'ไม่มีงวดในช่วงที่เลือก';
  $('history').replaceChildren(...rows.map(row => tableRow([
    dateKey(row), row.เลขบน_3_ตัว || '—', twoDigits(row.เลขล่าง_2_ตัว) || '—',
    twoDigits(row.เลขท้าย_2_ตัว) || '—', row.แหล่งข้อมูล || '—',
  ])));
}
async function fetchList(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
  const list = await response.json();
  if (!Array.isArray(list)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
  const origin = response.headers.get('X-Project1-Data');
  const fetchedAt = response.headers.get('X-Project1-Fetched-At');
  return {rows: list, source: origin, fetchedAt, archived: origin === 'archive' || origin === 'stale-cache'};
}
async function loadHistoryCoverage() {
  const status = $('historyCoverageStatus');
  try {
    const response = await fetch('/api/history-coverage');
    if (!response.ok) throw new Error('History coverage unavailable');
    const { catalogCount, readinessCounts } = await response.json();
    const windows = [10, 20, 30];
    const counts = windows.map(size => readinessCounts?.['last' + size]);
    if (!Number.isInteger(catalogCount) || catalogCount < 0 ||
        counts.some(count => !Number.isInteger(count) || count < 0 || count > catalogCount)) {
      throw new Error('Invalid history coverage');
    }
    status.textContent = 'รายการหวยที่มีข้อมูลย้อนหลังเพียงพอ · ' +
      windows.map((size, index) => size + ' งวด ' + counts[index] + '/' + catalogCount + ' รายการ').join(' · ');
  } catch {
    status.textContent = 'โหลดสรุปจำนวนงวดย้อนหลังไม่สำเร็จ';
  }
}
async function load() {
  const [catalog, history] = await Promise.allSettled([fetchList('/api/catalog'), fetchList('/api/history')]);
  state.historyFailed = history.status === 'rejected';
  state.history = history.value?.rows ?? [];
  state.historyArchived = history.value?.archived ?? false;
  state.historySource = history.value?.source ?? null;
  state.historyFetchedAt = history.value?.fetchedAt ?? null;
  $('records').textContent = state.historyFailed ? '—' : state.history.length;
  if (catalog.status === 'rejected') {
    state.catalogFailed = true;
    $('title').textContent = 'โหลดทะเบียนหวยไม่สำเร็จ';
    $('status').textContent = 'โหลดไม่สำเร็จ';
    $('trendStatus').textContent = 'โหลดทะเบียนหวยจาก Bombim00 ไม่สำเร็จ';
    $('formulaStatus').textContent = 'โหลดทะเบียนหวยไม่สำเร็จ';
    $('checkSummary').textContent = 'โหลดทะเบียนหวยไม่สำเร็จ';
    return;
  }
  state.catalog = catalog.value.rows;
  indexHistory();
  $('count').textContent = state.catalog.length;
  renderList();
  setupCatalog();
  if (state.catalog.length) select(state.catalog[0].id);
  if (!state.historyFailed) void loadHistoryCoverage();
}
$('search').addEventListener('input',renderList);
for (const id of ['historyDate','historyLimit']) $(id).addEventListener('change', () => select(state.active));

const views = {home: 'homeView', calculate: 'calculateView', stats: 'statsView', publishers: 'publishersView'};
const menus = [...document.querySelectorAll('[data-menu]')];
const names = new Map();
let publishers = [];
let archivedResults = [];
let publisherReady = false;

function setupCatalog() {
  $('homeCount').textContent = state.catalog.length;
  for (const lottery of state.catalog) names.set(lottery.id, lottery.name);
  for (const id of ['calculateLottery', 'publisherLottery']) {
    const current = $(id).value;
    $(id).replaceChildren(...state.catalog.map(item => new Option(item.name, item.id)));
    $(id).value = names.has(current) ? current : 'lao_patthana';
    if (!$(id).value && state.catalog.length) $(id).selectedIndex = 0;
  }
  const latest = state.catalog.flatMap(({id, name}) => {
    const recent = uniqueDraws(id).filter(Boolean).slice(0, 10);
    return recent.length ? [{name, recent}] : [];
  }).sort((a,b) => dateKey(b.recent[0]).localeCompare(dateKey(a.recent[0])));
  $('trendRows').replaceChildren(...latest.slice(0,10).map(({name,recent}) => {
    const [row] = recent;
    const counts = Array(10).fill(0);
    for (const draw of recent) {
      const value = digits(draw);
      if (value) counts[Number(value[1])]++;
    }
    const max = Math.max(...counts);
    const leaders = counts.flatMap((count, digit) => max && count === max ? [digit] : []);
    return tableRow([name, dateKey(row), row.เลขบน_3_ตัว || '—', twoDigits(row.เลขล่าง_2_ตัว) || '—',
      twoDigits(row.เลขท้าย_2_ตัว) || '—', max ? `${leaders.join(', ')} (${max}/${recent.length} งวด)` : '—']);
  }));
  const trendMessage = state.historyFailed ? 'โหลดผลย้อนหลังจาก Bombim00 ไม่สำเร็จ' : latest.length ?
    'ผลล่าสุดและความถี่หลักหน่วยจากข้อมูลไม่เกิน 10 งวดต่อหวย' : 'ยังไม่มีผลย้อนหลังที่จับคู่ได้';
  $('trendStatus').textContent = [trendMessage, describeHistoryFreshness(state.historySource, state.historyFetchedAt)].filter(Boolean).join(' · ');
  renderPublishers();
  if (!$('calculateView').hidden) { showCalculation(); showIndependentFormula(); }
}

function resultFor(id, date) {
  const draws = state.byLottery?.get(id)?.filter(row => dateKey(row) === date) ?? [];
  const top = new Set(draws.map(row => row.เลขบน_3_ตัว).filter(value => /^\d{3}$/.test(value ?? '')));
  const bottom = new Set(draws.map(row => twoDigits(row.เลขล่าง_2_ตัว)).filter(Boolean));
  const archive = archivedResults.find(row => row.lottery === id && row.date === date);
  return {
    top3: top.size === 1 ? [...top][0] : !top.size ? archive?.top3 : null,
    bottom2: bottom.size === 1 ? [...bottom][0] : !bottom.size ? archive?.bottom2 : null,
    source: archive && (!top.size || !bottom.size) ? archive.source : null,
  };
}
function assess(entry) {
  const {top3, bottom2} = resultFor(entry.lottery, entry.date);
  const hit = [];
  if (top3 && entry.three.includes(top3)) hit.push('3 ตัวบน ' + top3);
  if (top3 && entry.two.includes(top3.slice(-2))) hit.push('2 ตัวบน ' + top3.slice(-2));
  if (bottom2 && entry.two.includes(bottom2)) hit.push('2 ตัวล่าง ' + bottom2);
  const comparable = Boolean(entry.two.length || entry.three.length);
  const complete = (!entry.three.length || top3) && (!entry.two.length || (top3 && bottom2));
  return {hit, comparable, complete};
}
function renderPublishers() {
  if (!publisherReady) return;
  $('publisherCount').textContent = new Set(publishers.map(item => item.name)).size;
  const latest = publishers.map(item => item.date).sort().at(-1);
  const checks = publishers.map(item => ({item, ...assess(item)}));
  const evaluated = checks.filter(row => row.item.date === latest);
  $('homeHits').textContent = new Set(evaluated.filter(x => x.hit.length).map(x => x.item.name)).size;
  $('homeHitDate').textContent = latest ? `งวดที่มีเลขสำนักล่าสุด ${latest} · รอตรวจ ${evaluated.filter(x => x.comparable && !x.complete && !x.hit.length).length} รายการ` : 'ยังไม่มีเลขสำนัก';
  const lastHitDate = checks.filter(row => row.hit.length).map(row => row.item.date).sort().at(-1);
  const latestHits = checks.filter(row => row.item.date === lastHitDate && row.hit.length);
  $('homePublisherDetail').textContent = latestHits.length ?
    `งวดล่าสุดที่มีเลขตรง ${lastHitDate} · ` + latestHits.map(({item, hit}) =>
      `${names.get(item.lottery) ?? item.lottery} · ${item.name} · ${hit.join(', ')}`).join(' | ') :
    latest ? 'ยังไม่มีเลขตรงผลจริงในข้อมูลที่ตรวจได้' : 'ยังไม่มีข้อมูลเลขสำนัก';
  const lottery = $('publisherLottery').value;
  const date = $('publisherDate').value;
  const rows = publishers.filter(item => item.lottery === lottery && item.date === date);
  const {top3, bottom2, source} = resultFor(lottery, date);
  const result = $('publisherResult');
  result.textContent = rows.length ? `ผลจริง · 3 ตัวบน ${top3 ?? '—'} · 2 ตัวบน ${top3?.slice(-2) ?? '—'} · 2 ตัวล่าง ${bottom2 ?? '—'} · ` : '';
  if (rows.length && source) {
    const link = document.createElement('a');
    link.href = source;
    link.textContent = 'แหล่งผลย้อนหลัง';
    result.append(link);
  } else if (rows.length) {
    result.append(top3 || bottom2 ? (state.historyArchived ? 'สำเนาผลย้อนหลังจาก Bombim00' : 'Bombim00') : 'ยังไม่มีผลที่ยืนยันได้');
  }
  const picksByNumber = new Map();
  for (const item of rows) for (const number of [...item.two, ...item.three, ...item.run, ...item.prominent, ...item.secondary]) {
    if (!picksByNumber.has(number)) picksByNumber.set(number, new Set());
    picksByNumber.get(number).add(item.name);
  }
  const overlap = [...picksByNumber].filter(([,sources]) => sources.size >= 2)
    .map(([number,sources]) => `${number} (${[...sources].join(', ')})`);
  const checked = rows.map(item => ({item, ...assess(item)}));
  const hits = checked.filter(row => row.hit.length).map(row => row.item.name);
  const waiting = checked.filter(row => row.comparable && !row.complete && !row.hit.length).length;
  const unscorable = checked.filter(row => !row.comparable).length;
  $('publisherSummary').textContent = rows.length ?
    `${rows.length} สำนัก · มีเลขตรงผลจริง ${hits.length} สำนัก${hits.length ? ' ได้แก่ ' + hits.join(', ') : ''} · รอตรวจ ${waiting} · ไม่มีชุดที่ใช้ตรวจ ${unscorable}` :
    'ยังไม่มีข้อมูลเลขดังสำหรับหวยและวันที่เลือก';
  $('publisherOverlap').textContent = rows.length ? (overlap.length ? 'เลขชนระหว่างสำนัก ' + overlap.join(', ') : 'ยังไม่มีเลขชนในชุดที่รวบรวม') : '';
  $('publisherRows').replaceChildren(...rows.map(item => {
    const {hit,comparable,complete} = assess(item);
    const tr = tableRow([item.name, item.collected + ' น.', item.two.join(', ') || '—', item.three.join(', ') || '—',
      [item.prominent.join(', ') || '—', item.secondary.join(', ') || '—'].join(' / '),
      item.run.join(', ') || '—', hit.length ? hit.join(', ') : !comparable ? 'ไม่ระบุช่องที่ใช้ตรวจ' : complete ? 'ไม่เข้า' : 'รอผลที่ตรวจได้']);
    const link = document.createElement('a');
    link.href = item.source;
    link.textContent = 'LotteryChecks';
    tr.insertCell().append(link);
    return tr;
  }));
}
async function loadPublishers() {
  try {
    const response = await fetch('/api/publishers');
    if (!response.ok) throw new Error();
    ({publishers, results: archivedResults} = await response.json());
    publisherReady = true;
    $('publisherDate').value = publishers.map(item => item.date).sort().at(-1) || '';
    renderPublishers();
  } catch {
    $('publisherSummary').textContent = 'โหลดข้อมูลเลขสำนักไม่ได้';
  }
}
let calculationRequest;
function loadCalculation() {
  calculationRequest ??= fetch('/api/lao-backtest').then(response => {
    if (!response.ok) throw new Error();
    return response.json();
  }).catch(error => {
    calculationRequest = undefined;
    throw error;
  });
  return calculationRequest;
}
async function showLatestFormula() {
  try {
    const {results} = await loadCalculation();
    const latest = results[0];
    $('homeFormulaDetail').textContent = latest ?
      `สูตรลาวพัฒนา ${latest.date} · วิ่งล่าง ${latest.runHit ? 'เข้า (' + latest.run.filter(n => latest.bottom2.includes(n)).join(', ') + ')' : 'ไม่เข้า'} · 3 ตัวตรง ${latest.exactRank ? 'เข้า ' + latest.top3 : 'ไม่เข้า'}` :
      'ยังไม่มีผลทดสอบสูตร';
  } catch {
    $('homeFormulaDetail').textContent = 'โหลดผลทดสอบสูตรไม่สำเร็จ';
  }
}
async function showCalculation() {
  $('checkRows').replaceChildren();
  const lottery = $('calculateLottery').value;
  if (lottery !== 'lao_patthana') {
    $('checkSummary').textContent = state.catalogFailed ? 'โหลดทะเบียนหวยไม่สำเร็จ' : lottery ? 'ชุดทดสอบเดิมมีเฉพาะลาวพัฒนา' : 'กำลังโหลดรายการหวย';
    return;
  }
  $('checkSummary').textContent = 'กำลังโหลดผลทดสอบ';
  try {
    const {version, results} = await loadCalculation();
    if ($('calculateLottery').value !== lottery) return;
    const run = results.filter(row => row.runHit).length;
    const exact = results.filter(row => row.exactRank).length;
    $('checkSummary').textContent = `${version} · วิ่งล่าง ${run}/${results.length} งวด · 3 ตัวตรง ${exact}/${results.length} งวด`;
    $('checkRows').replaceChildren(...results.map(row => tableRow([
      row.date, row.run.join(', '), row.bottom2, row.runHit ? 'เข้า' : 'ไม่เข้า',
      row.exact3.join(', '), row.top3, row.exactRank ? 'เข้าอันดับ ' + row.exactRank : 'ไม่เข้า',
    ])));
  } catch {
    if ($('calculateLottery').value === lottery) $('checkSummary').textContent = 'โหลดผลทดสอบไม่ได้ กรุณาลองอีกครั้ง';
  }
}
const formulaToStudio = $('formulaToStudio');
let posterVersion = 0;
let posterUrl = '';
let posterDetails = null;
let posterLottery = '';
const posterTemplate = $('formulaPosterTemplate');
const posterTemplateNames = { standard: 'น้ำเงิน–ทอง', 'lao-gold': 'แดง–ทอง · มังกรลาว' };
function updatePosterTemplates(lottery) {
  if (posterLottery === lottery) return;
  posterLottery = lottery;
  const options = formulaPosterTemplates(lottery);
  posterTemplate.replaceChildren(...options.map(value => new Option(posterTemplateNames[value], value)));
}
posterTemplate.onchange = () => {
  if (!posterDetails) return;
  clearFormulaPoster();
  void prepareFormulaPoster(posterLottery, posterDetails);
};
function clearFormulaPoster() {
  posterVersion++;
  $('formulaPoster').hidden = true;
  $('formulaPosterStatus').textContent = '';
  $('formulaPosterPreview').removeAttribute('src');
  $('formulaPosterDownload').removeAttribute('href');
  if (posterUrl) URL.revokeObjectURL(posterUrl);
  posterUrl = '';
}
async function prepareFormulaPoster(lottery, details) {
  const version = posterVersion;
  formulaToStudio.textContent = posterTemplate.value === 'lao-gold'
    ? 'แก้เฉพาะเลขในห้องทำใบแนว' : 'ใช้ผลคำนวณในห้องทำใบแนว';
  $('formulaPosterStatus').textContent = 'กำลังสร้างใบแนวจากสูตร';
  try {
    const blob = await createFormulaPoster({ ...details, lotteryId: lottery, template: posterTemplate.value });
    if (version !== posterVersion) return;
    posterUrl = URL.createObjectURL(blob);
    $('formulaPosterPreview').src = posterUrl;
    $('formulaPosterDownload').href = posterUrl;
    $('formulaPosterDownload').download = `guide-formula-${lottery}-${details.drawDate}.png`;
    $('formulaPoster').hidden = false;
    $('formulaPosterStatus').textContent = '';
  } catch {
    if (version === posterVersion) $('formulaPosterStatus').textContent = 'สร้างใบแนวไม่ได้ ลองเปลี่ยนสูตรหรือโหลดหน้าใหม่';
  }
}

function showIndependentFormula() {
  clearFormulaPoster();
  posterDetails = null;
  $('formulaPosterTemplateField').hidden = true;
  formulaToStudio.disabled = true;
  formulaToStudio.onclick = null;
  const lottery = $('calculateLottery').value;
  updatePosterTemplates(lottery);
  const date = $('formulaDate').value;
  const laoOption = [...$('formulaChoice').options].find(option => option.value === 'lao_divide_three');
  if (laoOption && lottery !== 'lao_patthana' && $('formulaChoice').value === laoOption.value) $('formulaChoice').value = 'weekday';
  if (laoOption) laoOption.disabled = lottery !== 'lao_patthana';
  const id = $('formulaChoice').value;
  $('formulaRows').replaceChildren();
  $('formulaPrediction').textContent = '';
  $('formulaHistoryStatus').textContent = '';
  $('formulaSummary').textContent = '';
  if (!lottery || !state.byLottery?.has(lottery)) {
    $('formulaStatus').textContent = state.catalogFailed ? 'โหลดทะเบียนหวยไม่สำเร็จ' : 'กำลังโหลดรายการหวย';
    return;
  }
  const draws = resolveFormulaDraws(state.byLottery.get(lottery).map(row => ({
    date: dateKey(row),
    top3: typeof row.เลขบน_3_ตัว === 'string' && /^\d{3}$/.test(row.เลขบน_3_ตัว) ? row.เลขบน_3_ตัว : '',
    bottom2: twoDigits(row.เลขล่าง_2_ตัว) || (lottery === 'thai_gov' ? twoDigits(row.เลขท้าย_2_ตัว) : '') || '',
  }))).filter(row => row.date < date);
  const result = calculateFormula(id, date, draws);
  if (result.error) {
    $('formulaStatus').textContent = result.error;
  } else {
    const selected = formulaOptions.find(item => item.id === id);
    $('formulaStatus').textContent = `${selected.name} · งวด ${date}` +
      (result.usedDraws ? ` · ใช้ข้อมูล ${result.usedDraws} งวด ล่าสุด ${result.latestDraw}` : ' · ไม่ใช้ผลย้อนหลัง');
    const parts = [`เลขเด่น ${result.primary.join(', ')}`];
    if (result.secondary.length) parts.push(`เลขรอง ${result.secondary.join(', ')}`);
    if (result.pairs.length) parts.push(`2 ตัว ${result.pairs.join(', ')}`);
    if (result.triples.length) parts.push(`3 ตัว ${result.triples.join(', ')}`);
    if (result.calculation) parts.push(`วิธีคิด ${result.calculation}`, 'นับเลขถัดจาก 9 เป็น 0', 'ใช้งวดล่าสุดที่มีข้อมูล กรุณาตรวจว่าเป็นงวดก่อนหน้าจริง');
    $('formulaPrediction').textContent = parts.join(' · ');
    const lotteryName = state.catalog.find(item => item.id === lottery)?.name;
    if (lotteryName) {
      posterDetails = { lotteryName, drawDate: date, formulaName: selected.name, result };
      $('formulaPosterTemplateField').hidden = posterTemplate.options.length < 2;
      void prepareFormulaPoster(lottery, posterDetails);
      formulaToStudio.disabled = false;
      formulaToStudio.onclick = () => {
        try {
          const locked = posterTemplate.value === 'lao-gold';
          sessionStorage.setItem('project1-formula-draft', JSON.stringify({
            lotteryName, drawDate: date, standout: result.primary.join(' '),
            twoDigit: result.pairs.join(' '), threeDigit: result.triples.join(' '),
            running: locked ? result.primary.join(' ') : '',
            lockedLotteryId: locked ? lottery : null, expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          }));
          location.href = '/studio';
        } catch {
          $('formulaStatus').textContent = 'ส่งผลไปห้องทำใบแนวไม่ได้ เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูลชั่วคราว';
        }
      };
    }
  }
  const limit = Number($('formulaLimit').value);
  const backtest = formulaBacktestReport(id, draws, limit);
  const scored = backtest.filter(row => !row.reason);
  const summary = summarizeFormulaBacktest(scored);
  const describe = metric => metric.trials ?
    metric.hits + '/' + metric.trials + ' (' + (metric.rate * 100).toFixed(1) + '%)' +
    ' · คาดสุ่ม ' + metric.expectedHits.toFixed(2) + ' ครั้ง (' +
    (metric.expectedRate * 100).toFixed(1) + '%)' : 'ไม่มีข้อมูล';
  $('formulaSummary').textContent = 'เลขเด่น: ' + describe(summary.primary) + ' · 2 ตัวตรง: ' + describe(summary.pairs) + ' · 3 ตัวตรง: ' + describe(summary.triples);
  const source = state.historyFailed ? 'โหลดผลย้อนหลังไม่สำเร็จ' : describeHistoryFreshness(state.historySource, state.historyFetchedAt);
  const conflicts = draws.filter(row => row.conflict).length;
  $('formulaHistoryStatus').textContent = `${source ? source + ' · ' : ''}พบข้อมูล ${draws.length - conflicts} งวดก่อนวันเลือก · ข้อมูลขัดกัน ${conflicts} งวด · มีข้อมูลในช่วง ${backtest.length}/${limit} งวด · ตรวจได้ ${scored.length}/${backtest.length} งวด`;
  $('formulaRows').replaceChildren(...backtest.map(row => tableRow([
    row.date, row.reason ?? 'ตรวจแล้ว', row.prediction?.primary.join(', ') || '—', row.primaryHit == null ? '—' : row.primaryHit ? 'ตรง' : 'ไม่ตรง',
    row.prediction?.pairs.join(', ') || '—', row.bottom2 ?? '—', !row.prediction ? '—' : !row.prediction.pairs.length ? 'ไม่ใช้สูตรนี้' : row.pairHit === null ? 'ไม่มีข้อมูล' : row.pairHit ? 'ตรง' : 'ไม่ตรง',
    row.prediction?.triples.join(', ') || '—', row.top3 ?? '—', !row.prediction ? '—' : !row.prediction.triples.length ? 'ไม่ใช้สูตรนี้' : row.tripleHit === null ? 'ไม่มีข้อมูล' : row.tripleHit ? 'ตรง' : 'ไม่ตรง',
  ])));
}
const bangkokToday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date());
const tomorrow = new Date(`${bangkokToday}T12:00:00Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
$('formulaDate').value = tomorrow.toISOString().slice(0, 10);
$('formulaChoice').replaceChildren(...formulaOptions.map(item => new Option(item.name, item.id)));
for (const id of ['formulaChoice', 'formulaDate', 'formulaLimit']) $(id).addEventListener('change', showIndependentFormula);
for (const button of menus) button.onclick = () => {
  const menu = button.dataset.menu;
  for (const item of menus) item.setAttribute('aria-pressed', String(item === button));
  for (const [key, id] of Object.entries(views)) $(id).hidden = key !== menu;
  if (menu === 'calculate') { showCalculation(); showIndependentFormula(); }
  if (menu === 'publishers') renderPublishers();
  fetch('/api/usage', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({menu})}).catch(() => {});
};
$('calculateLottery').onchange = () => { showCalculation(); showIndependentFormula(); };
$('publisherDate').onchange = renderPublishers;
$('publisherLottery').onchange = () => {
  const available = publishers.filter(row => row.lottery === $('publisherLottery').value).map(row => row.date);
  if (available.length && !available.includes($('publisherDate').value)) $('publisherDate').value = available.sort().at(-1);
  renderPublishers();
};
$('trendStatus').textContent = 'กำลังโหลดผลย้อนหลัง';
load();
loadPublishers();
showLatestFormula();
