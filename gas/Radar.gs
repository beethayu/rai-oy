// ===== เรดาร์ Sentinel-1: ดูน้ำขังบนผิวดิน (มองทะลุเมฆ ใช้ได้ตอนฝนตก) =====
// ใช้บัญชี/รหัส Copernicus ชุดเดียวกับ Sat.gs (CDSE_CLIENT_ID / CDSE_CLIENT_SECRET)
// ลงชีต RadarLog: date(ISO), kind(plot/land), id, name, vv_db, vh_db, water, pixels, logged_at
//   vv_db / vh_db = ความแรงของคลื่นสะท้อนกลับ (เดซิเบล) · น้ำนิ่งโล่งๆ สะท้อนกลับน้อยมาก (ค่าต่ำ ติดลบมาก)
//   water         = สัดส่วนของแปลงที่ดูเป็นน้ำโล่ง 0–1 (เกณฑ์ VV ต่ำกว่า -16 dB)
// ข้อจำกัด (สำคัญ): เห็นเฉพาะน้ำโล่งที่ไม่มีใบบัง · อ้อยสูง/ใบหนาแล้วเรดาร์มองน้ำใต้ใบไม่ชัด (บางครั้งน้ำใต้ต้นทำให้ค่าสูงขึ้น)
//   เกณฑ์ -16 dB เป็นค่ากลางที่ใช้กันทั่วไป ยังไม่ได้ปรับให้เข้ากับไร่นี้ · ภาพมาราว 6–12 วัน/ครั้ง

const RAD_H_ = ['date', 'kind', 'id', 'name', 'vv_db', 'vh_db', 'water', 'pixels', 'logged_at'];
const RAD_WATER_DB_ = -16;

const RAD_EVAL_ = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ['VV', 'VH', 'dataMask'] }],
    output: [
      { id: 'vv', bands: 1, sampleType: 'FLOAT32' },
      { id: 'vh', bands: 1, sampleType: 'FLOAT32' },
      { id: 'water', bands: 1, sampleType: 'FLOAT32' },
      { id: 'dataMask', bands: 1 }
    ]
  };
}
function db(x) { return 10 * Math.log(Math.max(x, 1e-6)) / Math.LN10; }
function evaluatePixel(s) {
  var vv = db(s.VV), vh = db(s.VH);
  return { vv: [vv], vh: [vh], water: [vv < ${RAD_WATER_DB_} ? 1 : 0], dataMask: [s.dataMask] };
}`;

function radBody_(t, fromISO, toISO) {
  return satBodyWith_(t, fromISO, toISO, {
    type: 'sentinel-1-grd',
    dataFilter: { acquisitionMode: 'IW', polarization: 'DV', resolution: 'HIGH' },
    processing: { backCoeff: 'SIGMA0_ELLIPSOID' }
  }, RAD_EVAL_);
}

// → [{date, vv, vh, water, pixels}] (ข้ามวันที่ไม่มีพิกเซล)
function radParse_(j) {
  const rows = [];
  ((j && j.data) || []).forEach(d => {
    const o = d.outputs || {};
    const st = k => (o[k] && o[k].bands && o[k].bands.B0 && o[k].bands.B0.stats) || null;
    const a = st('vv');
    if (!a) return;
    const px = (Number(a.sampleCount) || 0) - (Number(a.noDataCount) || 0);
    if (!(px > 0)) return;
    const g = (k, n) => { const s = st(k), v = s ? Number(s.mean) : NaN; return isFinite(v) ? Math.round(v * n) / n : null; };
    const vv = g('vv', 100);
    if (vv === null) return;
    rows.push({ date: String(d.interval.from).slice(0, 10), vv: vv, vh: g('vh', 100), water: g('water', 1000), pixels: px });
  });
  return rows;
}

const RAD_OPT_ = {
  body: radBody_, parse: radParse_,
  row: (t, v) => [v.date, t.kind, t.id, t.name, v.vv, v.vh, v.water, v.pixels, getTodayStr()]
};

function radDates_(days) {
  const now = new Date();
  return [new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10), new Date(now.getTime() + 86400000).toISOString().slice(0, 10)];
}

// ลงเรดาร์ย้อนหลัง days วัน (ค่าเริ่ม 14) · includeLands=true รวมที่ดินที่จะเช่า
function logRadar(days, includeLands) {
  days = Math.min(Math.max(Number(days) || 14, 1), 800);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targets = satTargets_(ss, includeLands === true || includeLands === 'true');
  if (!targets.length) return 'ยังไม่มีแปลงที่วาดขอบ';
  const r = radDates_(days);
  const got = satFetch_(targets, r[0], r[1], RAD_OPT_);
  const up = satUpsert_(ss, 'RadarLog', RAD_H_, got.rows);
  return 'เรดาร์: ลง ' + got.rows.length + ' แถว (ใหม่ ' + up + ') จาก ' + targets.length + ' แปลง · ' + r[0] + ' ถึง ' + r[1] +
    (got.errors.length ? ' · ผิดพลาด ' + got.errors.length + ': ' + got.errors.slice(0, 3).join(' | ') : '');
}

// ลองต่อเรดาร์: แปลงแรก 45 วัน ไม่เขียนชีต
function testRadar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const t = satTargets_(ss, false)[0];
  let out;
  if (!t) out = 'ยังไม่มีแปลงที่วาดขอบ';
  else {
    const r = radDates_(45);
    const got = satFetch_([t], r[0], r[1], RAD_OPT_);
    const last = got.rows[got.rows.length - 1];
    out = 'เรดาร์ แปลง ' + t.name + ': ได้ ' + got.rows.length + ' วัน' + (last ? ' (ล่าสุด ' + last[0] + ' VV ' + last[4] + ' dB น้ำโล่ง ' + last[6] + ')' : '') +
      (got.errors.length ? ' · ผิดพลาด: ' + got.errors[0] : '');
  }
  console.log(out);
  return out;
}

// ลงเรดาร์ย้อนหลัง ~13 เดือน ทุกแปลง + ที่ดินที่จะเช่า
function logRadarBackfill() {
  const r = satBackfill_('RADAR_BACKFILL_NEXT', 'RadarLog', RAD_H_, 400, RAD_OPT_, 'เรดาร์');
  console.log(r);
  return r;
}

// ประวัติน้ำขังหลายปีของ "ที่ดินที่จะเช่า" (เรดาร์มีตั้งแต่ปลายปี 2557) ทีละปีเรียงจากเก่า
// ใช้เวลานาน: ถ้าเกิน ~4 นาทีจะหยุดจำปีที่ค้างไว้ → กดรันซ้ำเพื่อทำต่อ จนขึ้นว่าครบ
function logRadarLandHistory() {
  const t0 = Date.now(), props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lands = satTargets_(ss, true).filter(t => t.kind === 'land');
  if (!lands.length) { const m = 'ยังไม่มีที่ดินที่วาดขอบ (วาดในแผนที่ไร่ → ที่ดิน)'; console.log(m); return m; }
  const thisYear = new Date().getFullYear();
  let y = Number(props.getProperty('RADAR_HIST_YEAR')) || 2018, total = 0, errs = [];
  while (y <= thisYear) {
    const from = y + '-01-01', to = y === thisYear ? radDates_(0)[1] : (y + 1) + '-01-01';
    const got = satFetch_(lands, from, to, RAD_OPT_);
    satUpsert_(ss, 'RadarLog', RAD_H_, got.rows);
    total += got.rows.length; errs = errs.concat(got.errors);
    y++;
    if (y <= thisYear && Date.now() - t0 > 240000) {
      props.setProperty('RADAR_HIST_YEAR', String(y));
      const m = 'ลงถึงปี ' + (y - 1) + ' แล้ว (' + total + ' แถว) · กดรันซ้ำเพื่อทำปี ' + y + ' ต่อ' + (errs.length ? ' · ผิดพลาด ' + errs.length + ': ' + errs[0] : '');
      console.log(m); return m;
    }
  }
  props.deleteProperty('RADAR_HIST_YEAR');
  const m = 'ครบแล้ว: ' + lands.length + ' ที่ดิน · เพิ่มรอบนี้ ' + total + ' แถว' + (errs.length ? ' · ผิดพลาด ' + errs.length + ': ' + errs[0] : '');
  console.log(m); return m;
}
