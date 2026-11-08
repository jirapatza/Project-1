export const normalizeLotteryName = s=>String(s||'').normalize('NFKC').toLowerCase().replace(/วีไอพี/g,'vip').replace(/นิคเคอิ/g,'นิเคอิ').replace(/หวยหุ้น|หวย|รอบ|\s|[.\-_()]/g,'');
const aliases={thai_gov:['สลากกินแบ่งรัฐบาล'],gsb:['หวยออมสิน'],baac:['หวย ธ.ก.ส.'],lao_patthana:['หวยลาวพัฒนา','laoslotto','หวยลาว รอบ 20:30'],nikkei_morning:['หวยหุ้นนิคเคอิเช้า','หวยหุ้นนิเคอิเช้า'],nikkei_afternoon:['หวยหุ้นนิคเคอิบ่าย','หวยหุ้นนิเคอิบ่าย'],nikkei_vip_morning:['หวยหุ้นนิคเคอิ VIP เช้า','หวยหุ้นนิเคอิ VIP เช้า'],nikkei_vip_afternoon:['หวยหุ้นนิคเคอิ VIP บ่าย','หวยหุ้นนิเคอิ VIP บ่าย'],china_morning:['หวยหุ้นจีนเช้า'],china_afternoon:['หวยหุ้นจีนบ่าย'],china_vip_morning:['หวยหุ้นจีน VIP เช้า'],china_vip_afternoon:['หวยหุ้นจีน VIP บ่าย'],hangseng_morning:['หวยหุ้นฮั่งเส็งเช้า'],hangseng_afternoon:['หวยหุ้นฮั่งเส็งบ่าย'],hangseng_vip_morning:['หวยหุ้นฮั่งเส็ง VIP เช้า'],hangseng_vip_afternoon:['หวยหุ้นฮั่งเส็ง VIP บ่าย'],dowjones:['หวยหุ้นดาวโจนส์'],russia:['หวยหุ้นรัสเซีย'],singapore:['หวยหุ้นสิงคโปร์'],india:['หวยหุ้นอินเดีย'],taiwan:['หวยหุ้นไต้หวัน'],korea:['หวยหุ้นเกาหลี'],england:['หวยหุ้นอังกฤษ'],thai_stock_evening:['หวยหุ้นไทยเย็น'],hanoi_regular:['ฮานอยปกติ'],hanoi_special:['ฮานอยพิเศษ'],hanoi_vip:['ฮานอย VIP']};
// Ambiguous names stay unmatched, including when two recognized fields disagree.
export function buildLotteryMatcher(catalog) {
  const names = new Map();
  for (const item of catalog) {
    if (typeof item?.id !== 'string' || !item.id) continue;
    const extra = Object.hasOwn(aliases, item.id) ? aliases[item.id] : [];
    const labels = [item.id, item.name, ...extra];
    for (const label of labels) {
      const name = normalizeLotteryName(label);
      if (!name) continue;
      const ids = names.get(name) ?? new Set();
      ids.add(item.id);
      names.set(name, ids);
    }
  }
  return row => {
    const labels = [row?.ชื่อหวย, row?.หวย];
    const ids = new Set(labels.flatMap(label => [...(names.get(normalizeLotteryName(label)) ?? [])]));
    return ids.size === 1 ? ids.values().next().value : null;
  };
}

export function dateKey(row) {
  const date = String(row?.วันที่จัดรูปแบบ || row?.draw_date || row?.งวดวันที่ || '').trim();
  const dotted = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const thai = date.match(/^(\d{1,2}) (\S+) (\d{4})$/);
  const months = 'มกราคม กุมภาพันธ์ มีนาคม เมษายน พฤษภาคม มิถุนายน กรกฎาคม สิงหาคม กันยายน ตุลาคม พฤศจิกายน ธันวาคม'.split(' ');
  const month = thai ? months.indexOf(thai[2]) + 1 : 0;
  const iso = month ? `${Number(thai[3]) - 543}-${String(month).padStart(2,'0')}-${thai[1].padStart(2,'0')}` : dotted ? `${dotted[3]}-${dotted[2]}-${dotted[1]}` : date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const parsed = new Date(iso);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === iso ? iso : '';
}

export function bangkokDate(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError('Invalid date');
  }
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const publishedStatuses = new Set(['complete', 'completed', 'published', 'success', 'final']);

export function isPublishedResult(status) {
  return status == null || (typeof status === 'string' && publishedStatuses.has(status.toLowerCase()));
}
