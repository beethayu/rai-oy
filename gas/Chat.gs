// แชตจดงาน (5 พ.ย. 69): ผู้ใช้พิมพ์เล่า → chatParse ให้ Gemini แยกเป็นรายการ (ยังไม่บันทึก)
// → หน้าเว็บโชว์การ์ดสรุปให้ตรวจ → กดบันทึก → chatApply(ops) ลงชีตครั้งเดียวใน lock เดียว
// ctx มาจากหน้าเว็บ (แปลง คนงาน รถ งานค้าง ฝนรายพื้นที่) ไม่ต้องอ่านชีตใหม่ = เร็ว

const CHAT_RULES_ = `คุณคือผู้ช่วยจดงานไร่อ้อย ผู้ใช้เล่างานเป็นภาษาไทยแบบพูด แปลงข้อความเป็น JSON รายการงาน (ยังไม่บันทึก ผู้ใช้จะตรวจก่อน)
ตอบ JSON เท่านั้น รูปแบบ:
{"reply":"ข้อความสั้น 1 บรรทัด","items":[...],"ask":[{"q":"คำถาม","options":["ตัวเลือก"]}]}

ชนิด items:
1) {"type":"activity","group":G,"detail":"","plots":["P01"],"workers":["ชื่อ"],"equipment":["ชื่อรถ/เครื่อง"],"quantity":"","date":"YYYY-MM-DD","date_to":"","ongoing":false,"remark":"","unsure":[]}
   G ต้องเป็นหนึ่งใน: "ขึ้นน้ำ","ฉีดยา","ใส่ปุ๋ย","รถไถเตรียมดิน/บำรุง","ตัดอ้อย","ฝนตก"
   detail ตัวอย่าง: ขึ้นน้ำ="ราดร่อง/ขึ้นน้ำ" หรือ "สูบน้ำขังออก" · รถไถ="ริปเปอร์","อุ้มร่อง","ฝังปุ๋ย","สับหญ้า","ครูดร่อง","ไถ" · ใส่ปุ๋ย="ใส่ปุ๋ย","ถากหญ้า","ซ่อมอ้อย","ตัดพันธุ์อ้อย","ขุดระบายน้ำขัง" · ฉีดยา=ชื่อยาถ้าบอก ไม่บอก="ฉีดยาคุมหญ้า" · ตัดอ้อย="ตัดสด - ไม่เผา" ฯลฯ · ฝนตก="น้ำฝนธรรมชาติ"
   quantity เช่น "3 ถัง", "5 กระสอบ" · equipment ใช้ชื่อตรงตามรายการรถ/พญานาค
   remark: ใส่คำว่า "ค้างคืน" / "เลิกเที่ยง" / "ล็อก 1" / "ครึ่งแปลง" ตามที่เล่า (คั่นด้วยเว้นวรรค)
   ongoing=true เมื่อบอกว่ายังไม่เสร็จ/กำลังทำ/ทำต่อพรุ่งนี้
   date_to: ใส่เมื่อเล่าเป็นช่วงวัน (เช่น 15-17) ไม่งั้นว่าง
2) {"type":"finish","plots":["P01"],"date":"YYYY-MM-DD"} = งานที่ "กำลังทำ" ของแปลงนั้นเสร็จแล้ว (ใช้ได้เฉพาะแปลงที่มี ongoing ใน ctx)
3) {"type":"watch","plots":["P01"],"reason":R,"note":""} = ฝากดู/ฝากจำไว้ทำทีหลัง R: "ขึ้นน้ำ","หว่านปุ๋ย","ฉีดยา","น้ำขัง สูบออก","ไปดูอาการ"
4) {"type":"rain_pick","date":"YYYY-MM-DD"} = ฝนตกแต่ผู้ใช้ไม่รู้/ไม่บอกว่าแปลงไหน (หน้าเว็บจะโชว์ฝนรายพื้นที่ให้ติ๊กเอง) ห้ามเดาแปลงเอง
5) {"type":"add","category":C,"name":"ชื่อ"} = เพิ่มคนงาน/รถใหม่ C: "Worker","Tractor","Truck","Pump"
6) {"type":"asset_note","asset":"ชื่อรถ","event":"ดัดแปลง","detail":"ต่อกล่อง","shop":"ร้านช่างวุท","place":"","date":"YYYY-MM-DD","plates":[{"role":"หัว","plate":"70-1234"},{"role":"พ่วง","plate":"71-5678"}],"photos":[0,1],"unsure":[]} = ลงประวัติรถ/เครื่อง (ซ่อม ดัดแปลง ตรวจ) พร้อมทะเบียนที่อ่านจากรูป
7) {"type":"plot_photo","plots":["P01"],"diagnosis":"","note":"","date":"YYYY-MM-DD","photos":[0]} = รูปสภาพแปลง (อ้อยเหลือง หญ้า น้ำขัง ฯลฯ) แนบกับแปลงนั้น

รูปภาพ (ถ้ามี จะแนบท้ายข้อความ เรียงตามลำดับ เลข 0,1,2…) ส่วนใหญ่เป็นรูปหน้างาน ไม่ใช่บิล:
- รูปรถ/เครื่องจักร (สิบล้อ รถพ่วง รถไถ ที่ไปต่อกล่อง/ซ่อม/ดัดแปลง): ใช้ item asset_note
  • อ่านป้ายทะเบียนจากรูปเท่านั้น (แบบไทย เช่น "70-1234" หรือ "กข 1234" + จังหวัดถ้าเห็น) อ่านไม่ชัดใส่ "" และใส่ "plates" ใน unsure ห้ามเดาตัวอักษร/ตัวเลข
  • role: รถเดี่ยว="รถ" · หัวลาก/รถแม่="หัว" · รถพ่วง/รถลูก/หาง="พ่วง" (พ่วงอยู่หลังหัวลาก) มีกี่ทะเบียนใส่ให้ครบ ถ้าในรูปเห็นรถ 2 คัน (แม่+ลูก) ให้ใส่ 2 ทะเบียน
  • asset ใช้ชื่อตรงตาม ctx.vehicles (ดูทะเบียนที่เคยจำไว้ประกอบได้) ไม่ตรง/ไม่รู้ ใส่ตามที่ผู้ใช้พิมพ์ + "asset" ใน unsure
  • event เลือก: "ซ่อม","ดัดแปลง","ตรวจ/ถ่ายรูป" · detail = ทำอะไร (เช่น "ต่อกล่อง") · shop = ร้าน/ช่างที่ผู้ใช้บอกหรือเห็นในรูป · place = สถานที่ (ถ้าไม่ใช่ร้าน) · date จากข้อความ ไม่บอก = ctx.today
  • photos = เลขรูปที่เกี่ยวกับรายการนี้ (ใส่ทุกรูปของรถคันนั้น)
- รูปสภาพแปลงอ้อย: ใช้ plot_photo — diagnosis บอกว่า "น่าจะเป็น…" จากรูป (เช่น ใบเหลืองคล้ายขาดไนโตรเจน/น้ำขัง/หญ้าขึ้นแน่น/หนอน) พูดให้ชัดว่าเดาจากรูป ไม่ฟันธง · ถ้าผู้ใช้ไม่บอกแปลงให้ใส่ใน ask ห้ามเดาแปลง · ถ้าควรกลับไปดู/จัดการ เพิ่ม item watch แยกอีกอัน
- รูปบิล/ใบเสร็จ: items ว่าง reply บอกให้ไปแท็บสต็อก → 🧾 ถ่ายรูปบิล (ตัวอ่านบิลแม่นกว่า)
- รูปไม่เกี่ยวกับไร่/ดูไม่ออก: items ว่าง บอกตรง ๆ ว่าเห็นอะไร อ่านไม่ได้เพราะอะไร
- ข้อความประกอบรูปมีน้ำหนักกว่าที่เดาจากรูป (เช่น ผู้ใช้บอกชื่อแปลง/ร้าน/วันที่)

ถามจากประวัติงาน (ctx.stats = สรุปประวัติทั้งไร่ที่คำนวณไว้แล้ว):
- ถ้าผู้ใช้ถามเรื่องที่ผ่านมา/สถิติ/เปรียบเทียบ/นับ (เช่น "อ้อยใหม่กับอ้อยตอมีงานต่างกันยังไง", "เดือนนี้หำทำกี่วัน", "ขึ้นน้ำกี่รอบแล้ว", "ค่าซ่อมรถเท่าไหร่") → items ว่าง ตอบใน reply จาก ctx.stats เท่านั้น
- ถ้า ctx ไม่มี stats แต่คำถามต้องใช้ประวัติ → ตอบ {"reply":"","items":[],"need_history":true} อย่างเดียว ไม่ต้องตอบอย่างอื่น
- หน่วยนับงานในไร่ = "แปลง-วัน" (ทำ 1 แปลง 1 วัน = 1) เทียบอ้อยใหม่กับอ้อยตอให้ใช้ค่าต่อแปลง (perPlot) หรือต่อไร่ เพราะจำนวนแปลงไม่เท่ากัน
- ห้ามแต่งตัวเลข ถ้า stats ไม่มีข้อมูลนั้นให้บอกตรง ๆ · บอกช่วงข้อมูล (stats.range) และข้อจำกัด (stats.note) สั้น ๆ เมื่อมีผลต่อคำตอบ · อธิบายเป็นภาษาชาวไร่ ไม่ต้องเรียงตารางยาว

กติกา:
- plots ใช้ plot_id จาก ctx.plots เท่านั้น ชื่อพื้นที่ (เช่น "หนองบวบหอมทั้งหมด") = ทุกแปลงในพื้นที่นั้น · ชื่อย่อ เช่น "แจง 3" = "สำนักแจง 3" ได้ แต่ใส่ "plots" ใน unsure
- workers/equipment ใช้ชื่อตรงตาม ctx ถ้าเป็นชื่อที่ไม่มีในรายการ ให้ใส่ตามที่พิมพ์และใส่ "workers"/"equipment" ใน unsure
- วันที่: ctx.today คือวันนี้ "เมื่อวาน" = วันก่อนหน้า ไม่บอก = วันนี้ · ปี ค.ศ.
- ข้อมูลที่จำเป็นขาด (ไม่รู้แปลง, ชื่อกำกวมหลายแปลง) → ใส่ใน ask พร้อม options สั้น ๆ (ไม่เกิน 6) และอย่าใส่ item ที่ยังไม่รู้แปลง
- มี draft เดิม (ctx.draft) และผู้ใช้พิมพ์แก้ → คืน items ชุดเต็มที่แก้แล้ว (ไม่ใช่เฉพาะส่วนที่แก้) · ผู้ใช้ตอบคำถามจาก ask → รวมเข้า items
- ข้อความที่เป็นคำถาม/ขอคำแนะนำ (ไม่ใช่การจดงาน) → items ว่าง แล้วตอบใน reply ให้ครบและเป็นประโยชน์ เหมือนผู้เชี่ยวชาญไร่อ้อยในไทย (อีสาน) คุยกับเจ้าของไร่
  ใช้ข้อมูลจริงใน ctx.plots (ชนิดอ้อย ไร่ วันปลูก/วันตัดตอ วันให้น้ำล่าสุด งานกำลังทำ) เมื่อเกี่ยวข้อง คำนวณอายุจาก ctx.today ได้ · ไม่รู้ให้บอกตรง ๆ ห้ามแต่งตัวเลข
  reply ยาวได้ ขึ้นบรรทัดใหม่ด้วย \n ใช้ข้อ ๆ ได้ (ขึ้นต้น "• ") ไม่ใช้ markdown ตัวหนา/หัวข้อ
- reply ตอนจดงาน ภาษาไทย สั้น เช่น "เข้าใจว่ามี 3 งาน ตรวจก่อนนะครับ"`;

// รูปในแชต (รอบ 2): เก็บใน Drive โฟลเดอร์ "รูปแชต ไร่อ้อย" (CHAT_FOLDER_ID)
// ตอนอ่านรูปตั้งชื่อ tmp_… (ยังไม่บันทึก) → กดบันทึกแล้วเปลี่ยนชื่อให้อ่านง่าย / ไม่ได้บันทึก = ทิ้งเองเมื่อเก่าเกิน 1 วัน
function chatFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CHAT_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('รูปแชต ไร่อ้อย');
  props.setProperty('CHAT_FOLDER_ID', f.getId());
  return f;
}

function cleanChatPhotos_(maxAgeMin) {
  const limit = Date.now() - (Number(maxAgeMin) || 1440) * 60000;
  const it = chatFolder_().getFiles();
  let n = 0;
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf('tmp_') !== 0 || f.getDateCreated().getTime() > limit) continue;
    f.setTrashed(true); n++;
  }
  return n;
}

// ไฟล์รูปในโฟลเดอร์แชต → base64 (ข้ามไฟล์ที่ไม่ใช่ของโฟลเดอร์นี้) คืน {id: b64}
function chatBlobs_(ids) {
  const folderId = chatFolder_().getId(), out = {};
  (ids || []).slice(0, 6).forEach(id => {
    try {
      const f = DriveApp.getFileById(String(id));
      const ps = f.getParents(); let ok = false;
      while (ps.hasNext()) { if (ps.next().getId() === folderId) { ok = true; break; } }
      if (ok) out[id] = Utilities.base64Encode(f.getBlob().getBytes());
    } catch (e) {}
  });
  return out;
}

// images = array ของ base64 JPEG (หน้าเว็บย่อ 1600px แล้ว) สูงสุด 4 รูป
// reuse = id รูปที่ส่งไว้แล้วในข้อความก่อนหน้า (ผู้ใช้ตอบคำถามต่อ / พิมพ์แก้) ไม่ต้องอัปโหลดซ้ำ
function chatParse(text, ctx, images, reuse) {
  ctx = ctx || {};
  let pics = (Array.isArray(images) ? images : []).filter(Boolean).slice(0, 4);
  let photoIds = [];
  if (!pics.length && Array.isArray(reuse) && reuse.length) {
    const bl = chatBlobs_(reuse);
    photoIds = reuse.filter(id => bl[id]).slice(0, 4);
    pics = photoIds.map(id => bl[id]);
  }
  const fresh = pics.length > 0 && !photoIds.length;
  const hist = (ctx.history || []).slice(-8).map(h => (h.me ? 'ผู้ใช้: ' : 'ผู้ช่วย: ') + h.t).join('\n');
  const prompt = CHAT_RULES_ +
    '\n\nctx = ' + JSON.stringify({ today: ctx.today, plots: ctx.plots, workers: ctx.workers, tractors: ctx.tractors,
      trucks: ctx.trucks, pumps: ctx.pumps, vehicles: ctx.vehicles || [], stats: ctx.stats || undefined, draft: ctx.draft || null }) +
    (hist ? '\n\nบทสนทนาก่อนหน้า:\n' + hist : '') +
    (pics.length ? '\n\nมีรูปแนบ ' + pics.length + ' รูป (เลข 0–' + (pics.length - 1) + ' ตามลำดับท้ายข้อความนี้)' : '') +
    '\n\nข้อความใหม่ของผู้ใช้:\n' + String(text || '').slice(0, 2000);
  const parts = [{ text: prompt }].concat(pics.map(p => ({ inline_data: { mime_type: 'image/jpeg', data: p } })));
  // เก็บรูปก่อน (เร็ว) แล้วค่อยถาม Gemini — ถ้า Gemini พังผู้ใช้กดส่งใหม่ รูปเก่าเก็บเป็น tmp_ ทิ้งเองพรุ่งนี้
  if (fresh) {
    try { cleanChatPhotos_(1440); } catch (e) {}
    const folder = chatFolder_(), stamp = Date.now();
    pics.forEach((p, i) => photoIds.push(folder.createFile(Utilities.newBlob(Utilities.base64Decode(p), 'image/jpeg', 'tmp_' + stamp + '_' + (i + 1) + '.jpg')).getId()));
  }
  const out = geminiCall_(parts, 'ตอบแชต');
  let j;
  try { j = JSON.parse(out); } catch (e) {
    const m = out.match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : { reply: 'อ่านไม่ออก ลองพิมพ์ใหม่อีกครั้งครับ', items: [] };
  }
  j.items = Array.isArray(j.items) ? j.items : [];
  j.ask = Array.isArray(j.ask) ? j.ask : [];
  j.photos = photoIds;
  j.model = geminiUsed_;
  return j;
}

// ตั้งชื่อรูปแชตที่บันทึกแล้ว (เอา tmp_ ออก) เช่น รถ_สิบล้อ_02-11-2569_1.jpg
function nameChatPhotos_(ids, label, date) {
  const base = String(label || 'รูป').replace(/[\\/:*?"<>|]/g, '').slice(0, 30) + '_' + String(date || '').replace(/\//g, '-');
  (ids || []).forEach((id, k) => {
    try { DriveApp.getFileById(id).setName(base + '_' + (k + 1) + '.jpg'); } catch (e) {}
  });
}

// ดูรูปที่เก็บไว้ (เปิดดูเต็มในแอป) — ยอมให้อ่านเฉพาะไฟล์ในโฟลเดอร์รูปแชตเท่านั้น
function chatPhotos(ids) { return chatBlobs_(ids); }

const PLOT_PHOTO_H_ = ['photo_id', 'timestamp', 'plot_id', 'file_ids', 'diagnosis', 'note'];

// ops จากหน้าเว็บ (ตรวจแล้ว): {fn:'act', p:<payload แบบ saveActivities>} · {fn:'finish', log_id, date(พ.ศ.)}
// · {fn:'watch', plotIds, reason, note} · {fn:'opt', category, name}
// · {fn:'asset', asset, event, detail, shop, place, date(พ.ศ.), plates:[{role,plate}], photo_ids}
// · {fn:'plotphoto', plotIds, diagnosis, note, date(พ.ศ.), photo_ids}
function chatApply(ops) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SH.ACT);
    const touched = new Set();
    let base = Date.now(), done = 0;
    (ops || []).forEach(op => {
      if (op.fn === 'act') {
        const p = op.p, ids = (p.plotIds || []).filter(Boolean);
        if (!ids.length) return;
        const date = p.custom_date || getTodayStr();
        const rmk = (p.is_ongoing ? '[⏳กำลังทำ] ' : '[✅เสร็จสิ้น] ') + (p.remark || '');
        const b = base++;
        const rows = ids.map((pid, i) => ['L' + b + '_' + i, date, pid, p.activity_group,
          p.activity_detail || '-', p.equipment || '-', p.quantity || '-', p.operator || '-', rmk]);
        appendRows_(sh, rows);
        ids.forEach(id => touched.add(id));
        try { closeWatchesFor_(ss, ids, p.activity_group, p.activity_detail || '', rows[0][0]); } catch (e) {}
        done++;
      } else if (op.fn === 'finish') {
        const d = sh.getDataRange().getDisplayValues();
        for (let i = d.length - 1; i >= 1; i--) {
          if (d[i][0] !== String(op.log_id)) continue;
          let rm = String(d[i][8] || '').replace('[⏳กำลังทำ]', '').trim();
          if (!rm.includes('เริ่ม')) rm = (rm ? rm + ' ' : '') + 'เริ่ม ' + d[i][1];
          const rg = sh.getRange(i + 1, 2); rg.setNumberFormat('@'); rg.setValue(op.date || getTodayStr());
          sh.getRange(i + 1, 9).setValue('[✅เสร็จสิ้น] ' + rm);
          touched.add(d[i][2]);
          try { closeWatchesFor_(ss, [d[i][2]], d[i][3], d[i][4], d[i][0]); } catch (e) {}
          done++;
          break;
        }
      } else if (op.fn === 'watch') {
        const w = getOrCreate_(ss, 'Watch', WATCH_HEADERS_), ids = (op.plotIds || []).filter(Boolean);
        if (!ids.length) return;
        const b = base++, today = getTodayStr();
        appendRows_(w, ids.map((pid, i) => ['W' + b + '_' + i, today, pid, String(op.reason || 'ไปดูอาการ'), String(op.note || ''), 'open', '', '']));
        done++;
      } else if (op.fn === 'opt') {
        if (['Worker', 'Tractor', 'Truck', 'Pump'].includes(op.category) && String(op.name || '').trim()) {
          masterOpt_(ss, op.category, 'add', String(op.name).trim()); done++;
        }
      } else if (op.fn === 'asset') {
        // ลงประวัติรถจากแชต (+ จำทะเบียนหัว/พ่วงไว้ในข้อมูลรถ + แนบรูป)
        const name = String(op.asset || '').trim();
        const aSh = ss.getSheetByName(SH.ASSET), lSh = ss.getSheetByName(SH.ALOG);
        const ad = aSh.getDataRange().getDisplayValues();
        let row = 0;
        for (let i = 1; i < ad.length; i++) if (ad[i][2] === name) { row = i + 1; break; }
        if (!row) return;
        const date = op.date || getTodayStr();
        const plates = (op.plates || []).filter(x => x && String(x.plate || '').trim());
        const head = plates.filter(x => x.role !== 'พ่วง')[0], trl = plates.filter(x => x.role === 'พ่วง')[0];
        if (head) { const rg = aSh.getRange(row, headCol_(aSh, 'plate')); rg.setNumberFormat('@'); rg.setValue(String(head.plate).trim()); }
        if (trl) { const rg = aSh.getRange(row, headCol_(aSh, 'trailer_plate')); rg.setNumberFormat('@'); rg.setValue(String(trl.plate).trim()); }
        const ids = (op.photo_ids || []).filter(Boolean);
        const pc = headCol_(lSh, 'photo_id');
        const detail = [op.detail, op.shop ? 'ร้าน ' + op.shop : '', op.place ? 'ที่ ' + op.place : ''].filter(Boolean).join(' · ') || '-';
        const rowv = ['AL' + (base++), date, name, ad[row - 1][1] || '-', '🔧 ' + (op.event || 'ถ่ายรูป'), detail,
          plates.map(x => (x.role || 'รถ') + ' ' + x.plate).join(', ') || '-', '-'];
        while (rowv.length < pc) rowv.push('');
        rowv[pc - 1] = ids.join(',');
        appendRows_(lSh, [rowv]);
        nameChatPhotos_(ids, 'รถ_' + name, date);
        done++;
      } else if (op.fn === 'plotphoto') {
        // รูปสภาพแปลง: ชีต PlotPhotos (รูปเก็บใน Drive) ดูได้ในหน้าดูแปลง
        const ids = (op.photo_ids || []).filter(Boolean), pids = (op.plotIds || []).filter(Boolean);
        if (!ids.length || !pids.length) return;
        const sh = getOrCreate_(ss, 'PlotPhotos', PLOT_PHOTO_H_), date = op.date || getTodayStr();
        const b = base++;
        appendRows_(sh, pids.map((pid, i) => ['PP' + b + '_' + i, date, pid, ids.join(','), String(op.diagnosis || ''), String(op.note || '')]));
        nameChatPhotos_(ids, 'แปลง_' + pids.join('-'), date);
        done++;
      }
    });
    if (touched.size) syncPlots_(ss, [...touched]);
    const all = readAll_(ss);
    all.chatDone = done;
    return all;
  });
}
