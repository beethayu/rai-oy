// ===== API สำหรับหน้าเว็บบน GitHub Pages (มีรหัสผ่าน) =====
// ต้นฉบับอยู่ที่ GitHub beethayu/rai-oy โฟลเดอร์ gas/ — ห้ามแก้ในหน้า Apps Script ตรง ๆ (deploy อัตโนมัติจาก GitHub)
// รหัสผ่านเก็บใน: ตั้งค่าโปรเจกต์ (รูปเฟือง) > คุณสมบัติของสคริปต์ > API_KEY
// ถ้ายังไม่ได้ตั้ง API_KEY ระบบจะเปิดให้ใช้ได้เหมือนเดิม
const API_BLOCK_ = ['doGet', 'doPost', 'doGetOld', 'setupV7', 'cleanBillPhotos', 'renameAllBillPhotos', 'dailyScheduler', 'authorizeFetch', 'sendMorningBrief', 'sendEveningBrief']; // ฟังก์ชันระบบ/บำรุงรักษา ไม่ให้เรียกผ่านลิงก์

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.page === 'html') {
    const html = HtmlService.createHtmlOutputFromFile('Index').getContent();
    return apiOut_({ ok: true, version: APP_VERSION, html: html });
  }
  if (p.fn) {
    let args = [];
    try { args = p.args ? JSON.parse(p.args) : []; } catch (err) {}
    return apiRun_(p.fn, args, p.k);
  }
  return doGetOld(e);
}

function doPost(e) {
  let req = {};
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return apiOut_({ ok: false, error: 'ข้อมูลที่ส่งมาไม่ใช่ JSON' });
  }
  return apiRun_(req.fn, req.args || [], req.k, req.rid);
}

function apiKeyOk_(k) {
  const key = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key) return true;
  return String(k || '') === String(key);
}

function apiRun_(fn, args, k, rid) {
  try {
    if (!apiKeyOk_(k)) {
      Utilities.sleep(800);
      return apiOut_({ ok: false, error: 'AUTH: รหัสผ่านไม่ถูกต้อง' });
    }
    if (!fn || typeof fn !== 'string' || /_$/.test(fn) || API_BLOCK_.indexOf(fn) >= 0) {
      throw new Error('ไม่อนุญาตให้เรียก: ' + fn);
    }
    const f = globalThis[fn];
    if (typeof f !== 'function') throw new Error('ไม่พบฟังก์ชัน: ' + fn);
    const result = f.apply(null, Array.isArray(args) ? args : [args]);
    const out = { ok: true, result: result === undefined ? null : result };
    apiKeep_(rid, out);
    return apiOut_(out);
  } catch (err) {
    const out = { ok: false, error: String((err && err.message) || err) };
    if (!/^AUTH/.test(out.error)) apiKeep_(rid, out);
    return apiOut_(out);
  }
}

// 19 พ.ย. 69 ผู้ใช้: "พิมพ์เสร็จแล้วสลับแอป → ขึ้นเชื่อมต่อไม่ได้ · รออยู่หน้าแชตผ่าน" = iOS พักหน้าเว็บ ตัดคำขอกลางทาง แต่สคริปต์ฝั่งนี้ทำต่อจนเสร็จ
// → คำขอที่มี rid (แชต/อ่านบิล) เก็บผลไว้ 10 นาที · กลับเข้าแอปแล้วหน้าเว็บมาเอาผลด้วย getResult (ไม่เรียก Gemini ซ้ำ ไม่อัปรูปซ้ำ)
function apiKeep_(rid, out) {
  if (!rid || !/^[a-z0-9]{6,24}$/.test(String(rid))) return;
  try { const s = JSON.stringify(out); CacheService.getScriptCache().put('rr_' + rid, s.length < 95000 ? s : JSON.stringify({ ok: true, big: true }), 600); } catch (e) {} // ผลใหญ่ (ข้อมูลทั้งหมดหลังบันทึก) เก็บแค่ว่าเสร็จแล้ว หน้าเว็บโหลดข้อมูลใหม่เอง
}
function getResult(rid) {
  if (!/^[a-z0-9]{6,24}$/.test(String(rid || ''))) return null;
  const s = CacheService.getScriptCache().get('rr_' + rid);
  return s ? JSON.parse(s) : null; // { ok, result | error } หรือ null = ยังไม่เสร็จ/ไม่มี
}

function apiOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

