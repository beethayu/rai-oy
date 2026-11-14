// ===== ขั้นตอนอ้อยใหม่ / อ้อยตอ (flowchart ที่ผู้ใช้แก้เองได้ในแอป) =====
// ชีต Flow แถวละชนิดอ้อย: key (อ้อยใหม่|อ้อยตอ), data = JSON [ขั้น…], updated
//   + แถวคำตอบรายแปลง key 'ans:<plot_id>', data = JSON {id ขั้น: {v คำตอบ, d วันที่ตอบ yyyy-mm-dd}}
const FLOW_H_ = ['key', 'data', 'updated'];
// ร่างเริ่มต้นอยู่ที่นี่ที่เดียว (หน้าเว็บรับไปทาง getInitialData.flowDef) · ผู้ใช้แก้ในแอป → ชีต Flow ทับร่างนี้
// ชนิดขั้น/ฟิลด์: ดูคำอธิบายที่ flowNorm_ ข้างล่าง · id ขึ้นต้น d = ขั้นจากร่าง (หน้าเว็บใช้ดูว่าผังในชีตเป็นร่างใหม่หรือยัง)
const FLOW_RT_ = 'รถไถเตรียมดิน/บำรุง';
const FLOW_WATER_NOTE_ = 'ห้ามขาดน้ำเกิน 20 วัน (อายุ 1–6 เดือน) · 30 วัน (6–10 เดือน) · ช่วงฝนน้อยวนทุก ~14 วัน แปลงนี้เสร็จไปแปลงถัดไป';
const FLOW_DRY_NOTE_ = '2 เดือนก่อนตัด (พ.ย.–ธ.ค.) ให้อ้อยสะสมความหวาน เหลือดูแค่น้ำขัง';
const FLOW_CUT_ = q => ({ id: 'cut', n: 'ตัดอ้อย', k: 'ask', g: ['ตัดอ้อย'], m: '', q,
  o: [{ v: 'keep', l: 'ไว้ตอ', go: 'ratoon' }, { v: 'new', l: 'รื้อตอ', go: 'replant' }],
  note: 'ตามคิวโรงงาน · ไม่มีเครื่องวัดความหวาน ตัดตามคิว · รื้อเมื่อตอตายมาก หรือไว้ตอครบ 3–4 ปี' });
const FLOW_DEF_ = {
  'อ้อยใหม่': [
    // เตรียมดินจริงของไร่ (บันทึกตาจง/พร ม.ค.–เม.ย. 69) ทำต่อกันตามลำดับ (sq): ขั้นก่อนเสร็จ → ขั้นต่อไปถึงคิว ไม่ผูกวันปลูก
    //   เริ่มเมื่อตัดแล้วตอบ "รื้อตอ" หรือวันปลูกยังไม่ถึง · sq 2 = ทอยอ้อย (ปลูก) บันทึกทอยแล้ว = เริ่มนับอายุ · f/t ของขั้น sq ใช้แค่จัดระยะในผัง
    { id: 'p1', sq: 1, n: 'ผาน 7 รื้อตอ', f: -90, t: -1, g: [FLOW_RT_], m: 'ผาน 7,รื้อตอ,ริปเปอร์', tool: 'ผาน 7 (ดินแข็ง/แม่ยา: ริปเปอร์ 2 ขา รถใหญ่)', note: 'ดินแข็ง/แม่ยา ใช้ริปเปอร์ 2 ขาแทนผาน 7' },
    { id: 'p2', sq: 1, n: 'ผาน 4 รอบ 1 (ไถดะ)', f: -90, t: -1, g: [FLOW_RT_], m: 'ผาน 4,ไถดะ', tool: 'ผาน 4' },
    { id: 'p3', sq: 1, n: 'ผาน 4 รอบ 2 (ไถแปร)', f: -90, t: -1, g: [FLOW_RT_], m: 'ผาน 4,ไถแปร', tool: 'ผาน 4', note: 'ดินก้อนใหญ่ → ผาน 4 รอบ 3 ก่อนชักร่อง (จดได้ตามปกติ)' },
    { id: 'p4', sq: 1, n: 'ผานชักร่อง', f: -90, t: -1, g: [FLOW_RT_], m: 'ชักร่อง', tool: 'ผานชักร่อง', note: 'ชักร่องแล้วรอพันธุ์/คนงาน 2–6 สัปดาห์ เป็นปกติ' },
    { id: 'p5', sq: 1, n: 'ตัดพันธุ์อ้อย', f: -90, t: -1, g: [], m: 'ตัดพันธุ์,ท่อนพันธุ์,ลำพันธุ์' },
    { id: 'p6', sq: 2, n: 'ทอยอ้อย (ปลูก)', f: 0, t: 0, g: [], m: 'ทอย,ปลูก', x: 'ซ่อม,ชักร่อง', tool: 'รถไถหางทอย', note: 'รถไถวางลำ คนสับท่อนละ 3 ตา วางคู่สลับหัวท้าย · วันทอย = วันปลูก (แอปเริ่มนับอายุจากวันนี้)' },
    { id: 'p7', n: 'ฝังปุ๋ยรองพื้น + กลบ', f: 0, t: 7, g: [FLOW_RT_, 'ใส่ปุ๋ย'], m: 'รองพื้น,กลบ', tool: 'รถไถเล็ก', note: 'คนตามกลบ' },
    { id: 'd7', n: 'ขึ้นน้ำครั้งแรก', k: 'branch', f: 0, t: 3, g: ['ขึ้นน้ำ'], m: '',
      b: { c: 'ฝนหนัก น้ำขัง', n: 'ขุดร่องระบายน้ำ', w: 3, g: [], m: 'ระบาย,ขุดร่อง,สูบน้ำ', cm: 'น้ำขัง' } },
    { id: 'd8', rev: 4, n: 'ฉีดยาคุมหญ้า', f: 6, t: 20, af: 'd7', ad: [6, 13], g: ['ฉีดยา'], m: '', note: 'ลำดับ ปลูก → กลบปุ๋ย → ขึ้นน้ำ → รอดินหมาดคนเดินได้ → ฉีด (ไร่ทำหลังขึ้นน้ำ 6–13 วัน) · พยากรณ์ฝนหนักใน 1–2 วันให้เลื่อน · ยาคุมต้องเป็นงานสุดท้ายที่แตะหน้าดิน · หญ้าขึ้นหลังฉีด = คนถาก' },
    { id: 'd9', n: 'ซ่อมอ้อย', k: 'repeat', f: 21, t: 35, g: ['ใส่ปุ๋ย'], m: 'ซ่อม', max: 2, cond: 'ช่องว่างเกิน 75 ซม.', gap: 14,
      note: 'ครั้งที่ 1 ภายใน 3–4 สัปดาห์ · ครั้งที่ 2 ไม่เกินวันที่ 50' },
    { id: 'd10', rev: 4, n: 'อุ้มร่อง', f: 40, t: 60, g: [FLOW_RT_], m: 'อุ้มร่อง', tool: 'รถไถเล็ก (~12 ไร่/วัน)', note: 'พรวนดินข้างกอ · สับหญ้า/ครูดร่อง จดแยกเป็นคนละงาน ไม่นับเป็นอุ้มร่อง' },
    { id: 'd11', rev: 4, n: 'ถากหญ้า (คนงาน)', k: 'repeat', f: 45, t: 75, g: ['ใส่ปุ๋ย'], m: 'ถากหญ้า', max: 3, cond: 'หญ้าขึ้นอีก', gap: 30, note: 'หญ้าขึ้นหลังฉีดยาคุม อ้อยใหม่ใช้คนถาก (ไม่ใช้รถสับ)' },
    { id: 'd12', n: 'ฝังปุ๋ย ครั้งที่ 1', f: 45, t: 60, g: [FLOW_RT_, 'ใส่ปุ๋ย'], m: 'ฝังปุ๋ย,แต่งหน้า,ครั้งที่ 1', x: 'ล้มหลังร่อง,ล้มร่อง,พูนโคน' },
    { id: 'd13', rev: 4, n: 'ฉีดยารอบ 2 คุม + ฆ่า', f: 75, t: 100, g: ['ฉีดยา'], m: '', note: 'ไร่ใช้ บีคาโน (คุม) + ไซทรอน (ฆ่าใบกว้าง/เถา) + อะมีทรีน (คุม + ฆ่าหญ้าเล็ก ต้องมีความชื้น) · หยุดฉีดเมื่อใบปิดร่อง · ก่อนหรือหลังล้มหลังร่อง รอตกลง' },
    { id: 'd17', tool: 'รถไถเล็ก + ถังฝังปุ๋ย', n: 'ล้มหลังร่อง + พูนโคน + ปุ๋ยครั้งที่ 2', f: 90, t: 135, g: [FLOW_RT_, 'ใส่ปุ๋ย'], m: 'ล้มหลังร่อง,ล้มร่อง,พูนโคน,ครั้งที่ 2,ฝังปุ๋ย', note: 'งานเดียวกัน: ล้มดินหลังร่องเข้าโคน + ปุ๋ยข้างแถว · อายุ 3–4 เดือน ก่อนรถเข้าแปลงยาก · หลังจากนี้ขึ้นน้ำผ่านร่องกลางแถวใหม่' },
    { id: 'd15', n: 'ขึ้นน้ำวนรอบ', k: 'note', f: 121, t: 240, g: ['ขึ้นน้ำ'], m: '', note: FLOW_WATER_NOTE_ },
    { id: 'd16', n: 'งดน้ำก่อนตัด', k: 'note', f: 241, t: 300, note: FLOW_DRY_NOTE_ },
    Object.assign(FLOW_CUT_('ตัดแล้วไว้ตอต่อไหม?'), { f: 300, t: 420 })],
  'อ้อยตอ': [ // เรียงตามวัน · rev เพิ่มเมื่อแก้ขั้นในร่าง (หน้าเว็บขึ้นกล่อง "ร่างมีขั้นใหม่")
    { id: 'd1', rev: 3, n: 'จัดการใบอ้อย', k: 'ask', f: 0, t: 7, g: [], m: '', q: 'ตัดแล้วจัดการใบยังไง?', note: 'แต่ละแปลง แต่ละปีไม่เหมือนกัน ถามทุกครั้งที่ตัด (ขึ้นคำตอบปีก่อนให้ดู) · ตัดชิดดิน (รถจ้าง) · กรมวิชาการเกษตร 2568 แนะนำใช้ใบคลุมดิน ช่วยลดหนอนกอ',
      o: [{ v: 'burn', l: 'เผา', go: 'next', m: 'เผา' }, { v: 'mulch', l: 'สับใบ', go: 'next', m: 'สับใบ' }, { v: 'rake', l: 'กวาดใบ + อัดใบ', go: 'next', m: 'กวาด,อัดใบ,อัดก้อน' }] },
    { id: 'd2', n: 'ไถ + ลงริปเปอร์', f: 1, t: 7, g: [FLOW_RT_], m: 'ไถ,ริปเปอร์,ครูด', w: { a: 'd1', v: 'burn' }, note: 'ตอที่เผาแล้ว' },
    { id: 'd4', rev: 3, n: 'สับใบ', k: 'branch', f: 1, t: 7, g: [FLOW_RT_], m: 'สับใบ', w: { a: 'd1', v: 'mulch' },
      b: { c: 'ใบยังไม่ผสมดิน', n: 'สับใบซ้ำ', w: 40, g: [FLOW_RT_], m: 'สับใบ' } },
    { id: 'd15', rev: 2, n: 'กวาดใบ + อัดใบ', f: 0, t: 7, g: [], m: 'กวาด,อัดใบ,อัดก้อน', tool: 'รถจ้าง', w: { a: 'd1', v: 'rake' } },
    { id: 'd5', n: 'ครูดร่อง (ระหว่างแถว)', f: 3, t: 20, g: [FLOW_RT_], m: 'ครูดร่อง', tool: 'ริปเปอร์ 2 ขา', w: { a: 'd1', v: 'mulch,rake' }, note: 'ให้เป็นแนวน้ำไหล' },
    { id: 'd6', rev: 4, n: 'ขึ้นน้ำครั้งแรก', f: 10, t: 30, g: ['ขึ้นน้ำ'], m: '', note: 'รอให้อ้อยตองอกสักระยะก่อน (วิธีของไร่) · ดินต้องชื้นก่อนฝังปุ๋ย' },
    { id: 'd7', n: 'ซ่อมตอ', k: 'repeat', f: 15, t: 30, g: ['ใส่ปุ๋ย'], m: 'ซ่อม', max: 2, cond: 'ตอตายเป็นช่วง', gap: 10,
      note: 'ภายใน 30 วันหลังตัด ช้ากว่านี้ต้นซ่อมโดนตอข้าง ๆ บังแสง' },
    { id: 'd9', n: 'ถากหญ้า (คนงาน)', k: 'repeat', f: 30, t: 75, g: ['ใส่ปุ๋ย'], m: 'ถากหญ้า', max: 3, cond: 'หญ้าขึ้นอีก', gap: 30 },
    { id: 'd12', rev: 4, n: 'สับหญ้า (รถ)', f: 45, t: 75, g: [FLOW_RT_], m: 'สับหญ้า,ครูดหญ้า', tool: 'รถไถเล็ก', note: 'อ้อยตอที่ยังไม่ฉีดยาคุม หญ้าขึ้น → รถสับ' },
    { id: 'd10', rev: 4, tool: 'รถไถใหญ่', note: 'ดินชื้นก่อน (ขึ้นน้ำ/ฝน) แล้วฝังปุ๋ย ค่อยขึ้นน้ำตาม · ประวัติไร่ 60–86 วันหลังตัด (ติดงานปลูกอ้อยใหม่ทุกปี) · รถไถใหญ่กลบหญ้าไปในตัว', n: 'ปุ๋ยอ้อยตอ ครั้งที่ 1', f: 60, t: 86, g: [FLOW_RT_, 'ใส่ปุ๋ย'], m: 'ฝังปุ๋ย,ปุ๋ยอ้อยตอ,ครั้งที่ 1', x: 'ล้มหลังร่อง,ล้มร่อง,พูนโคน,ครั้งที่ 2', note: 'อายุ 1–2 เดือน ไม่ใส่ทันทีหลังตัด · กรมวิชาการเกษตร 2568: ตอนดินชื้น (ฟอสฟอรัสเต็ม + N, K อย่างน้อย 1 ใน 3)' },
    { id: 'd17', rev: 4, n: 'ขึ้นน้ำตามหลังฝังปุ๋ย', f: 62, t: 95, af: 'd10', ad: [0, 7], g: ['ขึ้นน้ำ'], m: '', note: 'ให้ปุ๋ยละลาย ตออ้อยแตกรากใหม่' },
    { id: 'd8', rev: 4, n: 'ฉีดยาคุมหญ้า', k: 'ask', f: 65, t: 110, af: 'd17', ad: [5, 14], g: ['ฉีดยา'], m: '', q: 'อ้อยตอแปลงนี้ฉีดยาคุมไหม?', note: 'ประวัติไร่ ปี 69 อ้อยตอไม่ได้ฉีด (ใช้รถสับ/ไถใหญ่กลบหญ้า) · ถ้าฉีด: หลังขึ้นน้ำ รอดินหมาด',
      o: [{ v: 'yes', l: 'ฉีด', go: 'do' }, { v: 'no', l: 'ไม่ฉีด', go: 'skip' }] },
    { id: 'd16', rev: 2, tool: 'รถไถเล็ก + ถังฝังปุ๋ย', n: 'ล้มหลังร่อง + พูนโคน + ปุ๋ยครั้งที่ 2', f: 90, t: 120, g: [FLOW_RT_, 'ใส่ปุ๋ย'], m: 'ล้มหลังร่อง,ล้มร่อง,พูนโคน,ครั้งที่ 2,ฝังปุ๋ย', note: 'งานเดียวกัน: ล้มดินหลังร่องเข้าโคน + ปุ๋ยข้างแถว · อายุ 3–4 เดือน (กรมวิชาการเกษตร 2568) ใส่ N, K ที่เหลือ · เขตชลประทานเพิ่ม N 1.5 เท่า' },
    { id: 'd13', n: 'ขึ้นน้ำวนรอบ', k: 'note', f: 121, t: 240, g: ['ขึ้นน้ำ'], m: '', note: FLOW_WATER_NOTE_ },
    { id: 'd14', n: 'งดน้ำก่อนตัด', k: 'note', f: 241, t: 300, note: FLOW_DRY_NOTE_ },
    Object.assign(FLOW_CUT_('ตัดแล้วไว้ตอต่อไหม?'), { f: 330, t: 420 })]
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


// คำตอบรายแปลง (การ์ดคำถามหน้าแรก / ปุ่มในผัง) v ว่าง = ลบคำตอบ
function saveFlowAns(plotId, id, v, d) {
  plotId = String(plotId || '').trim(); id = String(id || '').trim(); v = String(v || '').trim();
  if (!plotId || !id || id.length > 80 || v.length > 40) throw new Error('คำตอบไม่ถูกต้อง');
  d = /^\d{4}-\d\d-\d\d$/.test(String(d || '')) ? d : Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = getOrCreate_(ss, 'Flow', FLOW_H_), key = 'ans:' + plotId;
    const rows = sh.getDataRange().getDisplayValues(), r = rows.findIndex((row, i) => i > 0 && row[0] === key);
    let m = {}; try { m = JSON.parse((r > 0 && rows[r][1]) || '{}') || {}; } catch (e) {}
    if (v) m[id] = { v, d }; else delete m[id];
    const row = [[key, JSON.stringify(m), Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm')]];
    if (r > 0) sh.getRange(r + 1, 1, 1, FLOW_H_.length).setNumberFormat('@').setValues(row);
    else appendRows_(sh, row);
    return { flows: readSheet_(ss, 'Flow') };
  });
}

// ===== ถึงคิวตามขั้นตอน (ใช้ใน LINE เช้า) — กติกาเดียวกับหน้าเว็บ flInfo/flCtx ใน index.html แก้ต้องแก้คู่กัน =====
// ===== แกนคิดสถานะขั้นตอน 📋 — โค้ดชุดเดียวกันทั้ง gas/Flow.gs และ index.html (แก้ต้องก๊อปไปทั้งสองที่) =====
// ขั้น { id, n ชื่อ, k ชนิด, f–t วันนับจากวันปลูก/วันตัด (ติดลบ = ก่อนปลูก), g กลุ่มบันทึกที่นับ, m คำในบันทึก คั่น , , tool, note,
//   w {a: id ขั้นถาม, v: คำตอบ} = ทำเฉพาะแปลงที่ตอบแบบนี้ }
// k: once ทำครั้งเดียว · repeat ทำซ้ำได้ {max, cond, gap} ครั้งที่ 2+ ขึ้นคิวเมื่อผู้ใช้กด "ต้องทำซ้ำ" เท่านั้น
//    branch มีกิ่ง {b: {c ถ้า, n งาน, w ภายในกี่วัน, g, m, cm คำในบันทึกที่แปลว่าเข้าเงื่อนไข}} เตือนเมื่อตอบ/บันทึกว่าเข้าเงื่อนไข
//    ask มีคำถาม {q, o: [{v, l, go: do|skip|next|ratoon|replant, m คำในบันทึกที่เดาคำตอบได้}]} · note ข้อควรจำ
// ctx { acts: [{g, d, age}], age: อายุวันนี้, ans: {id: {v, age}}, p0: วันเริ่มเตรียมดิน, pre: ยังไม่ปลูก } (age = วันนับจากวันเริ่มรอบ)
// sq 1 = ขั้นเตรียมดินแบบต่อกัน (ไม่ผูกวัน) · sq 2 = ขั้นปลูก (ปลูกแล้ว = ผ่าน)
function flowNorm_(a) {
  a.forEach(s => {
    s.k = s.k || 'once';
    if (s.k === 'repeat' && !s.max) s.k = 'note'; // ขั้นเดิม "ขึ้นน้ำวนรอบ" (ทำซ้ำทั้งฤดู) = ข้อควรจำ
    s.id = s.id || 'x:' + s.n;
    s.g = Array.isArray(s.g) ? s.g : []; s.m = s.m || ''; s.f = +s.f || 0; s.t = +s.t || 0;
    if (!Array.isArray(s.o)) s.o = [];
  });
  return a;
}
function flowHit_(acts, g, m, from, to, x) {
  const kw = String(m || '').split(',').map(x => x.trim()).filter(Boolean), gs = (g || []).includes('ขึ้นน้ำ') ? g.concat('ฝนตก') : (g || []);
  if (!gs.length && !kw.length) return [];
  const xw = String(x || '').split(',').map(w => w.trim()).filter(Boolean); // x = คำที่ถ้ามีในบันทึก ไม่นับเป็นขั้นนี้
  return acts.filter(a => (!gs.length || gs.includes(a.g)) && (!kw.length || kw.some(w => a.d.includes(w))) && !xw.some(w => a.d.includes(w)) && a.age >= from && a.age <= to).sort((a, b) => a.age - b.age);
}
// คำตอบของขั้นถาม: ผู้ใช้ตอบในฤดูนี้ก่อน · ไม่มี = เดาจากบันทึก (คำของแต่ละตัวเลือก)
function flowAns_(s, ctx) {
  const a = ctx.ans[s.id];
  if (a && a.v && a.age >= s.f - 60) return { v: a.v, by: 'user', age: a.age }; // คำตอบใช้เฉพาะฤดูนี้ (แต่ละปีอาจทำไม่เหมือนกัน)
  for (const o of s.o || []) { const h = o.m ? flowHit_(ctx.acts, [], o.m, s.f - 20, s.t + 45) : []; if (h.length) return { v: o.v, by: 'log', age: h[0].age }; }
  return null;
}
function flowBr_(s, ctx) {
  const b = s.b || {}, a = ctx.ans[s.id];
  let T = a && a.v === 'yes' && a.age >= s.f - 20 ? a.age : null;
  if (T === null && b.cm) { const h = flowHit_(ctx.acts, [], b.cm, s.f - 5, s.t + 60); if (h.length) T = h[0].age; }
  if (T === null) return null;
  const h = flowHit_(ctx.acts, b.g, b.m, T, T + 120);
  if (h.length) return { st: 'done', at: h[0].age, T };
  return ctx.age <= T + (+b.w || 7) ? { st: 'due', T } : { st: 'none', T };
}
// สถานะขั้นของแปลง: done ทำแล้ว (at) · due ถึงคิว · wait ยังไม่ถึง (d วัน) · none เลยช่วงไม่มีบันทึก · skip ไม่ต้องทำ
//   hold รอคำตอบขั้นถามก่อนหน้า · ask รอตอบคำถาม · ans ตอบแล้ว (ไม่มีงานในขั้นนี้) · note (n = วันที่บันทึกฤดูนี้)
// บันทึกหนึ่งนับให้ขั้นเดียว: ถ้าตรงหลายขั้น (เช่น ฝังปุ๋ย ตรงทั้งปุ๋ยครั้งที่ 1 และ 2) ให้ขั้นที่ช่วงวันใกล้บันทึกที่สุด เสมอกัน = ขั้นที่มาก่อน
// ผู้ใช้ย้ายบันทึกได้: ans['h:'+id] not = บันทึกถึงวันนั้นไม่ใช่ขั้นนี้ · done = นับว่าทำขั้นนี้วันนั้น
function flowHits_(steps, ctx) {
  if (ctx._h) return ctx._h;
  const H = ctx._h = {}, best = new Map();
  steps.forEach(s => {
    H[s.id] = [];
    if (s.k === 'note' || s.sq) return;
    if (s.w && s.w.a) { const q = steps.find(x => x.id === s.w.a), a = q ? flowAns_(q, ctx) : null; if (a && !String(s.w.v).split(',').includes(a.v)) return; }
    let h = flowHit_(ctx.acts, s.g, s.m, s.f - 20, s.t + 45, s.x);
    const ov = ctx.ans['h:' + s.id];
    if (ov && ov.v === 'not') h = h.filter(a => a.age > ov.age);
    h.forEach(a => { const d = a.age < s.f ? s.f - a.age : a.age > s.t ? a.age - s.t : 0, b = best.get(a); if (!b || d < b.d) best.set(a, { d, id: s.id }); });
    if (ov && ov.v === 'done') H[s.id].push({ age: ov.age, d: '' });
  });
  best.forEach((b, a) => H[b.id].push(a));
  Object.keys(H).forEach(k => H[k].sort((x, y) => x.age - y.age));
  return H;
}
// เตรียมดินแบบต่อกัน: บันทึกนับตามลำดับขั้น (บันทึกหนึ่งนับขั้นเดียว) · บันทึกขั้นเดียวกันห่างไม่เกิน 2 วัน = งานเดียวกัน (ไถหลายวัน)
//   ขั้นแรกที่ยังไม่ทำต่อจากขั้นล่าสุดที่ทำ = ถึงคิว (เฉพาะตอนยังไม่ปลูก) · ข้ามไปทำขั้นหลังแล้ว = ขั้นก่อนหน้า none
function flowSeq_(steps, ctx) {
  if (ctx._q) return ctx._q;
  const R = ctx._q = {}, Q = steps.filter(s => s.sq && s.k !== 'note'), live = ctx.pre || ctx.age < 0, end = ctx.pre ? ctx.age : 0;
  let from = ctx.p0 == null ? -150 : ctx.p0, last = -1;
  Q.forEach((s, i) => {
    const ov = ctx.ans['h:' + s.id];
    const own = String(s.m || '').split(','), uq = Q.slice(i + 1).flatMap(t => String(t.m || '').split(',')).map(w => w.trim()).filter(w => w && !own.includes(w)); // คำเฉพาะของขั้นถัดไป (เช่น ไถแปร) ไม่นับเป็นขั้นนี้
    let h = flowHit_(ctx.acts, s.g, s.m, from, end, s.x).filter(a => !uq.some(w => a.d.includes(w))), at = null;
    if (ov && ov.v === 'not') h = h.filter(a => a.age > ov.age);
    if (ov && ov.v === 'done') at = ov.age;
    else if (h.length) { at = h[0].age; h.forEach(a => { if (a.age <= at + 2) at = a.age; }); }
    else if (+s.sq === 2 && !ctx.pre && ctx.age >= 0) at = 0;
    if (at === null) return;
    R[s.id] = { st: 'done', at }; from = at + 1; last = i;
  });
  Q.forEach((s, i) => {
    if (R[s.id]) return;
    const pv = Q[i - 1], pr = pv && R[pv.id];
    R[s.id] = i < last || !live ? { st: 'none' } : i === last + 1 ? { st: 'due', af: pv ? pv.n : '', pa: pr ? pr.at : null } : { st: 'wait', af: pv.n };
  });
  return R;
}
function flowStat_(s, ctx, steps) {
  const age = ctx.age, k = s.k;
  if (ctx.pre && !s.sq) return k === 'note' ? { st: 'note', n: 0 } : { st: 'wait', pre: true }; // ยังไม่ปลูก: ขั้นหลังปลูกรอไว้ก่อน
  if (s.sq) return flowSeq_(steps, ctx)[s.id] || { st: 'none' };
  if (s.w && s.w.a) {
    const q = steps.find(x => x.id === s.w.a), a = q ? flowAns_(q, ctx) : null;
    if (!a) return { st: 'hold', q: q ? q.q || q.n : '' };
    if (!String(s.w.v).split(',').includes(a.v)) return { st: 'skip' };
  }
  if (k === 'note') { const h = s.g.length ? flowHit_(ctx.acts, s.g, s.m, 0, age) : []; return { st: 'note', n: new Set(h.map(x => x.age)).size }; }
  let hits = flowHits_(steps, ctx)[s.id] || [];
  // af = ทำต่อจากขั้นก่อน: ช่วงวัน = วันที่ขั้นนั้นเสร็จ (บันทึกแรก ต่อวันกันนับเป็นงานเดียว) + ad[0]–ad[1] · ขั้นก่อนยังไม่ทำ = รอ
  let F = s.f, T = s.t, after = null;
  if (s.af) {
    const q = steps.find(x => x.id === s.af), H = q ? flowHits_(steps, ctx)[q.id] || [] : [];
    let A = H.length ? H[0].age : null; H.forEach(h => { if (A !== null && h.age <= A + 2 && h.age > A) A = h.age; });
    const ad = Array.isArray(s.ad) ? s.ad : [0, 7];
    if (A !== null) { F = A + (+ad[0] || 0); T = A + (+ad[1] || 0); after = { af: q.n, pa: A }; }
    else if (q) after = { af: q.n, pend: true };
  }
  if (s.af) hits = hits.filter(h => after && !after.pend && h.age >= after.pa); // บันทึกก่อนขั้นก่อนหน้าเสร็จ ไม่นับ
  const base = () => after && after.pend ? (age > s.t + 30 ? { st: 'none' } : { st: 'wait', af: after.af })
    : Object.assign(age < F ? { st: 'wait', d: F - age } : age <= T ? { st: 'due' } : { st: 'none' }, after || {});
  if (k === 'ask') {
    const a = flowAns_(s, ctx), o = a && s.o.find(x => x.v === a.v);
    if (hits.length) return { st: 'done', at: hits[hits.length - 1].age, a, o };
    if (o && o.go !== 'do') return { st: o.go === 'skip' ? 'skip' : 'ans', a, o };
    if (!o) { const r = base(); return r.st === 'due' ? { st: 'ask' } : r; }
    return Object.assign(base(), { a, o });
  }
  if (k === 'repeat' && hits.length) {
    const T = [];
    hits.forEach(h => { if (!T.length || h.age - T[T.length - 1].last > 7) T.push({ first: h.age, last: h.age }); else T[T.length - 1].last = h.age; });
    const n = T.length, mx = +s.max || 2, last = T[n - 1].last, a = ctx.ans[s.id];
    if (n < mx && a && a.v === 'again' && a.age >= last - 1) return { st: 'due', n, again: true, at: last };
    return { st: 'done', at: last, n, more: n < mx && age <= last + (+s.gap || 14) ? last + (+s.gap || 14) : null };
  }
  let e1 = hits.length ? hits[0].age : 0; hits.forEach(h => { if (h.age <= e1 + 2) e1 = h.age; }); // งานครั้งเดียว: เสร็จ = วันสุดท้ายของชุดแรก (บันทึกรายวันต่อกัน) ไม่ใช่บันทึกหลังสุด
  const r = hits.length ? { st: 'done', at: e1, n: 1 } : base();
  if (k === 'branch') r.br = flowBr_(s, ctx);
  return r;
}
// งานถึงคิวของแปลง (ไม่เตือนงานตัดอ้อย แล้วแต่คิวโรงงาน) + คำถามที่รอตอบ
function flowDueList_(steps, ctx) {
  const out = [];
  steps.forEach(s => {
    const r = flowStat_(s, ctx, steps), cut = s.g.length === 1 && s.g[0] === 'ตัดอ้อย';
    if (r.st === 'due' && !cut) out.push({ s, n: r.again ? `${s.n} ครั้งที่ ${r.n + 1}` : s.n, g: s.g });
    if (r.br && r.br.st === 'due') out.push({ s, n: (s.b && s.b.n) || s.n, g: (s.b && s.b.g) || [], br: true });
    if (r.st === 'ask') out.push({ s, n: s.q || s.n, g: [], ask: true });
  });
  return out;
}

function flowSteps_(ss) {
  const out = {}, rows = readSheet_(ss, 'Flow');
  ['อ้อยใหม่', 'อ้อยตอ'].forEach(k => {
    let a = null; const r = rows.find(x => x.key === k);
    try { a = JSON.parse((r && r.data) || 'null'); } catch (e) {}
    if (!Array.isArray(a) || !a.length) a = JSON.parse(JSON.stringify(FLOW_DEF_[k]));
    out[k] = flowNorm_(a);
  });
  out._ans = {};
  rows.forEach(r => { if (String(r.key).indexOf('ans:') === 0) { try { out._ans[r.key.slice(4)] = JSON.parse(r.data || '{}') || {}; } catch (e) {} } });
  return out;
}
function flowDay_(s) { // วันที่ (dd/mm/ปี พ.ศ. หรือ ค.ศ. มีเวลาต่อท้ายได้ หรือ yyyy-mm-dd) → เลขวัน
  s = String(s || '').trim().split(' ')[0];
  const iso = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]) / 864e5;
  const k = dateKey_(s);
  return k ? Date.UTC(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100) / 864e5 : null;
}
function flowTrac_(d, type) {
  d = String(d || '');
  if (/ริปเปอร์/.test(d) && /ครูด/.test(d)) return type === 'อ้อยตอ' ? 'ครูดร่อง' : 'ริปเปอร์';
  if (/ครูด/.test(d) || (/ริปเปอร์/.test(d) && type === 'อ้อยตอ')) return 'ครูดร่อง';
  if (/ริปเปอร์/.test(d)) return 'ริปเปอร์';
  if (/ผาน\s*(4|สี่)/.test(d)) return 'ผาน 4';
  if (/ผาน\s*(3|สาม)|ไถดะ/.test(d)) return 'ผาน 3';
  if (/ผาน\s*(7|เจ็ด)|ไถแปร/.test(d)) return 'ผาน 7';
  if (/ทอย/.test(d)) return 'ปลูก';
  if (/ชักร่อง/.test(d)) return 'ชักร่อง';
  if (/ปลูก/.test(d)) return 'ปลูก';
  if (/อุ้มร่อง/.test(d)) return 'อุ้มร่อง';
  if (/ฝังปุ๋ย/.test(d)) return 'ฝังปุ๋ย';
  return '';
}
// ชนิด + วันเริ่มนับ: ตัดอ้อยเสร็จหลังวันปลูก = เริ่มรอบอ้อยตอจากวันตัด (ไม่ต้องรอแก้วันปลูก)
//   ถ้าตอบขั้นตัดอ้อยว่า "รื้อตอ" = รอปลูกใหม่ (ไม่มีงานถึงคิวจนกว่าจะใส่วันปลูกใหม่)
function flowInfo_(p, logs, today, ans) {
  const cuts = logs.filter(a => a.activity_group === 'ตัดอ้อย' && !String(a.remark || '').includes('กำลังทำ')).map(a => flowDay_(a.timestamp)).filter(d => d !== null && d <= today);
  const cut = cuts.length ? Math.max.apply(null, cuts) : null, pl = flowDay_(p.plant_date);
  if (cut !== null && (pl === null || cut > pl)) {
    const a = (ans || {}).cut, ad = a ? flowDay_(a.d) : null;
    if (a && a.v === 'new' && ad !== null && ad >= cut - 200) { // รื้อตอ: เตรียมดินต่อกันจากวันตัด · บันทึกทอย/ปลูกแล้ว = เริ่มนับอายุอ้อยใหม่
      const t = logs.filter(x => /ทอย|ปลูก/.test(x.activity_detail || '') && !/ซ่อม|ชักร่อง/.test(x.activity_detail || '')).map(x => flowDay_(x.timestamp)).filter(d => d !== null && d > cut && d <= today);
      return t.length ? { type: 'อ้อยใหม่', start: Math.min.apply(null, t), p0: cut } : { type: 'อ้อยใหม่', start: cut, p0: cut, pre: true, replant: true };
    }
    return { type: 'อ้อยตอ', start: cut };
  }
  return pl === null ? null : { type: p.cane_type, start: pl, p0: cut !== null && cut < pl ? cut : null };
}
// ctx ของแปลงสำหรับแกนคิด (อายุนับจากวันเริ่มรอบ)
function flowCtx_(p, logs, steps, today) {
  const ans = (steps._ans || {})[p.plot_id] || {}, inf = flowInfo_(p, logs, today, ans);
  if (!inf || inf.start === null || !steps[inf.type]) return null;
  const acts = logs.map(a => ({ g: a.activity_group, d: String(a.activity_detail || '') + ' ' + (a.activity_group === FLOW_RT_ ? flowTrac_(a.activity_detail, inf.type) : ''), age: flowDay_(a.timestamp) }))
    .filter(a => a.age !== null).map(a => (a.age -= inf.start, a));
  const A = {}; Object.keys(ans).forEach(id => { const d = flowDay_(ans[id].d); if (d !== null) A[id] = { v: ans[id].v, age: d - inf.start }; });
  return { inf, steps: steps[inf.type], ctx: { acts, age: today - inf.start, ans: A, pre: !!inf.pre, p0: inf.p0 == null ? null : inf.p0 - inf.start } };
}
// งานถึงคิว + คำถามรอตอบของแปลง → [{n, g}] (คำถามขึ้นต้น ❓)
function flowDue_(p, logs, steps, today) {
  const c = flowCtx_(p, logs, steps, today); if (!c) return [];
  return flowDueList_(c.steps, c.ctx).map(x => ({ n: x.ask ? '❓ ' + x.n : x.n, g: x.g }));
}
