// ===== แผนน้ำรายแปลง =====
// วาดบนแผนที่: หัวแปลง (น้ำเข้า) / ท้ายแปลง (น้ำออก) / คลองส่งน้ำ / คลองระบาย / คูที่จะขุด / ทางลาด / แนวร่อง / ถมสูง / ปาดต่ำ
// เก็บชีต WaterPlans แถวละแปลง (หรือที่ดินที่จะเช่า) · data = JSON [{t, p:[[lat,lng],…], n}]
const WP_H_ = ['id', 'kind', 'name', 'data', 'updated'];

function saveWaterPlan(id, kind, name, data) {
  id = String(id || '').trim();
  if (!id) throw new Error('ไม่พบแปลง');
  const js = typeof data === 'string' ? data : JSON.stringify(data || []);
  const arr = JSON.parse(js);
  if (!Array.isArray(arr)) throw new Error('ข้อมูลแผนน้ำไม่ถูกต้อง');
  if (js.length > 45000) throw new Error('แผนใหญ่เกินไป ลองลบเส้นที่ไม่ใช้');
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = getOrCreate_(ss, 'WaterPlans', WP_H_);
    const d = sh.getDataRange().getDisplayValues();
    const r = d.findIndex((row, i) => i > 0 && row[0] === id);
    const row = [[id, String(kind || 'plot'), String(name || ''), js, Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm')]];
    if (r > 0) sh.getRange(r + 1, 1, 1, WP_H_.length).setNumberFormat('@').setValues(row);
    else appendRows_(sh, row);
    return { waterPlans: readSheet_(ss, 'WaterPlans') };
  });
}

// ===== ความสูงพื้น (Copernicus DEM 30 ม.) =====
// ส่งเป็น PNG: ความสูง (ม. + 100) × 20 เก็บใน แดง×256 + เขียว (ละเอียด 5 ซม.) · น้ำเงิน 255 = มีข้อมูล
// หน้าเว็บถอดค่าเองด้วย canvas แล้วหาทางลาด (ระนาบเอียง) + จุดต่ำ
// ⚠️ ข้อมูลเป็นผิวบน (รวมต้นไม้/สิ่งปลูกสร้าง) ถ่ายช่วงปี 2554–2558 ความคลาดเคลื่อนระดับเมตร → ใช้ดูแนวโน้มทั้งแปลงเท่านั้น
const DEM_EVAL_ = `//VERSION=3
function setup() {
  return { input: ['DEM', 'dataMask'], output: { bands: 4, sampleType: 'UINT8' } };
}
function evaluatePixel(s) {
  if (s.dataMask !== 1) return [0, 0, 0, 255];
  var v = Math.max(1, Math.min(65535, Math.round((s.DEM + 100) * 20)));
  return [Math.floor(v / 256), v % 256, 255, 255];
}`;
const DEM_PAD_M_ = 60;

function demBody_(pts) {
  const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2, kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  const s = Math.min(...lats) - DEM_PAD_M_ / ky, n = Math.max(...lats) + DEM_PAD_M_ / ky;
  const w = Math.min(...lngs) - DEM_PAD_M_ / kx, e = Math.max(...lngs) + DEM_PAD_M_ / kx;
  const wm = (e - w) * kx, hm = (n - s) * ky, k = Math.min(1 / 5, 160 / Math.max(wm, hm));   // ~5 ม./จุด (ขยายนุ่มจาก 30 ม.) ด้านยาวไม่เกิน 160
  const W = Math.max(16, Math.round(wm * k)), H = Math.max(16, Math.round(hm * k));
  const f6 = v => Number(v.toFixed(6));
  return {
    bbox: [f6(s), f6(w), f6(n), f6(e)], w: W, h: H,
    body: {
      input: {
        bounds: { bbox: [f6(w), f6(s), f6(e), f6(n)], properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' } },
        data: [{ type: 'dem', dataFilter: { demInstance: 'COPERNICUS_30' }, processing: { upsampling: 'BILINEAR', downsampling: 'BILINEAR' } }]
      },
      output: { width: W, height: H, responses: [{ identifier: 'default', format: { type: 'image/png' } }] },
      evalscript: DEM_EVAL_
    }
  };
}

// id = รหัสแปลง/ที่ดิน → { img: 'data:image/png;base64,…', bbox: [ใต้, ตะวันตก, เหนือ, ตะวันออก], w, h } · แคช 6 ชม. (ขอบเปลี่ยน = คีย์เปลี่ยน)
function getPlotDem(id) {
  id = String(id || '');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let b = '';
  readSheet_(ss, SH.PLOTS).forEach(p => { if (p.plot_id === id) b = p.boundary; });
  if (!b) readSheet_(ss, 'Lands').forEach(l => { if (l.land_id === id) b = l.boundary; });
  const pts = parsePath_(b);
  if (pts.length < 3) throw new Error('ยังไม่ได้วาดขอบแปลงนี้');
  const q = demBody_(pts), cache = CacheService.getScriptCache();
  const key = 'dem1_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(q.bbox)));
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const r = UrlFetchApp.fetch(SAT_PROC_URL_, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + satToken_(), Accept: 'image/png' }, payload: JSON.stringify(q.body)
  });
  if (r.getResponseCode() !== 200) {
    console.warn('dem ' + id + ' ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
    throw new Error('ขอข้อมูลความสูงไม่ได้ (' + r.getResponseCode() + ') ลองใหม่ภายหลัง');
  }
  const out = { img: 'data:image/png;base64,' + Utilities.base64Encode(r.getBlob().getBytes()), bbox: q.bbox, w: q.w, h: q.h };
  try { cache.put(key, JSON.stringify(out), 21600); } catch (e) {}
  return out;
}

// ลองจากหน้าแก้โค้ด: ขอความสูงแปลงแรกที่มีขอบ แล้วบอกขนาดภาพ (ไม่พิมพ์พิกัด)
function testDem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), p = readSheet_(ss, SH.PLOTS).find(x => x.boundary);
  if (!p) return console.log('ยังไม่มีแปลงที่วาดขอบ');
  const r = getPlotDem(p.plot_id);
  console.log('ความสูงพื้น ' + p.plot_name + ': ภาพ ' + r.w + '×' + r.h + ' ขนาด ' + r.img.length + ' ตัวอักษร');
}
