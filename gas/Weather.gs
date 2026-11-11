// ===== พยากรณ์อากาศ (Open-Meteo, ฟรี ไม่ต้องใช้รหัส) เน้นฝนและลม =====
// จุดพยากรณ์ = จุดกลางของขอบแปลง จัดกลุ่มตามพื้นที่ (ชื่อแปลงตัดวงเล็บ/เลขท้าย เหมือน plotLoc ในหน้าเว็บ)
// ยังไม่มีแปลงไหนวาดขอบ → ใช้ WX_LAT/WX_LNG ในชีตตั้งค่า (หน้าเว็บตั้งจากตำแหน่งมือถือ)
// ชีต RainLog: ฝนรายวัน (ค่าประมาณจากโมเดล ไม่ใช่วัดจริง) ลงทุกเช้าด้วย trigger logDailyRain

const WX_URL_ = 'https://api.open-meteo.com/v1/forecast';
const WX_HOURLY_ = 'precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code';
const WX_DAILY_ = 'precipitation_sum,precipitation_probability_max,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,weather_code,temperature_2m_max,temperature_2m_min';
const RAIN_H_ = ['timestamp', 'loc', 'rain_mm', 'rain_hours', 'wind_max', 'gust_max', 'lat', 'lng', 'logged_at'];

function plotLoc_(n) {
  n = String(n || '');
  return n.replace(/\s*\(.*\)\s*$/, '').replace(/\s*\d+$/, '').trim() || n;
}

// [{loc, lat, lng, plots:[...]}]
function wxPoints_(ss) {
  const g = {}, order = [];
  readSheet_(ss, SH.PLOTS).forEach(p => {
    const la = Number(p.center_lat), ln = Number(p.center_lng);
    if (!la || !ln) return;
    const k = plotLoc_(p.plot_name);
    if (!g[k]) { g[k] = { loc: k, la: 0, ln: 0, n: 0, plots: [] }; order.push(k); }
    g[k].la += la; g[k].ln += ln; g[k].n++; g[k].plots.push(p.plot_id);
  });
  const pts = order.map(k => ({ loc: k, lat: +(g[k].la / g[k].n).toFixed(4), lng: +(g[k].ln / g[k].n).toFixed(4), plots: g[k].plots }));
  const s = getSettings_(ss);
  if (Number(s.HOME_LAT) && Number(s.HOME_LNG)) pts.push({ loc: 'บ้าน', lat: Number(s.HOME_LAT), lng: Number(s.HOME_LNG), plots: [] });
  if (pts.some(x => x.plots.length)) return pts;
  if (Number(s.WX_LAT) && Number(s.WX_LNG)) return [{ loc: 'ไร่', lat: Number(s.WX_LAT), lng: Number(s.WX_LNG), plots: [] }];
  return [];
}

function wxFetch_(points, extra) {
  const q = Object.assign({
    latitude: points.map(p => p.lat).join(','), longitude: points.map(p => p.lng).join(','),
    timezone: 'Asia/Bangkok', wind_speed_unit: 'kmh'
  }, extra);
  const url = WX_URL_ + '?' + Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&');
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const j = JSON.parse(res.getContentText());
  if (j && j.error) throw new Error('Open-Meteo: ' + j.reason);
  return Array.isArray(j) ? j : [j];
}

// สำรองให้หน้าเว็บ (ถ้าเรียก Open-Meteo ตรงไม่ได้) — คืนผลดิบ เรียงตาม points
function weatherForecast(points) {
  const pts = (points || []).filter(p => Number(p.lat) && Number(p.lng));
  if (!pts.length) throw new Error('ไม่มีพิกัด');
  return wxFetch_(pts, { hourly: WX_HOURLY_, daily: WX_DAILY_, forecast_days: 7, past_days: 1 });
}

// น้ำในดิน (สำรองให้หน้าเว็บ): ฝน + การระเหย ย้อน 21 วัน + พยากรณ์ 7 วัน
function soilWeather(points) {
  const pts = (points || []).filter(p => Number(p.lat) && Number(p.lng));
  if (!pts.length) throw new Error('ไม่มีพิกัด');
  return wxFetch_(pts, { daily: 'precipitation_sum,et0_fao_evapotranspiration', past_days: 21, forecast_days: 7 });
}

// หน้าเว็บตั้งพิกัดสำรอง (ตอนยังไม่มีแปลงไหนวาดขอบ)
// บ้านผู้ใช้ (6 พ.ย. 69) → แถว "บ้าน" ในพยากรณ์ + RainLog · 0,0 = เอาออก
function setHomeLoc(lat, lng) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setSetting_(ss, 'HOME_LAT', Number(lat) ? Number(lat).toFixed(4) : '');
  setSetting_(ss, 'HOME_LNG', Number(lng) ? Number(lng).toFixed(4) : '');
  return true;
}

function setWxHome(lat, lng) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!Number(lat) || !Number(lng)) throw new Error('พิกัดไม่ถูก');
  setSetting_(ss, 'WX_LAT', Number(lat).toFixed(4));
  setSetting_(ss, 'WX_LNG', Number(lng).toFixed(4));
  try { if (readSheet_(ss, 'RainLog').length === 0) logDailyRain(30); } catch (e) {}
  return true;
}

// ลงฝนรายวันของวันที่ผ่านมา days วัน (ค่าเริ่ม 1 = เมื่อวาน) ลงชีต RainLog (วันเดียวกัน+พื้นที่เดียวกัน = ทับ)
function logDailyRain(days) {
  days = Math.min(Math.max(Number(days) || 1, 1), 60);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pts = wxPoints_(ss);
  if (!pts.length) return 'ยังไม่มีพิกัด';
  const res = wxFetch_(pts, { daily: 'precipitation_sum,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max', past_days: days, forecast_days: 1 });
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const be = iso => { const p = iso.split('-'); return `${p[2]}/${p[1]}/${+p[0] + 543}`; };
  const rows = [];
  res.forEach((r, i) => {
    const d = r.daily || {};
    (d.time || []).forEach((t, k) => {
      if (t >= today) return;
      rows.push([be(t), pts[i].loc, d.precipitation_sum[k], d.precipitation_hours[k], d.wind_speed_10m_max[k], d.wind_gusts_10m_max[k], pts[i].lat, pts[i].lng, getTodayStr()]);
    });
  });
  return withLock_(() => {
    const sh = getOrCreate_(ss, 'RainLog', RAIN_H_);
    const cur = sh.getDataRange().getDisplayValues();
    const idx = {};
    for (let i = 1; i < cur.length; i++) idx[cur[i][0] + '|' + cur[i][1]] = i + 1;
    const add = [];
    rows.forEach(r => {
      const v = r.map(x => (x === null || x === undefined) ? '' : String(x));
      const at = idx[r[0] + '|' + r[1]];
      if (at) sh.getRange(at, 1, 1, v.length).setNumberFormat('@').setValues([v]);
      else add.push(v);
    });
    appendRows_(sh, add);
    return `ลง ${rows.length} แถว (${pts.map(p => p.loc).join(', ')})`;
  });
}

function logDailyRainTrigger() {
  try { logDailyRain(2); } catch (e) { console.error(e); }
  try { logSugar_(); } catch (e) { console.error(e); }   // ราคาน้ำตาลโลก (Sugar.gs)
}

// ตั้งเวลาลงฝนทุกเช้า ~03:30 (ก่อนสรุป LINE) + ลงย้อนหลัง 30 วัน
function installRainTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'logDailyRainTrigger').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('logDailyRainTrigger').timeBased().atHour(3).nearMinute(30).everyDays(1).inTimezone('Asia/Bangkok').create();
  let back = '';
  try { back = logDailyRain(30); } catch (e) { back = 'ลงย้อนหลังไม่สำเร็จ: ' + e.message; }
  return 'ตั้งเวลาแล้ว · ' + back;
}

function readRain_(ss) { return sortDesc_(readSheet_(ss, 'RainLog')).slice(0, 400); }

// บรรทัดอากาศในสรุป LINE ตอนเช้า: ฝนเมื่อวาน + วันนี้ฝน/ลม
function wxBrief_(ss) {
  const pts = wxPoints_(ss);
  if (!pts.length) return '';
  const res = wxFetch_(pts, { daily: 'precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max', past_days: 1, forecast_days: 1 });
  const lines = res.map((r, i) => {
    const d = r.daily, y = Math.round(d.precipitation_sum[0] * 10) / 10, t = d.precipitation_probability_max[1];
    return `• ${pts[i].loc}: เมื่อวานฝน ~${y} มม. · วันนี้ฝน ${t}% ${Math.round(d.precipitation_sum[1] * 10) / 10} มม. · ลม ${Math.round(d.wind_speed_10m_max[1])} (กระโชก ${Math.round(d.wind_gusts_10m_max[1])}) กม./ชม.`;
  });
  return `\n🌦️ อากาศ (ค่าประมาณ Open-Meteo)\n${lines.join('\n')}\n`;
}

// ฝนย้อนหลังรายเดือน (Open-Meteo archive) ณ พิกัดแปลง → ใช้วางแผนเดือนปลูก · คืน [{ym, mm, heavy(วันฝน ≥ 40 มม.), max}]
function rainHistory(lat, lng, years) {
  years = Math.min(Math.max(Number(years) || 5, 1), 10);
  const end = new Date(Date.now() - 3 * 864e5), start = new Date(end.getFullYear() - years, end.getMonth(), 1);
  const f = d => Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
  const url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + Number(lat) + '&longitude=' + Number(lng) +
    '&start_date=' + f(start) + '&end_date=' + f(end) + '&daily=precipitation_sum&timezone=Asia%2FBangkok';
  const j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
  if (!j.daily) throw new Error('Open-Meteo archive: ' + (j.reason || 'ไม่มีข้อมูล'));
  const m = {};
  j.daily.time.forEach((t, i) => {
    const ym = t.slice(0, 7), v = Number(j.daily.precipitation_sum[i]) || 0;
    const o = m[ym] || (m[ym] = { ym, mm: 0, heavy: 0, max: 0, days: [] });
    o.mm += v; if (v >= 40) { o.heavy++; o.days.push(t.slice(8) + ':' + Math.round(v)); } o.max = Math.max(o.max, v);
  });
  return Object.values(m).map(o => ({ ym: o.ym, mm: Math.round(o.mm), heavy: o.heavy, max: Math.round(o.max), days: o.days.join(' ') }));
}

// ฝนประจำพื้นที่ (ทุกพื้นที่ในไร่) ย้อน 6 ปี จาก Open-Meteo archive: ฝน/การระเหยเฉลี่ยรายเดือน, วันฝนหนัก, วันฝนแรกแต่ละปี
// เก็บใน Script Properties ใช้ซ้ำ 30 วัน (ข้อมูลย้อนหลังเปลี่ยนช้า) · refresh = คำนวณใหม่
function rainClimate(refresh) {
  const P = PropertiesService.getScriptProperties();
  if (!refresh) {
    try { const c = JSON.parse(P.getProperty('RAIN_CLIM') || 'null'); if (c && Date.now() - c.t < 30 * 864e5) return c; } catch (e) {}
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pts = wxPoints_(ss).filter(p => p.plots && p.plots.length);
  if (!pts.length) throw new Error('ยังไม่มีพิกัดแปลง');
  const end = new Date(Date.now() - 5 * 864e5), y0 = end.getFullYear() - 6;
  const f = d => Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
  const url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + pts.map(p => p.lat).join(',') + '&longitude=' + pts.map(p => p.lng).join(',') +
    '&start_date=' + y0 + '-01-01&end_date=' + f(end) + '&daily=precipitation_sum,et0_fao_evapotranspiration&timezone=Asia%2FBangkok';
  let j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
  if (j && j.error) throw new Error('Open-Meteo archive: ' + j.reason);
  if (!Array.isArray(j)) j = [j];
  const areas = pts.map((p, i) => {
    const d = j[i].daily, mon = {}, yr = {}, first = {};
    d.time.forEach((t, k) => {
      const y = t.slice(0, 4), m = +t.slice(5, 7), r = Number(d.precipitation_sum[k]) || 0, e = Number(d.et0_fao_evapotranspiration[k]) || 0;
      const key = y + '-' + m;
      const o = yr[key] || (yr[key] = { y, m, mm: 0, et: 0, heavy: 0, n: 0 });
      o.mm += r; o.et += e; o.n++; if (r >= 40) o.heavy++;
      // ฝนแรก: ตั้งแต่ 1 เม.ย. วันแรกที่ฝนรวม 10 วัน (นับถึงวันนั้น) ≥ 50 มม.
      if (m >= 4 && m <= 7 && !first[y]) {
        let s = 0; for (let q = Math.max(0, k - 9); q <= k; q++) s += Number(d.precipitation_sum[q]) || 0;
        if (s >= 50 && t.slice(5) >= '04-01') first[y] = t.slice(5);
      }
    });
    for (let m = 1; m <= 12; m++) {
      const a = Object.values(yr).filter(o => o.m === m && o.n >= 25);
      mon[m] = a.length ? { mm: Math.round(a.reduce((s, o) => s + o.mm, 0) / a.length), et: +(a.reduce((s, o) => s + o.et / o.n, 0) / a.length).toFixed(2),
        heavy: +(a.reduce((s, o) => s + o.heavy, 0) / a.length).toFixed(1), n: a.length } : null;
    }
    return { loc: p.loc, plots: p.plots, months: mon, firstRain: first };
  });
  const out = { t: Date.now(), from: y0, to: f(end), areas };
  try { P.setProperty('RAIN_CLIM', JSON.stringify(out)); } catch (e) { console.warn('RAIN_CLIM ใหญ่เกิน ' + e); }
  return out;
}

// ฝน + การระเหย รายวันย้อนหลัง ~6 ปี ของพื้นที่เดียว (ใช้จำลองน้ำในดินทีละปี ในการ์ด "ต้องขึ้นน้ำกี่ครั้ง")
// คืน { loc, start, r: 'มม.×10 คั่น ,', e: 'มม.×10 คั่น ,' } · แคช 6 ชม. (หน้าเว็บเก็บต่อ 30 วัน)
function rainDaily(loc) {
  const cache = CacheService.getScriptCache(), key = 'raind_' + Utilities.base64EncodeWebSafe(String(loc || ''));
  const hit = cache.get(key); if (hit) return JSON.parse(hit);
  const p = wxPoints_(SpreadsheetApp.getActiveSpreadsheet()).find(x => x.loc === loc);
  if (!p) throw new Error('ไม่พบพื้นที่ ' + loc);
  const end = new Date(Date.now() - 5 * 864e5), y0 = end.getFullYear() - 6;
  const f = d => Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
  const url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + p.lat + '&longitude=' + p.lng +
    '&start_date=' + y0 + '-01-01&end_date=' + f(end) + '&daily=precipitation_sum,et0_fao_evapotranspiration&timezone=Asia%2FBangkok';
  const j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
  if (!j || j.error || !j.daily) throw new Error('Open-Meteo archive: ' + ((j && j.reason) || 'ไม่มีข้อมูล'));
  const t10 = a => a.map(v => Math.round((Number(v) || 0) * 10)).join(',');
  const out = { loc: loc, start: j.daily.time[0], r: t10(j.daily.precipitation_sum), e: t10(j.daily.et0_fao_evapotranspiration) };
  try { cache.put(key, JSON.stringify(out), 21600); } catch (e) {}
  return out;
}
