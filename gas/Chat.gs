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
2) {"type":"finish","plots":["P01"],"date":"YYYY-MM-DD"} = งานที่ "กำลังทำ" ของแปลงนั้นเสร็จแล้ว (ใช้ได้เฉพาะแปลงที่มี ongoing ใน ctx) — ทำจริงจนเสร็จเท่านั้น
2.1) {"type":"cancel","plots":["P01"],"which":"ongoing"} = ยกเลิก/ลบรายการที่ลงไว้ (ลงผิด ทดลองบันทึก ไม่ได้ทำจริง) ระบบจะลบออกจากประวัติและคืนสต็อก
   which: "ongoing" = ลบงานที่กำลังทำของแปลงนั้น (ctx.plots[].ongoing) · "last" = ลบงานล่าสุดที่บันทึกของแปลงนั้น (ctx.plots[].last เช่น เพิ่งลงผิด)
   คำว่า "ยกเลิก" "ลบ" "ไม่ได้ทำ" "ลงผิด" "ทดลอง/ลองบันทึก" = cancel ห้ามใช้ finish · ไม่แน่ใจว่ารายการไหน ให้ถามใน ask
3) {"type":"watch","plots":["P01"],"reason":R,"note":""} = ฝากดู/ฝากจำไว้ทำทีหลัง R: "ขึ้นน้ำ","หว่านปุ๋ย","ฉีดยา","น้ำขัง สูบออก","ไปดูอาการ"
4) {"type":"rain_pick","date":"YYYY-MM-DD"} = ฝนตกแต่ผู้ใช้ไม่รู้/ไม่บอกว่าแปลงไหน (หน้าเว็บจะโชว์ฝนรายพื้นที่ให้ติ๊กเอง) ห้ามเดาแปลงเอง
5) {"type":"add","category":C,"name":"ชื่อ"} = เพิ่มคนงาน/รถใหม่ C: "Worker","Tractor","Truck","Pump","Car"(รถอื่นที่ใช้ในไร่ เช่น หกล้อ กระบะ ใช้กับเรื่องทะเบียน)
6) {"type":"asset_note","asset":"ชื่อรถ","event":"ดัดแปลง","detail":"ต่อกล่อง","shop":"ร้านช่างวุท","place":"","date":"YYYY-MM-DD","plates":[{"role":"หัว","plate":"70-1234"},{"role":"พ่วง","plate":"71-5678"}],"photos":[0,1],"unsure":[]} = ลงประวัติรถ/เครื่อง (ซ่อม ดัดแปลง ตรวจ) พร้อมทะเบียนที่อ่านจากรูป
7) {"type":"plot_photo","plots":["P01"],"diagnosis":"","note":"","date":"YYYY-MM-DD","photos":[0]} = รูปสภาพแปลง (อ้อยเหลือง หญ้า น้ำขัง ฯลฯ) แนบกับแปลงนั้น
8) {"type":"new_chem","name":"ชื่อการค้า","active":"สารออกฤทธิ์","use":"ใช้ทำอะไร","unit":"g","pack_name":"กล่อง","pack_size":100,"qty":0,"label_dose":"","per_tank":0,"photos":[0],"unsure":[]} = ยาตัวใหม่ที่ยังไม่มีในสต็อก (สร้างรายการสต็อก)
9) {"type":"bill","photos":[1]} = รูปใบเสร็จ/บิล (ส่งต่อให้ตัวอ่านบิล)
10) {"type":"asset_status","asset":"ชื่อรถ","state":"at_shop","detail":"ต่อกล่อง","shop":"ร้านช่างวุท","date":"YYYY-MM-DD"} = บอกสถานะรถ (ไม่มีรูป ก็ใช้ได้) state: "at_shop" = รถยังอยู่ที่ร้าน/อู่ (หน้ารถ/คนจะขึ้นว่าไม่ว่าง) · "done" = ซ่อม/ดัดแปลงเสร็จ เอารถกลับมาแล้ว (กลับเป็นพร้อมใช้)
11) {"type":"asset_reg","asset":"ชื่อรถ","plate":"","trailer_plate":"","expire":"YYYY-MM-DD","trailer_expire":"","unsure":[]} = ทะเบียน + วันครบกำหนดต่อทะเบียน/ภาษี ของรถไร่ (หัว/รถเดี่ยว = plate/expire, พ่วง = trailer_plate/trailer_expire) ใส่เฉพาะที่รู้

รูปภาพ (ถ้ามี จะแนบท้ายข้อความ เรียงตามลำดับ เลข 0,1,2…) ส่วนใหญ่เป็นรูปหน้างาน ไม่ใช่บิล:
- รูปรถ/เครื่องจักร (สิบล้อ รถพ่วง รถไถ ที่ไปต่อกล่อง/ซ่อม/ดัดแปลง): ใช้ item asset_note
  • อ่านป้ายทะเบียนจากรูปเท่านั้น (แบบไทย เช่น "70-1234" หรือ "กข 1234" + จังหวัดถ้าเห็น) อ่านไม่ชัดใส่ "" และใส่ "plates" ใน unsure ห้ามเดาตัวอักษร/ตัวเลข
  • role: รถเดี่ยว="รถ" · หัวลาก/รถแม่="หัว" · รถพ่วง/รถลูก/หาง="พ่วง" (พ่วงอยู่หลังหัวลาก) มีกี่ทะเบียนใส่ให้ครบ ถ้าในรูปเห็นรถ 2 คัน (แม่+ลูก) ให้ใส่ 2 ทะเบียน
  • asset ใช้ชื่อตรงตาม ctx.vehicles (ดูทะเบียนที่เคยจำไว้ประกอบได้) ไม่ตรง/ไม่รู้ ใส่ตามที่ผู้ใช้พิมพ์ + "asset" ใน unsure
  • event เลือก: "ซ่อม","ดัดแปลง","ตรวจ/ถ่ายรูป" · detail = ทำอะไร (เช่น "ต่อกล่อง") · shop = ร้าน/ช่างที่ผู้ใช้บอกหรือเห็นในรูป · place = สถานที่ (ถ้าไม่ใช่ร้าน) · date จากข้อความ ไม่บอก = ctx.today
  • photos = เลขรูปที่เกี่ยวกับรายการนี้ (ใส่ทุกรูปของรถคันนั้น)
  • state (สถานะรถ ณ ตอนนี้): ผู้ใช้บอกว่ารถยังอยู่ที่ร้าน/ยังไม่เสร็จ = "at_shop" · เอารถกลับมาแล้ว/เสร็จแล้ว = "done" · ไม่ได้พูดถึงเลยและงานนั้นเกิดที่ร้าน = ใส่ ask "ตอนนี้รถคันนี้ยังอยู่ที่ร้านไหม" options ["ยังอยู่ที่ร้าน","เอากลับมาแล้ว"] และ state "" · งานที่ทำเองที่ไร่ state ""
- รูปป้ายภาษี (วงกลมติดกระจก)/เล่มทะเบียน/ใบเสร็จต่อภาษี/ผู้ใช้เล่าวันต่อทะเบียน: ใช้ asset_reg · อ่านวันหมดอายุจากรูปหรือข้อความเท่านั้น (ปีบนป้ายเป็น พ.ศ. ลบ 543 เป็น ค.ศ.) ป้ายที่มีแค่เดือน/ปี → ใช้วันสิ้นเดือนนั้น และใส่ "expire" ใน unsure · ไม่เห็นวันที่ใส่ "" ห้ามเดา · ใช้กับรถไร่ใน ctx.vehicles เท่านั้น (ไม่ใช่รถส่วนตัวหรือรถที่ไม่เกี่ยวกับไร่ → บอกใน reply ว่าไม่จด)
  • ctx.vehicles มี reg/regTrailer (วันหมดที่จดไว้แล้ว) ใช้ประกอบเมื่อผู้ใช้ถามว่าคันไหนหมดเมื่อไร
- รูปสภาพแปลงอ้อย: ใช้ plot_photo — diagnosis บอกว่า "น่าจะเป็น…" จากรูป (เช่น ใบเหลืองคล้ายขาดไนโตรเจน/น้ำขัง/หญ้าขึ้นแน่น/หนอน) พูดให้ชัดว่าเดาจากรูป ไม่ฟันธง · ถ้าผู้ใช้ไม่บอกแปลงให้ใส่ใน ask ห้ามเดาแปลง · ถ้าควรกลับไปดู/จัดการ เพิ่ม item watch แยกอีกอัน
- รูปตัวยา/ถุงปุ๋ยน้ำ/กล่องยา (ยาตัวใหม่): ใช้ item new_chem อ่านจากฉลากเท่านั้น: name = ชื่อการค้า, active = สารออกฤทธิ์, label_dose = อัตราตามฉลาก (ข้อความสั้น ๆ ตามที่เขียน)
  • unit: ของแห้ง/ผง/เม็ด = "g", ของเหลว = "ml" · pack_size = ขนาดบรรจุแปลงเป็น g/ml (4 ลิตร = 4000, 100 กรัม = 100, 1 กก. = 1000) · pack_name = "กล่อง","ขวด","ถุง","แกลลอน" ตามภาชนะจริง
  • ชื่อตรงกับที่มีแล้วใน ctx.chems → ห้ามสร้างซ้ำ บอกใน reply · 1 ชนิดยา = 1 item (ซื้อมาหลายขนาดบรรจุ = ชื่อต่างกัน/คนละ item)
  • qty = จำนวนหน่วยบรรจุที่ซื้อ (เช่น 3 ขวด = 3) ผู้ใช้ไม่บอก/ไม่รู้ = 0 (ถ้ามีรูปใบเสร็จด้วย ใส่ 0 เสมอ ใบเสร็จจะเป็นตัวรับเข้าสต็อก)
  • use = ใช้ทำอะไร (คุมหญ้า/กำจัดหนอน/ฆ่าแมลง/บำรุง ฯลฯ) ผู้ใช้บอกก็ใช้ตามนั้น ไม่บอกให้เดาจากฉลากแล้วใส่ "use" ใน unsure · ฉลากอ่านไม่ออกว่าใช้ทำอะไร ให้ใส่ใน ask พร้อม options ["คุมหญ้า","กำจัดหนอน/แมลง","บำรุง/ฮอร์โมน","อื่น ๆ"]
  • per_tank = ปริมาณ g/ml ต่อ 1 ถังของไร่: ห้ามเดาลอย ๆ ฉลากบอกแค่อัตราต่อน้ำ (เช่น 20 มล./น้ำ 20 ลิตร) แต่ขนาดถังของไร่ไม่รู้ → ดู ctx.chems (ยาตัวอื่นที่มี per_tank + note อัตราฉลาก) ถ้าเทียบขนาดถังได้ให้คำนวณใส่ per_tank พร้อม "per_tank" ใน unsure · เทียบไม่ได้ใส่ 0 และถามใน ask "ผสมยานี้กี่ g/ml ต่อถัง" พร้อม options คำนวณจากฉลาก (ไม่เกิน 4 ตัวเลือก)
  • ต้องถามต่อให้ครบ (use / per_tank) ก่อนสรุปเป็นการ์ด แต่ถ้าผู้ใช้ตอบแล้วหรือเดาได้ค่อนข้างแน่ ให้ออก item พร้อมคำถามค้างได้ (ช่องที่เดาใส่ unsure)
- รูปบิล/ใบเสร็จ: ใส่ item {"type":"bill","photos":[เลขรูปใบเสร็จ]} (ห้ามอ่านรายการเอง หน้าเว็บจะส่งให้ตัวอ่านบิลเดิมหลังบันทึกยาใหม่) ถ้ามีรูปบิลอย่างเดียวไม่มีรูปอื่นก็ใช้ bill item เช่นกัน
- รูปไม่เกี่ยวกับไร่/ดูไม่ออก: items ว่าง บอกตรง ๆ ว่าเห็นอะไร อ่านไม่ได้เพราะอะไร
- ข้อความประกอบรูปมีน้ำหนักกว่าที่เดาจากรูป (เช่น ผู้ใช้บอกชื่อแปลง/ร้าน/วันที่)

ถามจากประวัติงาน (ctx.stats = สรุปประวัติทั้งไร่ที่คำนวณไว้แล้ว):
- ถ้าผู้ใช้ถามเรื่องที่ผ่านมา/สถิติ/เปรียบเทียบ/นับ (เช่น "อ้อยใหม่กับอ้อยตอมีงานต่างกันยังไง", "เดือนนี้หำทำกี่วัน", "ขึ้นน้ำกี่รอบแล้ว", "ค่าซ่อมรถเท่าไหร่") → items ว่าง ตอบใน reply จาก ctx.stats เท่านั้น
- ถามว่ารถคันไหนทะเบียนหมดเมื่อไร ตอบจาก ctx.vehicles (reg/regTrailer) ได้เลย (วันนี้ = ctx.today)
- ถ้า ctx ไม่มี stats แต่คำถามต้องใช้ประวัติ → ตอบ {"reply":"","items":[],"need_history":true} อย่างเดียว ไม่ต้องตอบอย่างอื่น
- หน่วยนับงานในไร่ = "แปลง-วัน" (ทำ 1 แปลง 1 วัน = 1) เทียบอ้อยใหม่กับอ้อยตอให้ใช้ค่าต่อแปลง (perPlot) หรือต่อไร่ เพราะจำนวนแปลงไม่เท่ากัน
- ผลผลิต/ตันต่อไร่/CCS ตอบจาก ctx.stats.yields (บันทึกต่อแปลง: แปลง รอบที่ตัด ฤดู ตัน ตัน/ไร่) เทียบอ้อยใหม่กับตอด้วยตัน/ไร่ ถ้าว่าง = ยังไม่ได้บันทึก ให้บอกว่าบันทึกได้ที่หน้าดูแปลง → ผลผลิตส่งโรงงาน
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

// อยู่ใต้โฟลเดอร์ใน okIds ไหม (ไล่ขึ้นไปไม่เกิน 3 ชั้น: รูปแชต/หมวด/ชื่อ/ไฟล์)
function underFolder_(file, okIds) {
  let level = [file], depth = 0;
  while (level.length && depth < 3) {
    const next = [];
    for (const x of level) {
      const ps = x.getParents();
      while (ps.hasNext()) { const p = ps.next(); if (okIds.indexOf(p.getId()) >= 0) return true; next.push(p); }
    }
    level = next; depth++;
  }
  return false;
}

// ไฟล์รูปในโฟลเดอร์แชต (รวมโฟลเดอร์ย่อย) → base64 (ข้ามไฟล์ที่ไม่ใช่ของโฟลเดอร์นี้) คืน {id: b64}
function chatBlobs_(ids) {
  const okIds = [chatFolder_().getId(), billFolder_().getId()], out = {}; // รูปแชต + รูปบิล
  (ids || []).slice(0, 6).forEach(id => {
    try {
      const f = DriveApp.getFileById(String(id));
      if (underFolder_(f, okIds)) out[id] = Utilities.base64Encode(f.getBlob().getBytes());
    } catch (e) {}
  });
  return out;
}

// โฟลเดอร์ย่อย รูปแชต/<หมวด>/<ชื่อ> (สร้างให้ถ้ายังไม่มี) เช่น รถ/สิบล้อ · แปลง/หนองเฝ้า (ข้าง รร.) · ยา/อามีทรีน
function chatSub_(kind, item) {
  const clean = x => String(x || '').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60) || 'อื่นๆ';
  const sub = (parent, name) => { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); };
  return sub(sub(chatFolder_(), clean(kind)), clean(item));
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
      trucks: ctx.trucks, pumps: ctx.pumps, vehicles: ctx.vehicles || [], chems: ctx.chems || [], stats: ctx.stats || undefined, draft: ctx.draft || null }) +
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

// ตั้งชื่อรูปแชตที่บันทึกแล้ว (เอา tmp_ ออก) เช่น รถ_สิบล้อ_02-11-2569_1.jpg แล้วย้ายเข้าโฟลเดอร์ย่อย รูปแชต/<หมวด>/<ชื่อ>
// kind = รถ | ยา | แปลง · item = ชื่อรถ/ยา/แปลง (ชื่อ ไม่ใช่รหัส)
function nameChatPhotos_(ids, label, date, kind, item) {
  const base = String(label || 'รูป').replace(/[\\/:*?"<>|]/g, '').slice(0, 30) + '_' + String(date || '').replace(/\//g, '-');
  let dest = null;
  if (kind) { try { dest = chatSub_(kind, item); } catch (e) {} }
  (ids || []).forEach((id, k) => {
    try {
      const f = DriveApp.getFileById(id);
      f.setName(base + '_' + (k + 1) + '.jpg');
      if (dest) f.moveTo(dest);
    } catch (e) {}
  });
}

// ย้ายรูปแชตเก่าที่บันทึกแล้ว (อยู่ชั้นบนสุด) เข้าโฟลเดอร์ย่อยตามชื่อไฟล์ · กดรันครั้งเดียวจากหน้าแก้โค้ด
// รถ_<ชื่อ>_… → รถ/<ชื่อ> · ยา_<ชื่อ>_… → ยา/<ชื่อ> · แปลง_P17-P18_… → แปลง/<ชื่อแปลง>
function sortChatPhotos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), nm = {};
  readSheet_(ss, SH.PLOTS).forEach(p => { nm[p.plot_id] = p.plot_name; });
  const it = chatFolder_().getFiles();
  let n = 0, skip = 0;
  while (it.hasNext()) {
    const f = it.next(), name = f.getName();
    const m = name.match(/^(รถ|ยา|แปลง)_(.+)_\d{1,2}-\d{1,2}-\d{4}_\d+\.jpg$/);
    if (!m) { skip++; continue; }
    let item = m[2];
    if (m[1] === 'แปลง') item = item.split('-').map(id => nm[id] || id).join(' + ');
    try { f.moveTo(chatSub_(m[1], item)); n++; } catch (e) { skip++; }
  }
  const msg = 'ย้ายแล้ว ' + n + ' รูป · ข้าม ' + skip + ' (รูปที่ยังไม่บันทึก/ชื่อไม่ตรงแบบ)';
  console.log(msg);
  return msg;
}

// ดูรูปที่เก็บไว้ (เปิดดูเต็มในแอป) — ยอมให้อ่านเฉพาะไฟล์ในโฟลเดอร์รูปแชตเท่านั้น
function chatPhotos(ids) { return chatBlobs_(ids); }

// รูปใบเสร็จที่ส่งในแชต → ตัวอ่านบิลเดิม (readBill เก็บสำเนาในโฟลเดอร์บิลเอง) คืนข้อมูลบิล + pages_b64 ให้หน้าตรวจ "เพิ่มหน้าบิล" ได้
function chatBillRead(ids) {
  const bl = chatBlobs_(ids), pages = (ids || []).map(id => bl[id]).filter(Boolean);
  if (!pages.length) throw new Error('ไม่พบรูปใบเสร็จ (อาจหมดอายุ ส่งรูปใหม่อีกครั้ง)');
  const data = readBill(pages, 'image/jpeg', {});
  data.pages_b64 = pages;
  return data;
}

const PLOT_PHOTO_H_ = ['photo_id', 'timestamp', 'plot_id', 'file_ids', 'diagnosis', 'note'];

// ops จากหน้าเว็บ (ตรวจแล้ว): {fn:'act', p:<payload แบบ saveActivities>} · {fn:'finish', log_id, date(พ.ศ.)} · {fn:'cancel', log_id} (ลบ+คืนสต็อก)
// · {fn:'watch', plotIds, reason, note} · {fn:'opt', category, name}
// · {fn:'asset', asset, event, detail, shop, place, date(พ.ศ.), plates:[{role,plate}], photo_ids}
// · {fn:'plotphoto', plotIds, diagnosis, note, date(พ.ศ.), photo_ids}
function chatApply(ops, rid) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // กดบันทึกซ้ำ (เน็ตหลุดตอนรอผล แต่ฝั่งเซิร์ฟเวอร์บันทึกไปแล้ว) → rid เดิม = ไม่ลงซ้ำ ส่งข้อมูลล่าสุดกลับ
    const cache = CacheService.getScriptCache();
    if (rid && cache.get('chatrid_' + rid)) { const dup = readAll_(ss); dup.chatDone = 0; dup.chatDup = true; return dup; }
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
      } else if (op.fn === 'cancel') {
        // ยกเลิก = ลบแถวงาน (ลงผิด/ทดลอง) + คืนสต็อกที่ตัดไป
        const d = sh.getRange(1, 1, sh.getLastRow(), 3).getDisplayValues();
        for (let i = d.length - 1; i >= 1; i--) {
          if (d[i][0] !== String(op.log_id)) continue;
          sh.deleteRow(i + 1);
          try { reverseUsage_(ss, String(op.log_id)); } catch (e) {}
          touched.add(d[i][2]);
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
      } else if (op.fn === 'asset' || op.fn === 'astatus') {
        // ลงประวัติรถจากแชต (+ จำทะเบียนหัว/พ่วง + แนบรูป + สถานะรถ: อยู่ร้านช่าง / รับกลับแล้ว)
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
        const where = [op.shop ? 'ร้าน ' + op.shop : '', op.place ? 'ที่ ' + op.place : ''].filter(Boolean).join(' · ');
        const detail = [op.detail, where].filter(Boolean).join(' · ') || '-';
        const evName = op.event || (op.fn === 'astatus' ? 'ซ่อม' : 'ถ่ายรูป');
        if (op.state === 'at_shop' || op.state === 'done') {
          const atShop = op.state === 'at_shop';
          const r4 = aSh.getRange(row, 4, 1, 2); r4.setNumberFormat('@'); r4.setValues([[atShop ? 'อยู่ร้านช่าง' : 'พร้อมใช้', atShop ? detail : '-']]);
          const r9 = aSh.getRange(row, 9); r9.setNumberFormat('@'); r9.setValue(date);
        }
        const label = op.state === 'at_shop' ? '🔧 จอดอยู่ร้านช่าง (' + evName + ')' : op.state === 'done' ? '✅ ' + evName + 'เสร็จ รับรถกลับ' : '🔧 ' + evName;
        const ids = (op.photo_ids || []).filter(Boolean);
        const pc = headCol_(lSh, 'photo_id'), ld = lSh.getDataRange().getDisplayValues();
        // ซ้ำ (รูปชุดเดียวกัน วันเดียวกัน รถคันเดียวกัน) = ข้าม ไม่ลงแถวซ้ำ
        const dupRow = ids.length && ld.some((r, i) => i > 0 && r[2] === name && r[1] === date && String(r[pc - 1] || '') === ids.join(','));
        if (!dupRow) {
          const rowv = ['AL' + (base++), date, name, ad[row - 1][1] || '-', label, detail, plates.map(x => (x.role || 'รถ') + ' ' + x.plate).join(', ') || '-', '-'];
          while (rowv.length < pc) rowv.push('');
          rowv[pc - 1] = ids.join(',');
          appendRows_(lSh, [rowv]);
          done++;
        }
        nameChatPhotos_(ids, 'รถ_' + name, date, 'รถ', name);
      } else if (op.fn === 'reg') {
        // ทะเบียน/ภาษีรถ: จำทะเบียน + วันครบกำหนดต่อ
        if (setAssetReg_(ss, String(op.asset || '').trim(), op)) done++;
      } else if (op.fn === 'chem') {
        // ยาตัวใหม่จากแชต: สร้างรายการสต็อก (หมวดยา) ถ้ายังไม่มีชื่อนี้ + รับเข้าถ้าไม่มีใบเสร็จ
        const name = String(op.name || '').trim();
        if (!name) return;
        const exists = readSheet_(ss, SH.INV).some(i => i.name === name);
        if (!exists) {
          saveStockItem_(ss, { category: 'Chemical', name, note: String(op.note || ''), unit: op.unit === 'ml' ? 'ml' : 'g',
            pack_size: Number(op.pack_size) > 0 ? Number(op.pack_size) : 1, pack_name: String(op.pack_name || '').trim() || (op.unit === 'ml' ? 'ขวด' : 'ถุง'),
            per_tank: Number(op.per_tank) > 0 ? Number(op.per_tank) : '', reorder_point: '' });
          done++;
        }
        const si = Number(op.stock_in) || 0;
        if (si > 0) { addStock_(ss, name, si, op.date || getTodayStr(), '📥 รับเข้า', 'ซื้อยาใหม่ (บันทึกจากแชต)'); }
        nameChatPhotos_((op.photo_ids || []).filter(Boolean), 'ยา_' + name, op.date || getTodayStr(), 'ยา', name);
      } else if (op.fn === 'plotphoto') {
        // รูปสภาพแปลง: ชีต PlotPhotos (รูปเก็บใน Drive) ดูได้ในหน้าดูแปลง
        const ids = (op.photo_ids || []).filter(Boolean), pids = (op.plotIds || []).filter(Boolean);
        if (!ids.length || !pids.length) return;
        const sh = getOrCreate_(ss, 'PlotPhotos', PLOT_PHOTO_H_), date = op.date || getTodayStr();
        const b = base++;
        appendRows_(sh, pids.map((pid, i) => ['PP' + b + '_' + i, date, pid, ids.join(','), String(op.diagnosis || ''), String(op.note || '')]));
        {
          const pn = {}; readSheet_(ss, SH.PLOTS).forEach(p => { pn[p.plot_id] = p.plot_name; });
          nameChatPhotos_(ids, 'แปลง_' + pids.join('-'), date, 'แปลง', pids.map(id => pn[id] || id).join(' + '));
        }
        done++;
      }
    });
    if (touched.size) syncPlots_(ss, [...touched]);
    if (rid) { try { cache.put('chatrid_' + rid, '1', 21600); } catch (e) {} }
    const all = readAll_(ss);
    all.chatDone = done;
    return all;
  });
}


// ทะเบียน/ต่อภาษีรถ: คอลัมน์ plate, trailer_plate, reg_expire, trailer_reg_expire (วันที่เก็บเป็น dd/mm/พ.ศ.)
// p.plate/p.trailer_plate/p.expire/p.trailer_expire ส่งเฉพาะที่จะเปลี่ยน (undefined = ไม่แตะ, '' = ล้าง) คืน true ถ้าเจอรถ
function setAssetReg_(ss, name, p) {
  const aSh = ss.getSheetByName(SH.ASSET), ad = aSh.getDataRange().getDisplayValues();
  let row = 0;
  for (let i = 1; i < ad.length; i++) if (ad[i][2] === name) { row = i + 1; break; }
  if (!row) return false;
  const set = (col, v) => { if (v === undefined || v === null) return; const rg = aSh.getRange(row, headCol_(aSh, col)); rg.setNumberFormat('@'); rg.setValue(String(v).trim()); };
  set('plate', p.plate); set('trailer_plate', p.trailer_plate);
  set('reg_expire', p.expire); set('trailer_reg_expire', p.trailer_expire);
  const parts = [];
  if (p.expire) parts.push((p.plate ? p.plate + ' ' : '') + 'ครบ ' + p.expire);
  if (p.trailer_expire) parts.push('พ่วง ' + (p.trailer_plate ? p.trailer_plate + ' ' : '') + 'ครบ ' + p.trailer_expire);
  if (parts.length) {
    const lSh = ss.getSheetByName(SH.ALOG), pc = headCol_(lSh, 'photo_id');
    const rowv = ['AL' + Date.now() + '_R', getTodayStr(), name, ad[row - 1][1] || '-', '🪪 ต่อทะเบียน/ภาษี', parts.join(' · '), '-', '-'];
    while (rowv.length < pc) rowv.push('');
    appendRows_(lSh, [rowv]);
  }
  return true;
}

function setAssetReg(name, p) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!setAssetReg_(ss, String(name || '').trim(), p || {})) throw new Error('ไม่พบรถ ' + name);
    return readAll_(ss);
  });
}

// ลบรายการประวัติรถ 1 แถว (เช่น บันทึกซ้ำ) — ทิ้งรูปเฉพาะที่ไม่มีรายการอื่นใช้อยู่
function deleteAssetLog(logId) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SH.ALOG);
    const d = sh.getDataRange().getDisplayValues(), pc = headCol_(sh, 'photo_id');
    let gone = '';
    for (let i = d.length - 1; i >= 1; i--) if (d[i][0] === String(logId)) { gone = String(d[i][pc - 1] || ''); sh.deleteRow(i + 1); break; }
    const left = new Set();
    sh.getDataRange().getDisplayValues().slice(1).forEach(r => String(r[pc - 1] || '').split(',').forEach(x => { if (x.trim()) left.add(x.trim()); }));
    gone.split(',').map(x => x.trim()).filter(x => x && !left.has(x)).forEach(id => { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {} });
    return readAll_(ss);
  });
}
