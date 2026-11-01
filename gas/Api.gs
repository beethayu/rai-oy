// ===== API สำหรับหน้าเว็บบน GitHub Pages (มีรหัสผ่าน) =====
// ต้นฉบับอยู่ที่ GitHub beethayu/rai-oy โฟลเดอร์ gas/ — ห้ามแก้ในหน้า Apps Script ตรง ๆ (deploy อัตโนมัติจาก GitHub)
// รหัสผ่านเก็บใน: ตั้งค่าโปรเจกต์ (รูปเฟือง) > คุณสมบัติของสคริปต์ > API_KEY
// ถ้ายังไม่ได้ตั้ง API_KEY ระบบจะเปิดให้ใช้ได้เหมือนเดิม
const API_BLOCK_ = ['doGet', 'doPost', 'doGetOld', 'setupV7'];

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
  return apiRun_(req.fn, req.args || [], req.k);
}

function apiKeyOk_(k) {
  const key = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key) return true;
  return String(k || '') === String(key);
}

function apiRun_(fn, args, k) {
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
    return apiOut_({ ok: true, result: result === undefined ? null : result });
  } catch (err) {
    return apiOut_({ ok: false, error: String((err && err.message) || err) });
  }
}

function apiOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

