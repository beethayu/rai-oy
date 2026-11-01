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
  if (pts.length) return pts;
  const s = getSettings_(ss);
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

// หน้าเว็บตั้งพิกัดสำรอง (ตอนยังไม่มีแปลงไหนวาดขอบ)
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
