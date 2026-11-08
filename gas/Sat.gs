// ===== ดาวเทียมรายแปลง จาก Copernicus Data Space (Sentinel Hub Statistical API) =====
// แทนสคริปต์ Google Earth Engine ที่ต้องก๊อปวางเอง: Apps Script เรียก API เอง แล้วลงชีต SatLog
// ค่าที่ได้ (ต่อแปลง ต่อวันที่ดาวเทียมผ่านและเห็นแปลงใส):
//   ndvi  = ความเขียว (มีใบมากแค่ไหน)        ndre = ใบสมบูรณ์ (ใบเขียวเข้มแข็งแรงไหม)
//   ndwi  = น้ำในใบ                          water = สัดส่วนของแปลงที่เห็นน้ำบนผิวดิน 0–1
//   clear = (ดิบ) พิกเซลใส / พิกเซลในกรอบสี่เหลี่ยมรอบแปลง — นับพิกเซลนอกแปลงด้วย (API นับเป็น noData)
//           จึงต้องหารด้วยค่าสูงสุดของแปลงนั้น (= วันที่ใสทั้งแปลง) ก่อนใช้ → getSatData ทำให้แล้ว
//
// ตั้งค่าครั้งเดียว (ห้ามใส่รหัสในโค้ดหรือ repo):
//   Apps Script > ตั้งค่าโปรเจกต์ (รูปเฟือง) > คุณสมบัติของสคริปต์ > เพิ่ม
//     CDSE_CLIENT_ID      และ  CDSE_CLIENT_SECRET
//   (สร้างที่ https://shapps.dataspace.copernicus.eu/dashboard/#/ → User settings → OAuth clients)
// จากนั้นรัน testSatellite() เพื่อลองต่อ แล้วรัน installSatTrigger() เพื่อตั้งให้รันทุกวัน

const SAT_TOKEN_URL_ = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const SAT_STATS_URL_ = 'https://sh.dataspace.copernicus.eu/statistics/v1';
const SAT_H_ = ['date', 'kind', 'id', 'name', 'ndvi', 'ndre', 'ndwi', 'water', 'clear', 'logged_at'];
const SAT_RES_DEG_ = 0.00009;   // ~10 ม. (ขอบเขตส่งเป็นองศา WGS84 จึงบอกความละเอียดเป็นองศา)
const SAT_SHRINK_M_ = 10;       // หดขอบเข้า ~10 ม. กันถนน/ต้นไม้/แปลงข้างเคียงปน
const SAT_CHUNK_DAYS_ = 90;     // แบ่งช่วงเวลาถามทีละไม่เกิน 90 วัน
const SAT_BATCH_ = 4;           // ถามพร้อมกันทีละกี่แปลง

// MNDWI>0 = น้ำบนผิว · มาสก์เมฆ/เงาเมฆ/หิมะ/ข้อมูลเสียด้วยแถบ SCL ของ Sentinel-2 L2A
const SAT_EVAL_ = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ['B03', 'B04', 'B05', 'B08', 'B11', 'SCL', 'dataMask'] }],
    output: [
      { id: 'ndvi', bands: 1, sampleType: 'FLOAT32' },
      { id: 'ndre', bands: 1, sampleType: 'FLOAT32' },
      { id: 'ndwi', bands: 1, sampleType: 'FLOAT32' },
      { id: 'water', bands: 1, sampleType: 'FLOAT32' },
      { id: 'dataMask', bands: 1 }
    ]
  };
}
function nd(a, b) { var s = a + b; return s === 0 ? NaN : (a - b) / s; }
function evaluatePixel(s) {
  var ndvi = nd(s.B08, s.B04), ndre = nd(s.B08, s.B05), ndwi = nd(s.B08, s.B11), mn = nd(s.B03, s.B11);
  // น้ำท่วมมักถูกจัดเป็น "เงาเมฆ" (SCL 3) → เก็บไว้ถ้าดูเป็นน้ำ (MNDWI > 0) ไม่งั้นวันที่น้ำท่วมเต็มแปลงจะหายไปทั้งวัน
  var bad = [0, 1, 8, 9, 10, 11].indexOf(s.SCL) >= 0 || (s.SCL === 3 && !(mn > 0));
  var ok = s.dataMask === 1 && !bad && isFinite(ndvi) && isFinite(ndre) && isFinite(ndwi) && isFinite(mn);
  return { ndvi: [ndvi], ndre: [ndre], ndwi: [ndwi], water: [mn > 0 ? 1 : 0], dataMask: [ok ? 1 : 0] };
}`;

function satCreds_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('CDSE_CLIENT_ID'), secret = p.getProperty('CDSE_CLIENT_SECRET');
  if (!id || !secret) throw new Error('ยังไม่ได้ตั้ง CDSE_CLIENT_ID / CDSE_CLIENT_SECRET ในคุณสมบัติของสคริปต์');
  return { id: String(id).trim(), secret: String(secret).trim() };   // ตัดช่องว่าง/ขึ้นบรรทัดใหม่ที่ติดมาตอนวาง
}

// ขอ token (เก็บแคชไว้ใช้ซ้ำจนใกล้หมดอายุ)
function satToken_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('sat_token');
  if (hit) return hit;
  const c = satCreds_();
  const res = UrlFetchApp.fetch(SAT_TOKEN_URL_, {
    method: 'post',
    payload: { grant_type: 'client_credentials', client_id: c.id, client_secret: c.secret },
    muteHttpExceptions: true
  });
  let j = {};
  try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() !== 200 || !j.access_token) {
    throw new Error('ขอ token ไม่ผ่าน (' + res.getResponseCode() + '): ' + String(j.error_description || j.error || res.getContentText()).slice(0, 200));
  }
  cache.put('sat_token', j.access_token, Math.max(30, Math.min((Number(j.expires_in) || 300) - 60, 21000)));
  return j.access_token;
}

// หดขอบเข้าหาจุดกลางโดยประมาณ (ไม่ใช่ buffer จริง) · แปลงเล็กหดไม่เกิน 40%
function satShrink_(pts, m) {
  const info = polyInfo_(pts);
  if (!info) return pts;
  const r = Math.sqrt(info.m2 / Math.PI), k = Math.max(0.6, 1 - m / r);
  return pts.map(p => [info.lat + (p[0] - info.lat) * k, info.lng + (p[1] - info.lng) * k]);
}

// เป้าหมาย: แปลงที่วาดขอบแล้ว (+ ที่ดินที่จะเช่า ถ้า includeLands)
function satTargets_(ss, includeLands) {
  const out = [];
  const add = (kind, id, name, boundary) => {
    const pts = parsePath_(boundary);
    if (pts.length < 3) return;
    const sp = satShrink_(pts, SAT_SHRINK_M_);
    const ring = sp.map(p => [Number(p[1].toFixed(6)), Number(p[0].toFixed(6))]);
    ring.push(ring[0]);
    out.push({ kind: kind, id: id, name: name, ring: ring });
  };
  readSheet_(ss, SH.PLOTS).forEach(p => add('plot', p.plot_id, p.plot_name, p.boundary));
  if (includeLands) readSheet_(ss, 'Lands').forEach(l => add('land', l.land_id, l.name, l.boundary));
  return out;
}

function satBodyWith_(t, fromISO, toISO, dataItem, evalscript) {
  return {
    input: {
      bounds: {
        geometry: { type: 'Polygon', coordinates: [t.ring] },
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' }
      },
      data: [dataItem]
    },
    aggregation: {
      timeRange: { from: fromISO + 'T00:00:00Z', to: toISO + 'T00:00:00Z' },
      aggregationInterval: { of: 'P1D' },
      evalscript: evalscript,
      resx: SAT_RES_DEG_, resy: SAT_RES_DEG_
    }
  };
}

function satBody_(t, fromISO, toISO) {
  return satBodyWith_(t, fromISO, toISO, { type: 'sentinel-2-l2a', dataFilter: { mosaickingOrder: 'leastCC' } }, SAT_EVAL_);
}

// อ่านผลตอบกลับ → [{date, ndvi, ndre, ndwi, water, clear}] (ข้ามวันที่ไม่มีพิกเซลใส)
function satParse_(j) {
  const rows = [];
  ((j && j.data) || []).forEach(d => {
    const o = d.outputs || {};
    const st = k => (o[k] && o[k].bands && o[k].bands.B0 && o[k].bands.B0.stats) || null;
    const a = st('ndvi');
    if (!a || !(a.sampleCount > 0)) return;
    const clear = 1 - (Number(a.noDataCount) || 0) / a.sampleCount;
    const g = k => { const s = st(k), v = s ? Number(s.mean) : NaN; return isFinite(v) ? Math.round(v * 10000) / 10000 : null; };
    const v = { ndvi: g('ndvi'), ndre: g('ndre'), ndwi: g('ndwi'), water: g('water') };
    if (v.ndvi === null) return;
    rows.push({ date: String(d.interval.from).slice(0, 10), ndvi: v.ndvi, ndre: v.ndre, ndwi: v.ndwi, water: v.water, clear: Math.round(clear * 100) / 100 });
  });
  return rows;
}

function satReq_(token, body) {
  return {
    url: SAT_STATS_URL_, method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    payload: JSON.stringify(body), muteHttpExceptions: true
  };
}

// ถามทีละช่วงเวลา/ทีละชุดแปลง → { rows:[[...]], errors:[...] }
function satFetch_(targets, fromISO, toISO, opt) {
  opt = opt || {};   // opt: { body(t,from,to), parse(json), row(t,v) } · ไม่ใส่ = Sentinel-2
  const bodyFn = opt.body || satBody_, parseFn = opt.parse || satParse_;
  const rowFn = opt.row || ((t, v) => [v.date, t.kind, t.id, t.name, v.ndvi, v.ndre, v.ndwi, v.water, v.clear, getTodayStr()]);
  const token = satToken_();
  const rows = [], errors = [];
  const chunks = [];
  let a = new Date(fromISO + 'T00:00:00Z');
  const end = new Date(toISO + 'T00:00:00Z');
  while (a < end) {
    const b = new Date(Math.min(a.getTime() + SAT_CHUNK_DAYS_ * 86400000, end.getTime()));
    chunks.push([a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)]);
    a = b;
  }
  const jobs = [];
  targets.forEach(t => chunks.forEach(c => jobs.push({ t: t, c: c })));
  for (let i = 0; i < jobs.length; i += SAT_BATCH_) {
    const batch = jobs.slice(i, i + SAT_BATCH_);
    let res = UrlFetchApp.fetchAll(batch.map(x => satReq_(token, bodyFn(x.t, x.c[0], x.c[1]))));
    batch.forEach((x, k) => {
      let r = res[k];
      if (r.getResponseCode() === 429 || r.getResponseCode() >= 500) {   // ลองใหม่ 1 ครั้ง
        Utilities.sleep(5000);
        r = UrlFetchApp.fetch(SAT_STATS_URL_, satReq_(token, bodyFn(x.t, x.c[0], x.c[1])));
      }
      if (r.getResponseCode() !== 200) {
        errors.push(x.t.name + ': ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 160));
        return;
      }
      let j = null;
      try { j = JSON.parse(r.getContentText()); } catch (e) { errors.push(x.t.name + ': อ่านผลไม่ได้'); return; }
      parseFn(j).forEach(v => rows.push(rowFn(x.t, v)));
    });
    if (i + SAT_BATCH_ < jobs.length) Utilities.sleep(500);
  }
  return { rows: rows, errors: errors };
}

// เขียนแถวลงชีต: คีย์ = 3 คอลัมน์แรก (date|kind|id) ซ้ำ = ทับ · คืนจำนวนแถวใหม่
function satUpsert_(ss, name, headers, rows) {
  return withLock_(() => {
    const sh = getOrCreate_(ss, name, headers);
    const cur = sh.getDataRange().getDisplayValues();
    const idx = {};
    for (let i = 1; i < cur.length; i++) idx[cur[i][0] + '|' + cur[i][1] + '|' + cur[i][2]] = i + 1;
    const add = [];
    rows.forEach(r => {
      const v = r.map(x => (x === null || x === undefined) ? '' : String(x));
      const at = idx[r[0] + '|' + r[1] + '|' + r[2]];
      if (at) sh.getRange(at, 1, 1, v.length).setNumberFormat('@').setValues([v]);
      else add.push(v);
    });
    appendRows_(sh, add);
    return add.length;
  });
}

// ลงค่าดาวเทียมย้อนหลัง days วัน (ค่าเริ่ม 12 ≈ ดาวเทียมผ่าน 2 รอบ) ลงชีต SatLog
// วันเดียวกัน+แปลงเดียวกัน = ทับของเดิม · includeLands=true รวมที่ดินที่จะเช่าด้วย
function logSatellite(days, includeLands) {
  days = Math.min(Math.max(Number(days) || 12, 1), 800);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targets = satTargets_(ss, includeLands === true || includeLands === 'true');
  if (!targets.length) return 'ยังไม่มีแปลงที่วาดขอบ';
  const now = new Date();
  const toISO = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const fromISO = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  const got = satFetch_(targets, fromISO, toISO);
  const up = satUpsert_(ss, 'SatLog', SAT_H_, got.rows);
  const msg = 'ลง ' + got.rows.length + ' แถว (ใหม่ ' + up + ') จาก ' + targets.length + ' แปลง · ' + fromISO + ' ถึง ' + toISO;
  return msg + (got.errors.length ? ' · ผิดพลาด ' + got.errors.length + ': ' + got.errors.slice(0, 3).join(' | ') : '');
}

// ลองต่อ: เช็กรหัส → ขอ token → ถามแปลงแรก 30 วัน (ไม่เขียนชีต) แล้วรายงานผล
function testSatellite() {
  const r = satTest_();
  console.log(r);
  return r;
}

function satTest_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const out = [];
  try { satCreds_(); out.push('รหัสครบ'); } catch (e) { return e.message; }
  try { satToken_(); out.push('ขอ token ผ่าน'); } catch (e) { return out.concat(e.message).join(' · '); }
  const t = satTargets_(ss, false)[0];
  if (!t) return out.concat('ยังไม่มีแปลงที่วาดขอบ').join(' · ');
  const now = new Date();
  const got = satFetch_([t], new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10), new Date(now.getTime() + 86400000).toISOString().slice(0, 10));
  out.push('แปลง ' + t.name + ': ได้ ' + got.rows.length + ' วัน' + (got.rows.length ? ' (ล่าสุด ' + got.rows[got.rows.length - 1][0] + ' ความเขียว ' + got.rows[got.rows.length - 1][4] + ')' : ''));
  if (got.errors.length) out.push('ผิดพลาด: ' + got.errors[0]);
  return out.join(' · ');
}

function logSatelliteTrigger() {
  try { console.log(logSatellite(8)); } catch (e) { console.error(e); }
  try { console.log(logRadar(14)); } catch (e) { console.error(e); }   // เรดาร์ (Radar.gs)
}

// ลงย้อนหลังแบบทำต่อได้: ทีละ 3 แปลง เขียนชีตทุกชุด · ใกล้ครบเวลา Apps Script (6 นาที) หยุดจำแปลงที่ค้าง → กดรันซ้ำทำต่อ
function satBackfill_(propKey, sheet, headers, days, opt, label) {
  const t0 = Date.now(), props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targets = satTargets_(ss, true);
  if (!targets.length) return 'ยังไม่มีแปลงที่วาดขอบ';
  const now = new Date();
  const toISO = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const fromISO = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  let i = Number(props.getProperty(propKey)) || 0, rows = 0, errs = [];
  while (i < targets.length) {
    const got = satFetch_(targets.slice(i, i + 3), fromISO, toISO, opt);
    satUpsert_(ss, sheet, headers, got.rows);
    rows += got.rows.length; errs = errs.concat(got.errors);
    i += 3;
    if (i < targets.length && Date.now() - t0 > 240000) {
      props.setProperty(propKey, String(i));
      return label + ': ทำได้ ' + i + '/' + targets.length + ' แปลง (' + rows + ' แถว) · กดรันซ้ำเพื่อทำต่อ' + (errs.length ? ' · ผิดพลาด ' + errs.length + ': ' + errs[0] : '');
    }
  }
  props.deleteProperty(propKey);
  return label + ': ครบแล้ว ' + targets.length + ' แปลง · รอบนี้ ' + rows + ' แถว · ' + fromISO + ' ถึง ' + toISO + (errs.length ? ' · ผิดพลาด ' + errs.length + ': ' + errs[0] : '');
}

// กดรันจากหน้าแก้โค้ด (ปุ่ม "เรียกใช้" ไม่ใช่ "แก้ปัญหา"): ลงย้อนหลัง ~13 เดือน รวมที่ดินที่จะเช่า · ขึ้นว่า "กดรันซ้ำ" = กดอีกรอบ
function logSatelliteBackfill() {
  const r = satBackfill_('SAT_BACKFILL_NEXT', 'SatLog', SAT_H_, 400, undefined, 'ดาวเทียม');
  console.log(r);
  return r;
}

// ตั้งให้รันทุกวัน ~05:00 ลงย้อนหลัง 8 วัน (ดาวเทียมผ่านแปลงเดิมราว 5 วัน/ครั้ง ภาพใหม่จึงไม่ได้มาทุกวัน
// แต่รันทุกวันจะได้ภาพใหม่ภายในวันที่ลงฐาน ไม่ต้องรอสัปดาห์) · ไม่ผูกกับ logDailyRainTrigger เพื่อให้พังแยกกัน
function installSatTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'logSatelliteTrigger').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('logSatelliteTrigger').timeBased().atHour(5).nearMinute(10).everyDays(1).inTimezone('Asia/Bangkok').create();
  console.log('ตั้งเวลาแล้ว: ทุกวัน ~05:10');
  return 'ตั้งเวลาแล้ว: ทุกวัน ~05:10';
}

// ส่งให้หน้าจอดาวเทียมในแอป (เรียกตอนเปิดหน้าเท่านั้น ไม่รวมใน getInitialData) แถวแบบย่อ
// sat:   [date, kind, id, ndvi, ndre, ndwi, water, clear]
// radar: [date, kind, id, vv_db, water]
function getSatData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pick = (name, cols) => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return [];
    const d = sh.getDataRange().getDisplayValues(), h = d[0], ix = cols.map(c => h.indexOf(c));
    if (ix.some(i => i < 0)) return [];
    return d.slice(1).filter(r => r[0]).map(r => ix.map(i => r[i]));
  };
  // clear ในชีตเป็นค่าดิบ (หารด้วยกรอบสี่เหลี่ยม) → หารด้วยค่าสูงสุดของแปลงนั้น ให้เป็นสัดส่วนของแปลงที่ใสจริง 0–1
  const sat = pick('SatLog', ['date', 'kind', 'id', 'ndvi', 'ndre', 'ndwi', 'water', 'clear']);
  const mx = {};
  sat.forEach(r => { const k = r[1] + '|' + r[2], c = Number(r[7]) || 0; if (!(mx[k] >= c)) mx[k] = c; });
  sat.forEach(r => { const m = mx[r[1] + '|' + r[2]]; r[7] = m > 0 ? String(Math.round((Number(r[7]) || 0) / m * 100) / 100) : '0'; });
  return {
    sat: sat,
    radar: pick('RadarLog', ['date', 'kind', 'id', 'vv_db', 'water'])
  };
}

// ถามดาวเทียมของแปลงเดียวช่วงวันที่ที่กำหนด ไม่เขียนชีต (ใช้ตรวจเหตุการณ์ย้อนหลัง) · radar=true = เรดาร์
function satProbe(id, fromISO, toISO, radar) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const t = satTargets_(ss, true).filter(x => x.id === id)[0];
  if (!t) throw new Error('ไม่พบแปลง/ที่ดินที่วาดขอบ: ' + id);
  const got = satFetch_([t], fromISO, toISO, radar ? RAD_OPT_ : undefined);
  return got;
}

// ===== ภาพสีของแปลง (Process API) ให้หน้าดาวเทียมในแอป: เขียวเข้ม = อ้อยเต็ม · เหลือง = บาง · น้ำตาล = ดินโล่ง · เทา = เมฆ =====
const SAT_PROC_URL_ = 'https://sh.dataspace.copernicus.eu/process/v1';
const SAT_IMG_EVAL_ = `//VERSION=3
function setup() {
  return { input: [{ bands: ['B03', 'B04', 'B08', 'B11', 'SCL', 'dataMask'] }], output: { bands: 4 } };
}
var ST = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85];
var CO = [[0.55, 0.38, 0.22], [0.80, 0.55, 0.25], [0.95, 0.85, 0.30], [0.62, 0.80, 0.30], [0.25, 0.62, 0.22], [0.08, 0.40, 0.12]];
function ramp(v) {
  if (v <= ST[0]) return CO[0];
  for (var i = 1; i < ST.length; i++) if (v <= ST[i]) {
    var t = (v - ST[i - 1]) / (ST[i] - ST[i - 1]), a = CO[i - 1], b = CO[i];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  return CO[CO.length - 1];
}
function evaluatePixel(s) {
  if (s.dataMask !== 1) return [0, 0, 0, 0];
  var mn = (s.B03 - s.B11) / (s.B03 + s.B11 || 1);
  if (mn > 0 && s.SCL !== 8 && s.SCL !== 9 && s.SCL !== 10) return [0.20, 0.45, 0.85, 1];      // น้ำบนผิว
  if ([0, 1, 3, 8, 9, 10, 11].indexOf(s.SCL) >= 0) return [0.78, 0.78, 0.78, 1];              // เมฆ/เงา
  var v = (s.B08 - s.B04) / (s.B08 + s.B04 || 1);
  if (REF > 0) {                                                  // โหมดเทียบในแปลง: สีบอกว่าตรงนี้ดี/แย่กว่าค่าเฉลี่ยของแปลงเอง
    var d = v - REF;
    if (d <= -0.15) return [0.80, 0.15, 0.12, 1];
    if (d <= -0.07) return [0.96, 0.55, 0.20, 1];
    if (d < 0.05) return [0.93, 0.90, 0.72, 1];
    return [0.18, 0.55, 0.22, 1];
  }
  var c = ramp(v);
  return [c[0], c[1], c[2], 1];
}`;

// คืน { img: 'data:image/png;base64,…', w, h } ของแปลง/ที่ดิน id วันที่ dateISO (YYYY-MM-DD) · แคช 6 ชม.
// ref = ค่าความเขียวเฉลี่ยของแปลงวันนั้น (ใส่ = โหมดเทียบในแปลง: แดง/ส้ม = อ่อนกว่าส่วนอื่นของแปลงเดียวกัน)
function getSatImage(id, dateISO, ref) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateISO))) throw new Error('วันที่ไม่ถูก');
  ref = Math.round((Number(ref) || 0) * 1000) / 1000;
  if (!(ref > 0 && ref < 1)) ref = 0;
  const cache = CacheService.getScriptCache(), ck = 'satimg_' + id + '_' + dateISO + '_' + ref;
  const hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let b = '';
  readSheet_(ss, SH.PLOTS).forEach(p => { if (p.plot_id === id) b = p.boundary; });
  if (!b) readSheet_(ss, 'Lands').forEach(l => { if (l.land_id === id) b = l.boundary; });
  const pts = parsePath_(b);
  if (pts.length < 3) throw new Error('แปลงนี้ยังไม่ได้วาดขอบ');
  const ring = pts.map(p => [Number(p[1].toFixed(6)), Number(p[0].toFixed(6))]); ring.push(ring[0]);
  const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const wm = (Math.max(...lngs) - Math.min(...lngs)) * 111320 * Math.cos(lat0 * Math.PI / 180), hm = (Math.max(...lats) - Math.min(...lats)) * 110540;
  const k = Math.min(480 / Math.max(wm, hm), 1 / 1.5);        // ~1.5 ม./จุด (ขยายจากภาพ 10 ม. แบบนุ่ม) ด้านยาวไม่เกิน 480 จุด
  const w = Math.max(40, Math.round(wm * k)), h = Math.max(40, Math.round(hm * k));
  const d0 = new Date(dateISO + 'T00:00:00Z'), d1 = new Date(d0.getTime() + 86400000);
  const body = {
    input: {
      bounds: { geometry: { type: 'Polygon', coordinates: [ring] }, properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' } },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { timeRange: { from: d0.toISOString(), to: d1.toISOString() }, mosaickingOrder: 'leastCC' }, processing: { upsampling: 'BILINEAR' } }]
    },
    output: { width: w, height: h, responses: [{ identifier: 'default', format: { type: 'image/png' } }] },
    evalscript: SAT_IMG_EVAL_.replace('//VERSION=3', '//VERSION=3\nvar REF = ' + ref + ';')
  };
  const r = UrlFetchApp.fetch(SAT_PROC_URL_, {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + satToken_(), Accept: 'image/png' },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) throw new Error('ขอภาพไม่ได้ (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 160));
  const out = { img: 'data:image/png;base64,' + Utilities.base64Encode(r.getBlob().getBytes()), w: w, h: h, date: dateISO };
  try { cache.put(ck, JSON.stringify(out), 21600); } catch (e) {}   // เกิน 100KB = ไม่แคช
  return out;
}
