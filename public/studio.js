import {canvasPoint,hitBox,movedBox} from './guide-geometry.js';
import {createTemplate,validateTemplate} from './guide-template.js';
import {renderGuide,exportGuidePng} from './guide-renderer.js';
const $=id=>document.getElementById(id), canvas=$('preview');
let template=createTemplate(), history=[], serial=0;
let backgroundRequest=0;
const fields=['lotteryName','drawDate','standout','twoDigit','threeDigit','running'];
const guide=()=>({lotteryName:$('lotteryName').value,drawDate:$('drawDate').value,numbers:Object.fromEntries(fields.slice(2).map(key=>[key,$(key).value.trim().split(/[\s,]+/).filter(Boolean)]))});
const snapshot=()=>JSON.stringify({template,values:Object.fromEntries(fields.map(k=>[k,$(k).value]))});
function restore(saved){const state=JSON.parse(saved);template=state.template;fields.forEach(k=>$(k).value=state.values[k]);}
function checkpoint(){history.push(snapshot());if(history.length>50)history.shift();}
async function draw(){const turn=++serial;try{const temp=document.createElement('canvas');await renderGuide(temp,template,guide());if(turn!==serial)return;canvas.width=temp.width;canvas.height=temp.height;canvas.getContext('2d').drawImage(temp,0,0);$('status').textContent='ตัวอย่างจากเลขที่กรอก';}catch{if(turn===serial)$('status').textContent='ไม่สามารถแสดงภาพได้ ตรวจข้อความและขนาดช่อง';}}
function properties(){const box=template.boxes.find(b=>b.id===$('box').value);$('properties').replaceChildren();if(!box)return;$('font').value=box.fontFamily||'sans-serif';for(const [key,title] of [['x','ตำแหน่งแนวนอน'],['y','ตำแหน่งแนวตั้ง'],['width','ความกว้าง'],['height','ความสูง'],['fontSize','ขนาดตัวอักษร'],['color','สีตัวอักษร'],...(box.field==='text'?[['text','ข้อความ']]:[])]){const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');input.type=key==='color'?'color':key==='text'?'text':'number';input.value=box[key];input.addEventListener('change',()=>{const next=structuredClone(template);next.boxes.find(b=>b.id===box.id)[key]=input.type==='number'?Number(input.value):input.value;if(!validateTemplate(next)){input.value=box[key];$('status').textContent='ช่องต้องอยู่ภายในภาพ';return;}checkpoint();template=next;draw();});label.append(input);$('properties').append(label);}}
function refresh(){const selected=$('box').value;$('box').replaceChildren(...template.boxes.map(b=>new Option(b.id,b.id)));if(template.boxes.some(b=>b.id===selected))$('box').value=selected;$('background').value=template.background;properties();draw();}
fields.forEach(key=>{ $(key).addEventListener('focus',checkpoint); $(key).addEventListener('input',draw); });$('box').onchange=properties;
$('background').oninput=()=>{checkpoint();template.background=$('background').value;draw();};
$('undo').onclick=()=>{if(history.length){backgroundRequest++;restore(history.pop());refresh();}};
$('add').onclick=()=>{checkpoint();template.boxes.push({id:crypto.randomUUID(),field:'text',text:'ข้อความ',x:50,y:150,width:800,height:60,fontSize:32,color:'#ffffff'});refresh();};
$('remove').onclick=()=>{checkpoint();template.boxes=template.boxes.filter(b=>b.id!==$('box').value);refresh();};
const savedStudioKey = 'project1-studio-v1';
function savedStudio() {
  const data = JSON.parse(localStorage.getItem(savedStudioKey));
  if (!data || !validateTemplate(data.template)) return null;
  if (data.values && (!Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now())) {
    delete data.values;
    delete data.expiresAt;
    localStorage.setItem(savedStudioKey, JSON.stringify(data));
  }
  return data;
}
$('save').onclick = () => {
  try {
    const values = Object.fromEntries(fields.map(key => [key, $(key).value]));
    localStorage.setItem(savedStudioKey, JSON.stringify({
      template, values, expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }));
    $('status').textContent = 'บันทึกแม่แบบแล้ว เก็บเลขฉบับร่าง 24 ชั่วโมง';
  } catch {
    $('status').textContent = 'บันทึกไม่ได้ พื้นที่เครื่องอาจเต็ม';
  }
};
$('load').onclick = () => {
  try {
    const data = savedStudio();
    if (!data) throw new Error('missing_template');
    backgroundRequest++;
    checkpoint();
    template = data.template;
    for (const key of fields) {
      $(key).value = typeof data.values?.[key] === 'string' ? data.values[key] : '';
    }
    refresh();
  } catch {
    $('status').textContent = 'ไม่พบแบบที่เปิดได้';
  }
};
try { savedStudio(); } catch { /* Editing remains available without browser storage. */ }
$('export').onclick=async()=>{
  const data=guide();
  const numberFields=[['standout',1],['twoDigit',2],['threeDigit',3],['running',1]];
  if(!data.lotteryName.trim()||!data.drawDate||numberFields.some(([key,width])=>{
    const values=data.numbers[key];
    const pattern=new RegExp(`^[0-9]{${width}}$`);
    return !values.length||values.some(value=>!pattern.test(value));
  })){
    $('status').textContent='ตรวจชื่อหวย งวด และจำนวนหลักของเลขให้ครบ';
    return;
  }
  if(numberFields.some(([key])=>new Set(data.numbers[key]).size!==data.numbers[key].length)){
    $('status').textContent='ลบเลขซ้ำในช่องเดียวกันก่อนดาวน์โหลด';
    return;
  }
  try{
    const blob=await exportGuidePng(document.createElement('canvas'),template,data);
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;
    link.download=`guide-${data.drawDate}.png`;
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    $('status').textContent='สร้าง PNG แล้ว';
  }catch{
    $('status').textContent='สร้าง PNG ไม่ได้ ตรวจภาพพื้นหลังและขนาดช่อง';
  }
};
let formulaDraftLoaded=false;
try{
  const key='project1-formula-draft';
  const raw=sessionStorage.getItem(key);
  if(raw){
    sessionStorage.removeItem(key);
    const draft=JSON.parse(raw);
    if(Number.isFinite(draft.expiresAt)&&Date.now()<draft.expiresAt&&fields.every(key=>typeof draft[key]==='string')){
      fields.forEach(key=>$(key).value=draft[key]);
      formulaDraftLoaded=true;
    }
  }
}catch{/* Manual entry remains available when storage is disabled. */}
refresh();
if(formulaDraftLoaded)$('draftHint').textContent='นำเข้าจากหน้าสูตรแล้ว ตรวจข้อมูลและกรอกช่องที่ว่างก่อนดาวน์โหลด';

const availableGuides = $('availableGuides');
const guideFeedStatus = $('guideFeedStatus');
let readyGuides = [];
$('fetchGuides').onclick = async () => {
  $('fetchGuides').disabled = true;
  $('availableGuidesLabel').hidden = true;
  guideFeedStatus.textContent = 'กำลังโหลดใบแนว';
  readyGuides = [];
  try {
    const response = await fetch('/api/guide-inputs');
    if (!response.ok) throw new Error('Guide inputs unavailable');
    const { catalog, confirmedDraws, guides, date } = await response.json();
    const names = new Map(catalog.map(({ id, name }) => [id, name]));
    const confirmed = new Set(confirmedDraws.filter(draw => draw.drawDate === date).map(draw => draw.lotteryId));
    readyGuides = guides.filter(guide => guide.drawDate === date && confirmed.has(guide.lotteryId) &&
      names.has(guide.lotteryId) && fields.slice(2).every(key => Array.isArray(guide.numbers?.[key])));
    availableGuides.replaceChildren(new Option('เลือกหวย', ''), ...readyGuides.map((guide, index) =>
      new Option(names.get(guide.lotteryId), String(index))));
    $('availableGuidesLabel').hidden = readyGuides.length === 0;
    guideFeedStatus.textContent = readyGuides.length ? 'เลือกใบแนวเพื่อนำมาใส่ในแบบ' : 'ยังไม่มีใบแนวพร้อมใช้ในช่วงเวลานี้';
  } catch {
    guideFeedStatus.textContent = 'โหลดใบแนวอัตโนมัติไม่ได้ ยังสามารถกรอกเลขหรือใช้ผลจากหน้าสูตรได้';
  } finally {
    $('fetchGuides').disabled = false;
  }
};
availableGuides.onchange = () => {
  if (!availableGuides.value) return;
  const input = readyGuides[Number(availableGuides.value)];
  if (!input) return;
  checkpoint();
  $('lotteryName').value = availableGuides.selectedOptions[0].textContent;
  $('drawDate').value = input.drawDate;
  for (const key of fields.slice(2)) $(key).value = input.numbers[key].join(' ');
  guideFeedStatus.textContent = 'นำเข้าใบแนวแล้ว ตรวจตัวอย่างแล้วกดดาวน์โหลด PNG';
  draw();
};

let drag=null;
const point=event=>canvasPoint(event.clientX,event.clientY,canvas.getBoundingClientRect(),template.width,template.height);
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0 || drag)return;
  const start=point(event),box=hitBox(template.boxes,start);if(!box)return;
  drag={pointerId:event.pointerId,start,box:structuredClone(box),before:snapshot()};
  $('box').value=box.id;properties();canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!drag || event.pointerId!==drag.pointerId)return;
  const now=point(event),index=template.boxes.findIndex(b=>b.id===drag.box.id);
  if(index<0)return;
  template.boxes[index]=movedBox(drag.box,now.x-drag.start.x,now.y-drag.start.y,template.width,template.height);draw();
});
function finishDrag(event){
  if(!drag || event.pointerId!==drag.pointerId)return;
  if(event.type==='pointercancel')restore(drag.before);
  else if(snapshot()!==drag.before){history.push(drag.before);if(history.length>50)history.shift();}
  drag=null;properties();draw();
}
canvas.addEventListener('pointerup',finishDrag);
canvas.addEventListener('pointercancel',finishDrag);
canvas.addEventListener('lostpointercapture',finishDrag);

$('font').onchange=()=>{const box=template.boxes.find(b=>b.id===$('box').value);if(!box)return;checkpoint();box.fontFamily=$('font').value;draw();};

$('backgroundFile').onchange=async()=>{
  const input=$('backgroundFile');
  const file=input.files[0];
  if(!file)return;
  input.value='';
  const request=++backgroundRequest;
  try{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2000000)throw Error();
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
    const img=new Image();img.src=data;await img.decode();
    if(request!==backgroundRequest)return;
    const next={...template,backgroundImage:data};if(!validateTemplate(next))throw Error();
    checkpoint();template=next;draw();
  }catch{
    if(request===backgroundRequest)$('status').textContent='เปิดภาพไม่ได้ ใช้ PNG/JPEG/WebP ขนาดไม่เกิน 2 MB';
  }
};
$('clearBackground').onclick=()=>{backgroundRequest++;checkpoint();delete template.backgroundImage;draw();};
