// ===== ดาวเทียมรายแปลง จาก Copernicus Data Space (Sentinel Hub Statistical API) =====
// แทนสคริปต์ Google Earth Engine ที่ต้องก๊อปวางเอง: Apps Script เรียก API เอง แล้วลงชีต SatLog
// ค่าที่ได้ (ต่อแปลง ต่อวันที่ดาวเทียมผ่านและเห็นแปลงใส):
//   ndvi  = ความเขียว (มีใบมากแค่ไหน)        ndre = ใบสมบูรณ์ (ใบเขียวเข้มแข็งแรงไหม)
//   ndwi  = น้ำในใบ                          water = สัดส่วนของแปลงที่เห็นน้ำบนผิวดิน 0–1
//   clear = สัดส่วนของแปลงที่ไม่มีเมฆ/เงาเมฆ 0–1 (ค่าต่ำ = ภาพวันนั้นเชื่อถือน้อย)
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
  var bad = [0, 1, 3, 8, 9, 10, 11].indexOf(s.SCL) >= 0;
  var ndvi = nd(s.B08, s.B04), ndre = nd(s.B08, s.B05), ndwi = nd(s.B08, s.B11), mn = nd(s.B03, s.B11);
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

function satBody_(t, fromISO, toISO) {
  return {
    input: {
      bounds: {
        geometry: { type: 'Polygon', coordinates: [t.ring] },
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' }
      },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { mosaickingOrder: 'leastCC', maxCloudCoverage: 80 } }]
    },
    aggregation: {
      timeRange: { from: fromISO + 'T00:00:00Z', to: toISO + 'T00:00:00Z' },
      aggregationInterval: { of: 'P1D' },
      evalscript: SAT_EVAL_,
      resx: SAT_RES_DEG_, resy: SAT_RES_DEG_
    }
  };
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
function satFetch_(targets, fromISO, toISO) {
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
    let res = UrlFetchApp.fetchAll(batch.map(x => satReq_(token, satBody_(x.t, x.c[0], x.c[1]))));
    batch.forEach((x, k) => {
      let r = res[k];
      if (r.getResponseCode() === 429 || r.getResponseCode() >= 500) {   // ลองใหม่ 1 ครั้ง
        Utilities.sleep(5000);
        r = UrlFetchApp.fetch(SAT_STATS_URL_, satReq_(token, satBody_(x.t, x.c[0], x.c[1])));
      }
      if (r.getResponseCode() !== 200) {
        errors.push(x.t.name + ': ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 160));
        return;
      }
      let j = null;
      try { j = JSON.parse(r.getContentText()); } catch (e) { errors.push(x.t.name + ': อ่านผลไม่ได้'); return; }
      satParse_(j).forEach(v => rows.push([v.date, x.t.kind, x.t.id, x.t.name, v.ndvi, v.ndre, v.ndwi, v.water, v.clear, getTodayStr()]));
    });
    if (i + SAT_BATCH_ < jobs.length) Utilities.sleep(500);
  }
  return { rows: rows, errors: errors };
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
  const msg = withLock_(() => {
    const sh = getOrCreate_(ss, 'SatLog', SAT_H_);
    const cur = sh.getDataRange().getDisplayValues();
    const idx = {};
    for (let i = 1; i < cur.length; i++) idx[cur[i][0] + '|' + cur[i][1] + '|' + cur[i][2]] = i + 1;
    const add = [];
    got.rows.forEach(r => {
      const v = r.map(x => (x === null || x === undefined) ? '' : String(x));
      const at = idx[r[0] + '|' + r[1] + '|' + r[2]];
      if (at) sh.getRange(at, 1, 1, v.length).setNumberFormat('@').setValues([v]);
      else add.push(v);
    });
    appendRows_(sh, add);
    return 'ลง ' + got.rows.length + ' แถว (ใหม่ ' + add.length + ') จาก ' + targets.length + ' แปลง · ' + fromISO + ' ถึง ' + toISO;
  });
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
}

// กดรันจากหน้าแก้โค้ด (รายการเลือกฟังก์ชันใส่ตัวเลขไม่ได้): ลงย้อนหลัง ~13 เดือน รวมที่ดินที่จะเช่า
function logSatelliteBackfill() {
  const r = logSatellite(400, true);
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
