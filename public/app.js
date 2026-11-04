import { backtest, formulas } from './formulas.js';
const $=id=>document.getElementById(id);
const state={catalog:[],history:[],active:null};
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/วีไอพี/g,'vip').replace(/นิคเคอิ/g,'นิเคอิ').replace(/หวยหุ้น|หวย|รอบ|\s|[.\-_()]/g,'');
const aliases={thai_gov:['สลากกินแบ่งรัฐบาล'],gsb:['หวยออมสิน'],baac:['หวย ธ.ก.ส.'],lao_patthana:['หวยลาวพัฒนา'],nikkei_morning:['หวยหุ้นนิคเคอิเช้า','หวยหุ้นนิเคอิเช้า'],nikkei_afternoon:['หวยหุ้นนิคเคอิบ่าย','หวยหุ้นนิเคอิบ่าย'],china_morning:['หวยหุ้นจีนเช้า'],china_afternoon:['หวยหุ้นจีนบ่าย'],hangseng_morning:['หวยหุ้นฮั่งเส็งเช้า'],hangseng_afternoon:['หวยหุ้นฮั่งเส็งบ่าย'],dowjones:['หวยหุ้นดาวโจนส์'],dowjones_star:['หวยหุ้นดาวโจนส์พิเศษ'],russia:['หวยหุ้นรัสเซีย'],singapore:['หวยหุ้นสิงคโปร์'],india:['หวยหุ้นอินเดีย'],taiwan:['หวยหุ้นไต้หวัน'],korea:['หวยหุ้นเกาหลี'],england:['หวยหุ้นอังกฤษ'],thai_stock_evening:['หวยหุ้นไทยเย็น'],hanoi_regular:['ฮานอยปกติ'],hanoi_special:['ฮานอยพิเศษ'],hanoi_vip:['ฮานอย VIP']};
// Matching is intentionally conservative. Ambiguous records stay unmatched instead of being assigned incorrectly.
function candidates(item){return new Set([item.name,...(aliases[item.id]||[])].map(norm));}
function dateKey(row) {
  const date = String(row.วันที่จัดรูปแบบ || row.draw_date || row.งวดวันที่ || '').trim();
  const dotted = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const iso = dotted ? `${dotted[3]}-${dotted[2]}-${dotted[1]}` : date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const parsed = new Date(iso);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === iso ? iso : '';
}
function indexHistory() {
  const matches = new Map();
  for (const item of state.catalog) {
    for (const key of candidates(item).add(norm(item.id))) {
      if (!key) continue;
      if (!matches.has(key)) matches.set(key, new Set());
      matches.get(key).add(item.id);
    }
  }
  state.byLottery = new Map(state.catalog.map(item => [item.id, []]));
  let unmatched = 0;
  for (const row of state.history) {
    const ids = new Set([row.ชื่อหวย, row.หวย].flatMap(value => [...(matches.get(norm(value)) || [])]));
    if (ids.size === 1) state.byLottery.get(ids.values().next().value).push(row);
    else unmatched++;
  }
  $('unmatched').textContent = unmatched;
  for (const rows of state.byLottery.values()) rows.sort((a,b) => dateKey(b).localeCompare(dateKey(a)));
}
function formulaResults(rows) {
  const formula = formulas.find(item => item.id === $('formula').value);
  const dates = new Map();
  let undated = 0;
  for (const row of rows) {
    const date = dateKey(row);
    if (!date) { undated++; continue; }
    if (!dates.has(date)) dates.set(date, new Set());
    const number = digits(row);
    if (number) dates.get(date).add(number);
  }
  const draws = [...dates].reverse().map(([date, values]) => ({
    date, number: values.size === 1 ? values.values().next().value : null,
  }));
  const results = backtest(draws, formula, Number($('historyLimit').value));
  const hits = results.filter(result => result.hit).length;
  const incomplete = draws.filter(draw => !draw.number).length;
  $('formulaMeta').textContent = `${formula.id} · รุ่น ${formula.version} · ใช้เลข 2 ตัวจาก ${formula.lookback} งวดก่อนหน้า`;
  $('quality').textContent = `ระเบียนที่ไม่มีวันที่ใช้ได้ ${undated} · วันที่เลข 2 ตัวขาดหรือขัดแย้ง ${incomplete} · ระเบียนซ้ำวัน ${rows.length - undated - draws.length}`;
  $('formulaStats').textContent = results.length
    ? `ตรง ${hits}/${results.length} งวด (${(hits / results.length * 100).toFixed(1)}%) · ${results.at(-1).date} ถึง ${results[0].date}`
    : 'ข้อมูลยังไม่พอสำหรับทดสอบสูตรในช่วงที่เลือก';
  $('formulaRows').replaceChildren(...results.map(result => tableRow([
    result.date, result.calculated, result.number, result.hit ? 'ตรง' : 'ไม่ตรง',
  ])));
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
function digits(row){const x=String(row.เลขล่าง_2_ตัว??row.เลขท้าย_2_ตัว??'');return /^\d{2}$/.test(x)?x:null;}
function bars(target,counts){const max=Math.max(...counts,1);$(target).replaceChildren(...counts.map((n,i)=>{const wrap=document.createElement('div');wrap.className='barrow';const label=document.createElement('span');label.textContent=String(i);const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='fill';fill.style.width=`${n/max*100}%`;track.append(fill);const value=document.createElement('b');value.textContent=n;wrap.append(label,track,value);return wrap;}));}
function renderList(){const q=norm($('search').value);$('list').replaceChildren(...state.catalog.filter(x=>norm(x.name).includes(q)).map(x=>{const b=document.createElement('button');b.type='button';b.className='lottery '+(state.active===x.id?'active':'');b.textContent=x.name;b.onclick=()=>select(x.id);return b;}));}
function select(id){const item=state.catalog.find(x=>x.id===id);if(!item)return;state.active=id;renderList();const rows=state.byLottery.get(id);formulaResults(rows);$('title').textContent=item.name;$('selectedCount').textContent=rows.length;$('n').textContent=rows.length;$('days').textContent=new Set(rows.map(x=>x.งวดวันที่).filter(Boolean)).size;$('latest').textContent=rows[0]?.งวดวันที่||'ไม่มีข้อมูล';$('status').textContent=rows.length?'มีข้อมูลย้อนหลัง':'ยังไม่มีข้อมูล';$('message').textContent=rows.length?'แสดงเฉพาะข้อมูลที่จับคู่ชื่อได้อย่างชัดเจน':'ยังไม่พบข้อมูลย้อนหลังที่จับคู่กับรายการนี้ได้อย่างปลอดภัย';const counts=Array(10).fill(0);for(const r of rows){const v=digits(r);if(v)counts[Number(v[1])]++;}bars('bars',counts);const tens=Array(10).fill(0);const gaps=Array(10).fill(0);const last=Array(10).fill(-1);rows.forEach((r,index)=>{const v=digits(r);if(!v)return;tens[Number(v[0])]++;const d=Number(v[1]);if(last[d]!==-1)gaps[d]+=index-last[d]-1;last[d]=index;});bars('tens',tens);bars('gaps',gaps);const recent=rows.slice(0,Math.min(10,rows.length));const older=rows.slice(10,20);$('period').textContent=`10 งวดล่าสุด: ${recent.filter(r=>digits(r)).length} งวดที่มีข้อมูล 2 ตัว | 10 งวดก่อนหน้า: ${older.filter(r=>digits(r)).length} งวดที่มีข้อมูล 2 ตัว`;$('history').replaceChildren(...rows.slice(0,Number($('historyLimit').value)).map(r=>{const tr=document.createElement('tr');for(const value of [r.งวดวันที่||'—',r.เลขบน_3_ตัว||'—',digits(r)||'—',r.แหล่งข้อมูล||'—']){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}return tr;}));}
async function load(){try{const [a,b]=await Promise.all([fetch('/api/catalog'),fetch('/api/history')]);if(!a.ok||!b.ok)throw Error('โหลดข้อมูลไม่สำเร็จ');const [catalog,history]=await Promise.all([a.json(),b.json()]);if(!Array.isArray(catalog)||!Array.isArray(history))throw Error('รูปแบบข้อมูลไม่ถูกต้อง');state.catalog=catalog;state.history=history;indexHistory();$('count').textContent=catalog.length;$('records').textContent=history.length;renderList();if(catalog.length)select(catalog[0].id);}catch(e){$('title').textContent='เชื่อมต่อไม่สำเร็จ';$('status').textContent='ผิดพลาด';$('message').textContent=e.message;}}
$('search').addEventListener('input',renderList);$('logout').addEventListener('click',async()=>{await fetch('/api/logout',{method:'POST'});location.href='/';});for (const formula of formulas) $('formula').add(new Option(formula.name, formula.id));
for (const id of ['formula', 'historyLimit']) $(id).addEventListener('change', () => select(state.active));
load();
