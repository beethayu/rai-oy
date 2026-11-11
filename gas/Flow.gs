// ===== ขั้นตอนอ้อยใหม่ / อ้อยตอ (flowchart ที่ผู้ใช้แก้เองได้ในแอป) =====
// ชีต Flow แถวละชนิดอ้อย: key (อ้อยใหม่|อ้อยตอ), data = JSON [{id,n,f,t,g,m,k,tool,note}], updated
const FLOW_H_ = ['key', 'data', 'updated'];
// ขั้นตอน: { n ชื่อ, k 'once'|'repeat'|'note', f–t วันนับจากวันปลูก/วันตัด (ติดลบ = ก่อนปลูก), g กลุ่มบันทึกที่นับ, m คำในบันทึก คั่น , , tool, note }
// ร่างเริ่มต้นอยู่ที่นี่ที่เดียว (หน้าเว็บรับไปทาง getInitialData.flowDef) · ผู้ใช้แก้ในแอป → ชีต Flow ทับร่างนี้
const FLOW_RT_ = 'รถไถเตรียมดิน/บำรุง';
const FLOW_WATER_NOTE_ = 'ช่วงฝนน้อยขึ้นทุก ~14 วัน วนแปลงนี้เสร็จไปแปลงถัดไป';
const FLOW_DEF_ = {
  'อ้อยใหม่': [
    { n: 'ริปเปอร์', f: -30, t: -7, g: [FLOW_RT_], m: 'ริปเปอร์', tool: 'ริปเปอร์', note: 'ถ้าดินแข็งแน่น · ดินไม่แข็งข้ามได้' },
    { n: 'ผาน 3 (ไถดะ)', f: -25, t: -5, g: [FLOW_RT_], m: 'ผาน 3', tool: 'ผาน 3' },
    { n: 'ผาน 7 (ไถแปร)', f: -14, t: -1, g: [FLOW_RT_], m: 'ผาน 7', tool: 'ผาน 7' },
    { n: 'ชักร่อง / ปลูก + ปุ๋ยรองพื้น', f: 0, t: 0, g: [FLOW_RT_, 'ใส่ปุ๋ย'], m: 'ชักร่อง,ปลูก,รองพื้น' },
    { n: 'ขึ้นน้ำครั้งแรก', f: 0, t: 3, g: ['ขึ้นน้ำ'], m: '' },
    { n: 'ฉีดยาคุมหญ้า', f: 5, t: 15, g: ['ฉีดยา'], m: '' },
    { n: 'ซ่อมอ้อย', f: 30, t: 50, g: ['ใส่ปุ๋ย'], m: 'ซ่อม' },
    { n: 'อุ้มร่อง', f: 40, t: 60, g: [FLOW_RT_], m: 'อุ้มร่อง' },
    { n: 'ถากหญ้า (คนงาน)', f: 45, t: 75, g: ['ใส่ปุ๋ย'], m: 'ถากหญ้า' },
    { n: 'ฝังปุ๋ย / ปุ๋ยแต่งหน้า', f: 60, t: 90, g: [FLOW_RT_, 'ใส่ปุ๋ย'], m: 'ฝังปุ๋ย,แต่งหน้า' },
    { n: 'ฉีดยาคุมหญ้า รอบ 2', f: 75, t: 100, g: ['ฉีดยา'], m: '' },
    { n: 'ขึ้นน้ำวนรอบ', k: 'repeat', f: 0, t: 300, g: ['ขึ้นน้ำ'], m: '', note: FLOW_WATER_NOTE_ },
    { n: 'งดน้ำ 2 เดือนก่อนตัด', k: 'note', note: 'พ.ย.–ธ.ค. ให้อ้อยสะสมความหวาน เหลือดูแค่น้ำขัง' },
    { n: 'ตัดอ้อย', f: 300, t: 420, g: ['ตัดอ้อย'], m: '' }],
  'อ้อยตอ': [
    { n: 'สับใบ / เผาใบ', f: 0, t: 7, g: [FLOW_RT_], m: 'สับ,เผา', note: 'ภายใน 1–7 วันหลังตัด' },
    { n: 'ครูดร่อง (ระหว่างแถว)', f: 3, t: 20, g: [FLOW_RT_], m: 'ครูดร่อง', tool: 'ริปเปอร์ 2 ขา', note: 'ให้เป็นแนวน้ำไหล' },
    { n: 'ขึ้นน้ำครั้งแรก', f: 10, t: 30, g: ['ขึ้นน้ำ'], m: '', note: 'รอให้อ้อยตองอกสักระยะก่อน' },
    { n: 'ฉีดยาคุมหญ้า', f: 20, t: 45, g: ['ฉีดยา'], m: '' },
    { n: 'ซ่อมตอ', f: 30, t: 50, g: ['ใส่ปุ๋ย'], m: 'ซ่อม' },
    { n: 'ถากหญ้า (คนงาน)', f: 30, t: 75, g: ['ใส่ปุ๋ย'], m: 'ถากหญ้า' },
    { n: 'ฝังปุ๋ย / ใส่ปุ๋ยอ้อยตอ', f: 30, t: 75, g: [FLOW_RT_, 'ใส่ปุ๋ย'], m: 'ฝังปุ๋ย,ปุ๋ยอ้อยตอ', note: 'ไม่ใส่ปุ๋ยทันทีหลังตัด' },
    { n: 'อุ้มร่อง', f: 60, t: 100, g: [FLOW_RT_], m: 'อุ้มร่อง' },
    { n: 'ขึ้นน้ำวนรอบ', k: 'repeat', f: 0, t: 300, g: ['ขึ้นน้ำ'], m: '', note: FLOW_WATER_NOTE_ },
    { n: 'งดน้ำ 2 เดือนก่อนตัด', k: 'note', note: 'พ.ย.–ธ.ค. ให้อ้อยสะสมความหวาน เหลือดูแค่น้ำขัง' },
    { n: 'ตัดอ้อย', f: 330, t: 420, g: ['ตัดอ้อย'], m: '' }]
};

function saveFlow(key, data) {
  key = String(key || '').trim();
  if (['อ้อยใหม่', 'อ้อยตอ'].indexOf(key) < 0) throw new Error('ชนิดอ้อยไม่ถูกต้อง');
  const js = typeof data === 'string' ? data : JSON.stringify(data || []);
  if (!Array.isArray(JSON.parse(js))) throw new Error('ข้อมูลขั้นตอนไม่ถูกต้อง');
  if (js.length > 45000) throw new Error('ขั้นตอนยาวเกินไป');
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = getOrCreate_(ss, 'Flow', FLOW_H_);
    const d = sh.getDataRange().getDisplayValues(), r = d.findIndex((row, i) => i > 0 && row[0] === key);
    const row = [[key, js, Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm')]];
    if (r > 0) sh.getRange(r + 1, 1, 1, FLOW_H_.length).setNumberFormat('@').setValues(row);
    else appendRows_(sh, row);
    return { flows: readSheet_(ss, 'Flow') };
  });
}

// ===== ถึงคิวตามขั้นตอน (ใช้ใน LINE เช้า) — กติกาเดียวกับหน้าเว็บ flInfo/flStat/flDue ใน index.html แก้ต้องแก้คู่กัน =====
function flowSteps_(ss) {
  const out = {}, rows = readSheet_(ss, 'Flow');
  ['อ้อยใหม่', 'อ้อยตอ'].forEach(k => {
    let a = null; const r = rows.find(x => x.key === k);
    try { a = JSON.parse((r && r.data) || 'null'); } catch (e) {}
    if (!Array.isArray(a) || !a.length) a = JSON.parse(JSON.stringify(FLOW_DEF_[k]));
    a.forEach(s => { s.k = s.k || 'once'; s.g = Array.isArray(s.g) ? s.g : []; s.m = s.m || ''; s.f = +s.f || 0; s.t = +s.t || 0; });
    out[k] = a;
  });
  return out;
}
function flowDay_(s) { // วันที่ (dd/mm/ปี พ.ศ. หรือ ค.ศ. มีเวลาต่อท้ายได้) → เลขวัน
  const k = dateKey_(String(s || '').trim().split(' ')[0]);
  return k ? Date.UTC(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100) / 864e5 : null;
}
function flowTrac_(d, type) {
  d = String(d || '');
  if (/ริปเปอร์/.test(d) && /ครูด/.test(d)) return type === 'อ้อยตอ' ? 'ครูดร่อง' : 'ริปเปอร์';
  if (/ครูด/.test(d) || (/ริปเปอร์/.test(d) && type === 'อ้อยตอ')) return 'ครูดร่อง';
  if (/ริปเปอร์/.test(d)) return 'ริปเปอร์';
  if (/ผาน\s*(3|สาม)|ไถดะ/.test(d)) return 'ผาน 3';
  if (/ผาน\s*(7|เจ็ด)|ไถแปร/.test(d)) return 'ผาน 7';
  if (/ชักร่อง|ปลูก/.test(d)) return 'ชักร่อง';
  if (/อุ้มร่อง/.test(d)) return 'อุ้มร่อง';
  if (/ฝังปุ๋ย/.test(d)) return 'ฝังปุ๋ย';
  return '';
}
// ชนิด + วันเริ่มนับ: ตัดอ้อยเสร็จหลังวันปลูก = เริ่มรอบอ้อยตอจากวันตัด (ไม่ต้องรอแก้วันปลูก)
function flowInfo_(p, logs, today) {
  const cuts = logs.filter(a => a.activity_group === 'ตัดอ้อย' && !String(a.remark || '').includes('กำลังทำ')).map(a => flowDay_(a.timestamp)).filter(d => d !== null && d <= today);
  const cut = cuts.length ? Math.max.apply(null, cuts) : null, pl = flowDay_(p.plant_date);
  if (cut !== null && (pl === null || cut > pl)) return { type: 'อ้อยตอ', start: cut };
  return pl === null ? null : { type: p.cane_type, start: pl };
}
// ขั้นที่ "ถึงคิว" ของแปลง: อายุอยู่ในช่วง f–t และยังไม่มีบันทึกในช่วง f−20 ถึง t+45 · ไม่เตือนขั้นตัดอ้อย (แล้วแต่คิวโรงงาน)
function flowDue_(p, logs, steps, today) {
  const inf = flowInfo_(p, logs, today); if (!inf || !steps[inf.type]) return [];
  const age = today - inf.start;
  const acts = logs.map(a => ({ g: a.activity_group, d: String(a.activity_detail || '') + ' ' + (a.activity_group === FLOW_RT_ ? flowTrac_(a.activity_detail, inf.type) : ''), age: flowDay_(a.timestamp) })).filter(a => a.age !== null).map(a => (a.age -= inf.start, a));
  return steps[inf.type].filter(s => {
    if (s.k !== 'once' || (s.g.length === 1 && s.g[0] === 'ตัดอ้อย') || age < s.f || age > s.t) return false;
    const kw = String(s.m || '').split(',').map(x => x.trim()).filter(Boolean);
    const gs = s.g.includes('ขึ้นน้ำ') ? s.g.concat('ฝนตก') : s.g;
    return !acts.some(a => gs.includes(a.g) && (!kw.length || kw.some(w => a.d.includes(w))) && a.age >= s.f - 20 && a.age <= s.t + 45);
  });
}
