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

function chatParse(text, ctx) {
  ctx = ctx || {};
  const hist = (ctx.history || []).slice(-8).map(h => (h.me ? 'ผู้ใช้: ' : 'ผู้ช่วย: ') + h.t).join('\n');
  const prompt = CHAT_RULES_ +
    '\n\nctx = ' + JSON.stringify({ today: ctx.today, plots: ctx.plots, workers: ctx.workers, tractors: ctx.tractors,
      trucks: ctx.trucks, pumps: ctx.pumps, draft: ctx.draft || null }) +
    (hist ? '\n\nบทสนทนาก่อนหน้า:\n' + hist : '') +
    '\n\nข้อความใหม่ของผู้ใช้:\n' + String(text || '').slice(0, 2000);
  const out = geminiCall_([{ text: prompt }]);
  let j;
  try { j = JSON.parse(out); } catch (e) {
    const m = out.match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : { reply: 'อ่านไม่ออก ลองพิมพ์ใหม่อีกครั้งครับ', items: [] };
  }
  j.items = Array.isArray(j.items) ? j.items : [];
  j.ask = Array.isArray(j.ask) ? j.ask : [];
  j.model = geminiUsed_;
  return j;
}

// ops จากหน้าเว็บ (ตรวจแล้ว): {fn:'act', p:<payload แบบ saveActivities>} · {fn:'finish', log_id, date(พ.ศ.)}
// · {fn:'watch', plotIds, reason, note} · {fn:'opt', category, name}
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
      }
    });
    if (touched.size) syncPlots_(ss, [...touched]);
    const all = readAll_(ss);
    all.chatDone = done;
    return all;
  });
}
