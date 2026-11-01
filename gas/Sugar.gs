// ===== ราคาน้ำตาลโลก (ICE Sugar No.11, สัญญาใกล้สุด SB=F จาก Yahoo Finance) → คาดราคาอ้อยขั้นต้น =====
// หน้าเว็บเรียก getSugar(force) · เก็บในแคช 30 นาที · ลงชีต SugarLog วันละแถว (ใน trigger ตอนเช้า logDailyRainTrigger)

const SUGAR_SYM_ = 'SB=F';
const SUGAR_H_ = ['timestamp', 'price', 'prev_close', 'symbol', 'logged_at'];

function sugarFetch_() {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(SUGAR_SYM_) + '?range=1y&interval=1d';
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.getResponseCode() !== 200) throw new Error('ดึงราคาน้ำตาลไม่ได้ (' + res.getResponseCode() + ')');
  const r = JSON.parse(res.getContentText()).chart.result[0];
  const m = r.meta, ts = r.timestamp || [], cl = (r.indicators.quote[0] || {}).close || [];
  const series = [];
  ts.forEach((t, i) => { if (cl[i] !== null && cl[i] !== undefined) series.push([Utilities.formatDate(new Date(t * 1000), 'Asia/Bangkok', 'yyyy-MM-dd'), Math.round(cl[i] * 100) / 100]); });
  const price = Number(m.regularMarketPrice) || (series.length ? series[series.length - 1][1] : 0);
  const prev = series.length > 1 ? series[series.length - 2][1] : Number(m.chartPreviousClose) || price;
  return {
    symbol: SUGAR_SYM_, price: Math.round(price * 100) / 100, prev: prev,
    chg: Math.round((price - prev) * 100) / 100, pct: prev ? Math.round((price - prev) / prev * 10000) / 100 : 0,
    time: m.regularMarketTime ? Utilities.formatDate(new Date(m.regularMarketTime * 1000), 'Asia/Bangkok', 'dd/MM HH:mm') : '',
    series: series, fetched: Date.now()
  };
}

// force = true ข้ามแคช (ปุ่มรีเฟรช)
function getSugar(force) {
  const cache = CacheService.getScriptCache();
  if (!force) { const c = cache.get('sugar'); if (c) return JSON.parse(c); }
  const d = sugarFetch_();
  try { cache.put('sugar', JSON.stringify(d), 1800); } catch (e) {}
  return d;
}

function logSugar_() {
  const d = getSugar(true), ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = getOrCreate_(ss, 'SugarLog', SUGAR_H_), today = getTodayStr();
  const v = sh.getDataRange().getDisplayValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === today) { sh.getRange(i + 1, 1, 1, 5).setNumberFormat('@').setValues([[today, String(d.price), String(d.prev), d.symbol, today]]); return d; }
  appendRows_(sh, [[today, d.price, d.prev, d.symbol, today]]);
  return d;
}

// บรรทัดราคาน้ำตาลในสรุป LINE ตอนเช้า
function sugarBrief_() {
  const d = getSugar(false);
  return `\n🍬 น้ำตาลโลก ${d.price} ¢/ปอนด์ (${d.chg >= 0 ? '+' : ''}${d.pct}%)\n`;
}
