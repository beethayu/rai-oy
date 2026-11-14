/**
 * 🌾 ระบบจัดการไร่อ้อย 281 ไร่ — V7.0
 * ใหม่ใน V7.0:
 *  - 📦 ตัดสต็อกยา/ปุ๋ยอัตโนมัติ (ชีต Inventory + StockLogs) แก้/ลบงาน = คืนยอดให้เอง
 *  - 🔔 แจ้งเตือน LINE ทุกเช้า (ตรงเวลา ตั้งได้ในชีต Settings หรือในแอป)
 *  - 🔧 ประวัติซ่อม/บำรุงรายคัน + นับวันที่เสีย
 *  - ⚡ เร็วขึ้น: ตั้งค่าครั้งเดียว, อ่าน/เขียนชีตแบบรวดเดียว, กันบันทึกชนกัน (LockService)
 *  - 📅 วันที่ถูกเก็บเป็นข้อความ dd/mm/yyyy(พ.ศ.) ป้องกัน Sheets แปลงวันเพี้ยน
 *
 * ติดตั้งครั้งแรก: เลือกฟังก์ชัน setupV7 แล้วกด ▶ เรียกใช้ 1 ครั้ง (อนุญาตสิทธิ์ส่ง LINE / ตั้งเวลา)
 */

const APP_VERSION = '7.0';
const SH = {
  PLOTS: 'Plots', ACT: 'Activities', OPT: 'MasterOptions', ASSET: 'Assets',
  ALOG: 'AssetLogs', INV: 'Inventory', SLOG: 'StockLogs', SET: 'Settings'
};
const HEADERS = {
  Assets: ['asset_id', 'category', 'name', 'status', 'issue_detail', 'parts_needed', 'battery_info', 'battery_date', 'updated_at'],
  AssetLogs: ['log_id', 'timestamp', 'asset_name', 'category', 'event_type', 'detail', 'parts_or_battery', 'ref_plot'],
  Inventory: ['item_id', 'category', 'name', 'note', 'unit', 'pack_size', 'pack_name', 'per_tank', 'stock', 'reorder_point', 'updated_at'],
  StockLogs: ['log_id', 'timestamp', 'item_name', 'change_qty', 'unit', 'ref_log_id', 'plot_id', 'note'],
  Settings: ['key', 'value', 'description']
};
const DEFAULT_SETTINGS = [
  ['LINE_CHANNEL_TOKEN', '', 'Channel access token (long-lived) จาก LINE Developers'],
  ['LINE_TARGET_ID', '', 'ว่าง = ส่งหาทุกคนที่แอดเพื่อน OA (broadcast) | ใส่ User ID หรือ Group ID = ส่งเฉพาะที่นั้น'],
  ['NOTIFY_ENABLED', 'ปิด', 'เปิด / ปิด การแจ้งเตือนทุกเช้า'],
  ['NOTIFY_TIME', '04:00', 'เวลาส่งสรุปทุกเช้า (ชม:นาที)'],
  ['WATER_DAYS_NEW', '12', 'รอบน้ำอ้อยใหม่ (วัน)'],
  ['WATER_DAYS_RATOON', '15', 'รอบน้ำอ้อยตอ (วัน)'],
  ['SPRAY_DAY_MIN', '3', 'ฉีดยาคุมได้หลังน้ำ ตั้งแต่วันที่'],
  ['SPRAY_DAY_MAX', '5', 'ฉีดยาคุมได้หลังน้ำ ถึงวันที่'],
  ['CHEM_PRESET_NEW', 'Becano,Zytron Mix,Bakaron', 'สูตรยาอ้อยใหม่ (ชื่อตรงกับชีต Inventory คั่นด้วย ,)'],
  ['CHEM_PRESET_GROW', 'Becano,Zytron Mix,Bakapost', 'สูตรยาอ้อยโต'],
  ['FERT_PRESET_BASE', '16-8-8:1', 'สูตรปุ๋ยรองพื้น (สูตร:สัดส่วน)'],
  ['FERT_PRESET_RATOON', '21-0-0:3,16-8-8:1', 'สูตรปุ๋ยอ้อยตอ (สูตร:สัดส่วน คั่นด้วย ,)'],
  ['LAST_NOTIFY', '', '(ระบบใช้) วันที่ส่ง LINE ล่าสุด']
];

// ======================= พื้นฐาน =======================
function doGetOld() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('จัดการไร่อ้อย 281 ไร่ (V7.0)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getTodayStr() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear() + 543}`;
}

function dateKey_(s) {
  const p = String(s || '').trim().split('/');
  if (p.length !== 3) return 0;
  let d = parseInt(p[0], 10), m = parseInt(p[1], 10), y = parseInt(p[2], 10);
  if (!d || !m || !y) return 0;
  if (y > 2400) y -= 543;
  return y * 10000 + m * 100 + d;
}

function daysSince_(s) {
  const k = dateKey_(s);
  if (!k) return null;
  const dt = new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now - dt) / 86400000));
}

// วันที่เหลือถึงวันนั้น (ติดลบ = เลยมาแล้ว)
function daysUntil_(s) {
  const k = dateKey_(s);
  if (!k) return null;
  const dt = new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((dt - now) / 86400000);
}
// ทะเบียน/ภาษีที่เหลือ ≤ 30 วัน (รถไร่ + รถส่วนตัว) สำหรับสรุป LINE
function regBrief_(assets) {
  const ic = { Truck: '🚛', Tractor: '🚜', Car: '🚙', Home: '🚗' }, out = [];
  assets.filter(a => ic[a.category]).forEach(a => {
    [[a.name, a.plate, a.reg_expire], [a.name + ' (พ่วง)', a.trailer_plate, a.trailer_reg_expire]].forEach(([n, pl, ex]) => {
      const d = daysUntil_(ex);
      if (d === null || d > 30) return;
      out.push({ d, t: `• ${ic[a.category]} ${n}${pl && pl !== '-' ? ' ' + pl : ''}: ${d < 0 ? `เลยมา ${-d} วัน (ห้ามขับ ต่อด่วน)` : d === 0 ? 'หมดวันนี้' : `หมด ${ex} อีก ${d} วัน`}` });
    });
  });
  return out.sort((x, y) => x.d - y.d).map(x => x.t);
}

function round_(n) { return Math.round(n * 1000) / 1000; }

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function getOrCreate_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#38761d').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  return sh;
}

// เขียนหลายแถวต่อท้ายในครั้งเดียว (เก็บเป็นข้อความ กันวันที่เพี้ยน)
function appendRows_(sh, rows) {
  if (!rows || !rows.length) return;
  const rg = sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length);
  rg.setNumberFormat('@');
  rg.setValues(rows.map(r => r.map(v => (v === null || v === undefined) ? '' : String(v))));
}

// อ่านชีตเป็น array ของ object (raw=true: ตัวเลขคงเป็น number)
function readSheet_(ss, name, raw) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  const rng = sh.getDataRange();
  const disp = rng.getDisplayValues();
  if (disp.length <= 1) return [];
  const vals = raw ? rng.getValues() : null;
  const h = disp[0], out = [];
  for (let r = 1; r < disp.length; r++) {
    if (!disp[r].some(v => v !== '')) continue;
    const o = {};
    h.forEach((k, i) => { if (k) o[k] = (raw && typeof vals[r][i] === 'number') ? vals[r][i] : disp[r][i]; });
    out.push(o);
  }
  return out;
}

// เรียงใหม่→เก่า ตามวันที่ (วันเท่ากัน แถวหลังขึ้นก่อน)
function sortDesc_(arr) {
  return arr.map((o, i) => ({ o, i, k: dateKey_(o.timestamp) }))
    .sort((a, b) => (b.k - a.k) || (b.i - a.i)).map(x => x.o);
}

function readOptions_(ss) {
  const sh = ss.getSheetByName(SH.OPT);
  if (!sh) return {};
  const d = sh.getDataRange().getDisplayValues();
  const h = d.shift() || [];
  const o = {};
  h.forEach((k, i) => { if (k) o[k] = d.map(r => r[i]).filter(Boolean); });
  return o;
}

function getSettings_(ss) {
  const o = {};
  const sh = ss.getSheetByName(SH.SET);
  if (sh) sh.getDataRange().getDisplayValues().slice(1).forEach(r => { if (r[0]) o[r[0]] = String(r[1]).trim(); });
  DEFAULT_SETTINGS.forEach(d => { if (!(d[0] in o)) o[d[0]] = d[1]; });
  return o;
}

function setSetting_(ss, key, val) {
  const sh = getOrCreate_(ss, SH.SET, HEADERS.Settings);
  const d = sh.getDataRange().getDisplayValues();
  for (let i = 1; i < d.length; i++) {
    if (d[i][0] === key) { sh.getRange(i + 1, 2).setNumberFormat('@').setValue(String(val)); return; }
  }
  appendRows_(sh, [[key, String(val), '']]);
}

// ======================= ตั้งค่าระบบ (ทำครั้งเดียว) =======================
function setupV7() {
  ensureSetup_(true);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = getSettings_(ss);
  if (s.NOTIFY_ENABLED === 'เปิด') installNotifyTriggers_(s);
  Logger.log('✅ ตั้งค่า V7.0 เรียบร้อย: สร้างชีต Inventory / StockLogs / Settings แล้ว');
}

function ensureSetup_(force) {
  const props = PropertiesService.getScriptProperties();
  if (!force && props.getProperty('SETUP_VER') === APP_VERSION) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = getTodayStr();

  // 1) MasterOptions: เพิ่มคอลัมน์ Truck / Pump ถ้ายังไม่มี + ActivityGroup "ตัดอ้อย"
  const opt = ss.getSheetByName(SH.OPT);
  if (opt) {
    const head = opt.getRange(1, 1, 1, Math.max(opt.getLastColumn(), 1)).getDisplayValues()[0];
    while (head.length && head[head.length - 1] === '') head.pop();
    const ensureCol = (name, defs) => {
      if (head.indexOf(name) !== -1) return;
      const c = head.length + 1; head.push(name);
      opt.getRange(1, c).setValue(name);
      if (defs.length) opt.getRange(2, c, defs.length, 1).setValues(defs.map(v => [v]));
    };
    ensureCol('Truck', ['สิบล้อคันที่ 1']);
    ensureCol('Pump', ['พญานาค หมายเลข 1', 'พญานาค หมายเลข 2', 'พญานาค หมายเลข 3']);
    const gi = head.indexOf('ActivityGroup');
    if (gi !== -1 && opt.getLastRow() > 1) {
      const col = opt.getRange(2, gi + 1, opt.getLastRow() - 1, 1).getDisplayValues().map(r => r[0]).filter(String);
      if (!col.includes('ตัดอ้อย')) opt.getRange(col.length + 2, gi + 1).setValue('ตัดอ้อย');
    }
  }

  // 2) Assets / AssetLogs
  getOrCreate_(ss, SH.ASSET, HEADERS.Assets);
  getOrCreate_(ss, SH.ALOG, HEADERS.AssetLogs);
  syncAssets_(ss);

  // 3) Inventory (ยอดเริ่มต้น 0)
  if (!ss.getSheetByName(SH.INV)) {
    const sh = getOrCreate_(ss, SH.INV, HEADERS.Inventory);
    const rows = [
      ['CH_1', 'Chemical', 'Becano', 'บีคาโน (อินดาซิแฟลม 50% SC)', 'ml', 100, 'ขวด', 20, 0, 0, today],
      ['CH_2', 'Chemical', 'Zytron Mix', 'ไซทรอน มิกซ์', 'ml', 500, 'ขวด', 250, 0, 0, today],
      ['CH_3', 'Chemical', 'Bakaron', 'บาก้ารอน (ไดยูรอน 80% SC)', 'ml', 1000, 'ขวด', 1000, 0, 0, today],
      ['CH_4', 'Chemical', 'Bakapost', 'บาก้าโพส (อะมีทรีน 80% WG)', 'g', 1000, 'ถุง', 300, 0, 0, today],
      ['FT_1', 'Fertilizer', 'เทอราโกร 21-0-0', 'กระสอบ 50 กก.', 'กระสอบ', 1, 'กระสอบ', '', 0, 0, today],
      ['FT_2', 'Fertilizer', 'มหาวงศ์ 21-0-0', 'กระสอบ 50 กก.', 'กระสอบ', 1, 'กระสอบ', '', 0, 0, today],
      ['FT_3', 'Fertilizer', 'มหาวงศ์ 16-8-8', 'กระสอบ 50 กก.', 'กระสอบ', 1, 'กระสอบ', '', 0, 0, today]
    ];
    [1, 2, 3, 4, 5, 7, 11].forEach(c => sh.getRange(2, c, rows.length, 1).setNumberFormat('@'));
    sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  // 4) StockLogs
  getOrCreate_(ss, SH.SLOG, HEADERS.StockLogs);

  // 5) Settings (เติมคีย์ที่ขาด)
  const setSh = getOrCreate_(ss, SH.SET, HEADERS.Settings);
  const have = new Set(setSh.getDataRange().getDisplayValues().slice(1).map(r => r[0]));
  appendRows_(setSh, DEFAULT_SETTINGS.filter(r => !have.has(r[0])));

  props.setProperty('SETUP_VER', APP_VERSION);
}

// ซิงค์รายชื่อจาก MasterOptions เข้า Assets (คืนค่า true ถ้ามีการเพิ่ม)
function syncAssets_(ss, options, assets) {
  options = options || readOptions_(ss);
  const sh = ss.getSheetByName(SH.ASSET);
  if (!sh) return false;
  const names = new Set((assets || readSheet_(ss, SH.ASSET)).map(a => a.name));
  const today = getTodayStr();
  const rows = []; let n = 0;
  [['Tractor', 'TR', 'พร้อมใช้', true], ['Truck', 'TK', 'พร้อมใช้', true], ['Pump', 'PM', 'พร้อมใช้', false], ['Worker', 'WK', 'ปกติ', false], ['Car', 'CR', 'พร้อมใช้', false], ['Home', 'HC', 'พร้อมใช้', false]]
    .forEach(([cat, pre, st, hasBat]) => {
      (options[cat] || []).forEach(name => {
        if (names.has(name)) return;
        names.add(name);
        rows.push([pre + '_' + Date.now().toString().slice(-6) + (n++), cat, name, st, '-', '-',
          hasBat ? `แบตติดรถ (${name})` : (cat === 'Pump' ? 'ไม่ใช้แบต/มือหมุน' : '-'), hasBat ? today : '-', today]);
      });
    });
  if (rows.length) appendRows_(sh, rows);
  return rows.length > 0;
}

// ======================= โหลดข้อมูล =======================
function getInitialData() {
  ensureSetup_(false);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = readAll_(ss);
  if (syncAssets_(ss, data.options, data.assets)) data.assets = readSheet_(ss, SH.ASSET);
  return data;
}

function readAll_(ss) {
  const s = getSettings_(ss);
  const pub = {};
  Object.keys(s).forEach(k => { if (k !== 'LINE_CHANNEL_TOKEN') pub[k] = s[k]; });
  pub.hasToken = !!s.LINE_CHANNEL_TOKEN;
  return {
    version: APP_VERSION,
    today: getTodayStr(),
    plots: readSheet_(ss, SH.PLOTS),
    activities: sortDesc_(readSheet_(ss, SH.ACT)),
    options: readOptions_(ss),
    assets: readSheet_(ss, SH.ASSET),
    assetLogs: sortDesc_(readSheet_(ss, SH.ALOG)),
    inventory: readSheet_(ss, SH.INV, true),
    stockLogs: sortDesc_(readSheet_(ss, SH.SLOG, true)),
    watches: readSheet_(ss, 'Watch').filter(w => w.status === 'open'),
    expenses: sortDesc_(readSheet_(ss, 'Expenses', true)),
    ...readRock_(ss),
    lands: readSheet_(ss, 'Lands'),
    damages: readSheet_(ss, 'Damages'),
    waterPlans: readSheet_(ss, 'WaterPlans'),
    flows: readSheet_(ss, 'Flow'),
    flowDef: FLOW_DEF_,
    plotPhotos: sortDesc_(readSheet_(ss, 'PlotPhotos')),
    yields: readSheet_(ss, 'Yields'),
    rainLog: readRain_(ss),
    settings: pub
  };
}

// ======================= ตัวเลือก / แปลง =======================
function updateMasterOption(category, action, value) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    masterOpt_(ss, category, action, value);
    return readAll_(ss);
  });
}
// ใช้ร่วมกับ chatApply (อยู่ใน lock แล้ว)
function masterOpt_(ss, category, action, value) {
  {
    const sheet = ss.getSheetByName(SH.OPT);
    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0];
    let colIdx = headers.indexOf(category);
    if (colIdx === -1) {
      colIdx = headers.length;
      sheet.getRange(1, colIdx + 1).setValue(category);
    }
    let colValues = [];
    for (let i = 1; i < data.length; i++) if (data[i][colIdx]) colValues.push(data[i][colIdx]);

    if (action === 'add' && value && !colValues.includes(value)) {
      colValues.push(value);
    } else if (action === 'remove') {
      colValues = colValues.filter(v => v !== value);
      const assetSheet = ss.getSheetByName(SH.ASSET);
      if (assetSheet) {
        const aData = assetSheet.getDataRange().getDisplayValues();
        for (let r = aData.length - 1; r >= 1; r--) if (aData[r][2] === value) assetSheet.deleteRow(r + 1);
      }
    }
    const maxRows = Math.max(sheet.getLastRow(), colValues.length + 1);
    if (maxRows > 1) sheet.getRange(2, colIdx + 1, maxRows, 1).clearContent();
    if (colValues.length) sheet.getRange(2, colIdx + 1, colValues.length, 1).setValues(colValues.map(v => [v]));
    if (action === 'add') syncAssets_(ss);
  }
}

function updatePlotInfo(payload) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SH.PLOTS);
    const data = sh.getDataRange().getDisplayValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === payload.plot_id) {
        sh.getRange(i + 1, 6).setNumberFormat('@');
        sh.getRange(i + 1, 2, 1, 5).setValues([[payload.plot_name, payload.area_rai, payload.cane_type, payload.cane_variety, payload.plant_date]]);
        if (payload.tags !== undefined) {
          const c = plotTagCol_(sh);
          sh.getRange(i + 1, c).setNumberFormat('@').setValue(cleanTags_(payload.tags));
        }
        break;
      }
    }
    return readAll_(ss);
  });
}

// ป้ายประจำแปลง (คอลัมน์ tags ในชีต Plots คั่นด้วยจุลภาค เช่น "ดินทราย") — สร้างคอลัมน์ให้เองถ้ายังไม่มี
function plotTagCol_(sh) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const i = head.indexOf('tags');
  if (i !== -1) return i + 1;
  let c = head.length;
  while (c > 0 && head[c - 1] === '') c--;
  sh.getRange(1, c + 1).setValue('tags').setFontWeight('bold');
  return c + 1;
}

function cleanTags_(t) {
  const arr = Array.isArray(t) ? t : String(t || '').split(',');
  return arr.map(x => String(x).trim()).filter((x, i, a) => x && a.indexOf(x) === i).join(',');
}

// ติด/เอาป้ายออกหลายแปลงในครั้งเดียว: setPlotTags(['P01','P02'], 'ดินทราย', true)
function setPlotTags(plotIds, tag, on) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SH.PLOTS);
    const c = plotTagCol_(sh);
    const d = sh.getDataRange().getDisplayValues();
    const want = new Set(plotIds || []);
    const t = String(tag || '').trim();
    if (!t) throw new Error('ไม่ได้ระบุป้าย');
    const out = d.slice(1).map(r => {
      const cur = cleanTags_(r[c - 1] || '').split(',').filter(Boolean);
      if (!want.has(r[0])) return [r[c - 1] || ''];
      const has = cur.indexOf(t) !== -1;
      if (on !== false && !has) cur.push(t);
      if (on === false && has) cur.splice(cur.indexOf(t), 1);
      return [cur.join(',')];
    });
    if (out.length) sh.getRange(2, c, out.length, 1).setNumberFormat('@').setValues(out);
    return readAll_(ss);
  });
}

// ======================= งานในแปลง =======================
function buildNote_(a) {
  const rmk = a[8] || '';
  const isOng = rmk.includes('[⏳กำลังทำ]');
  const clean = rmk.replace('[⏳กำลังทำ]', '').replace('[✅เสร็จสิ้น]', '').trim();
  const det = `${a[3]}${a[4] && a[4] !== '-' ? ' (' + a[4] + ')' : ''}`;
  const eq = (a[5] && a[5] !== '-') ? ` [${a[5]}]` : '';
  const q = (a[6] && a[6] !== '-') ? ` [${a[6]}]` : '';
  const r = clean ? ` (${clean})` : '';
  return isOng ? `[กำลังทำ] ${det}${eq} | เริ่ม ${a[1]}${q}${r}` : `✅ ${det}${eq} เสร็จ ${a[1]}${q}${r}`;
}

// อัปเดตวันน้ำล่าสุด + งานล่าสุด ของหลายแปลงในครั้งเดียว (อ่าน Activities รอบเดียว เขียน Plots รอบเดียว)
function syncPlots_(ss, plotIds) {
  const want = new Set(plotIds);
  const act = ss.getSheetByName(SH.ACT).getDataRange().getDisplayValues();
  const info = {};
  for (let i = 1; i < act.length; i++) {
    const r = act[i];
    if (!want.has(r[2])) continue;
    const k = dateKey_(r[1]);
    const o = info[r[2]] || (info[r[2]] = { lk: -1, latest: null, ok: -1, ong: null, wk: -1, water: '' });
    const ongoing = (r[8] || '').includes('[⏳กำลังทำ]');
    if (k >= o.lk) { o.lk = k; o.latest = r; }
    if (ongoing && k >= o.ok) { o.ok = k; o.ong = r; }
    if ((r[3] === 'ขึ้นน้ำ' || r[3] === 'ฝนตก') && !ongoing && k >= o.wk) { o.wk = k; o.water = r[1]; }
  }
  const plotSh = ss.getSheetByName(SH.PLOTS);
  const pd = plotSh.getDataRange().getDisplayValues();
  if (pd.length <= 1) return;
  const out = pd.slice(1).map(r => [r[6], r[7]]);
  for (let r = 1; r < pd.length; r++) {
    if (!want.has(pd[r][0])) continue;
    const o = info[pd[r][0]];
    if (!o) { out[r - 1] = [pd[r][6], '-']; continue; }
    out[r - 1] = [o.water || pd[r][6], buildNote_(o.ong || o.latest)];
  }
  const rg = plotSh.getRange(2, 7, out.length, 2);
  rg.setNumberFormat('@');
  rg.setValues(out);
}

// ===== รถจ้าง: คอลัมน์ hire ต่อท้ายชีต Activities (สร้างเองครั้งแรกที่มีงานจ้าง) =====
// เก็บ JSON ต่อแถว (ต่อแปลง) {by ผู้รับจ้าง, u หน่วย ชม.|ไร่|ตัน|เหมา, r ราคาต่อหน่วย, q จำนวนของแปลงนี้, a บาท} · เหมา: q = บาท
// payload.hire = {by, u, r, q: [จำนวนเรียงตาม plotIds] หรือเลขเดียว}
const HIRE_U_ = ['ชม.', 'ไร่', 'ตัน', 'เหมา'];
function hireCell_(h, i) {
  if (!h || typeof h !== 'object') return '';
  const u = HIRE_U_.indexOf(h.u) >= 0 ? h.u : 'ชม.', by = String(h.by || '').trim().slice(0, 60);
  const q = Math.max(0, Number(Array.isArray(h.q) ? h.q[i] : h.q) || 0), r = u === 'เหมา' ? 0 : Math.max(0, Number(h.r) || 0);
  if (!by && !q && !r) return '';
  return JSON.stringify({ by, u, r, q, a: u === 'เหมา' ? q : Math.round(q * r * 100) / 100 });
}
function hireCol_(sh, make) { // เลขคอลัมน์ hire (1-based) · ยังไม่มีและ make = สร้างหัวคอลัมน์
  const w = Math.max(sh.getLastColumn(), 1), hd = sh.getRange(1, 1, 1, w).getDisplayValues()[0], c = hd.indexOf('hire');
  if (c >= 0) return c + 1;
  if (!make) return 0;
  sh.getRange(1, w + 1).setValue('hire').setFontWeight('bold').setBackground('#38761d').setFontColor('#ffffff');
  return w + 1;
}
function withHire_(sh, rows, h) {
  if (!h || !rows.length || !rows.some((r, i) => hireCell_(h, i))) return rows;
  const c = hireCol_(sh, true);
  return rows.map((r, i) => { const x = r.slice(); while (x.length < c) x.push(''); x[c - 1] = hireCell_(h, i); return x; });
}

function saveActivities(payload) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SH.ACT);
    const date = payload.custom_date || getTodayStr();
    const g = payload.activity_group;
    const rmk = (payload.is_ongoing ? '[⏳กำลังทำ] ' : '[✅เสร็จสิ้น] ') + (payload.remark || '');
    const pid0 = payload.plotIds[0];

    if (payload.edit_log_id) {
      const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getDisplayValues();
      for (let i = ids.length - 1; i >= 1; i--) {
        if (ids[i][0] === String(payload.edit_log_id)) {
          const rg = sh.getRange(i + 1, 2, 1, 8);
          rg.setNumberFormat('@');
          rg.setValues([[date, pid0, g, payload.activity_detail || '-', payload.equipment || '-', payload.quantity || '-', payload.operator || '-', rmk]]);
          const hc = hireCol_(sh, !!hireCell_(payload.hire, 0));
          if (hc) sh.getRange(i + 1, hc).setNumberFormat('@').setValue(hireCell_(payload.hire, 0));
          break;
        }
      }
      reverseUsage_(ss, payload.edit_log_id);
      applyUsage_(ss, payload.usage, payload.edit_log_id, pid0, date, g);
      syncPlots_(ss, [pid0]);
      return readAll_(ss);
    }

    const base = Date.now();
    const rows = withHire_(sh, payload.plotIds.map((pid, i) => ['L' + base + '_' + i, date, pid, g,
      payload.activity_detail || '-', payload.equipment || '-', payload.quantity || '-', payload.operator || '-', rmk]), payload.hire);
    appendRows_(sh, rows);
    applyUsage_(ss, payload.usage, rows[0][0], pid0, date, g);
    syncPlots_(ss, payload.plotIds);
    try { closeWatchesFor_(ss, payload.plotIds, g, payload.activity_detail || '', rows[0][0]); } catch (e) {}
    return readAll_(ss);
  });
}

// ลงงานย้อนหลังจากไฟล์จดมือ: rows = [[วันที่, plot_id, กลุ่ม, รายละเอียด, รถ/ปั๊ม, จำนวน, คน, หมายเหตุ]]
// ไม่ตัดสต็อก, หมายเหตุมีคำ HIST_MARK_ (ใช้ลบทั้งชุดได้), แถวซ้ำ (แปลง+วัน+กลุ่ม+รายละเอียด+หมายเหตุ) ข้าม
// วันน้ำล่าสุด/งานค้าง คิดจากวันที่ล่าสุดเสมอ (syncPlots_) งานเก่าจึงไม่ทับของใหม่
const HIST_MARK_ = 'ย้อนหลังจากไฟล์จดมือ';
function importHistory(rows) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SH.ACT);
    const cur = sh.getDataRange().getDisplayValues();
    const key = r => [r[0], r[1], r[2], r[3], r[7]].join('|');
    const seen = new Set(cur.slice(1).filter(r => (r[8] || '').indexOf(HIST_MARK_) !== -1)
      .map(r => key([r[1], r[2], r[3], r[4], 0, 0, 0, r[8]])));
    const base = Date.now(), out = [], plots = new Set();
    (rows || []).forEach((r, i) => {
      if (!r || !r[0] || !r[1] || !r[2]) return;
      let rmk = String(r[7] || '').trim();
      if (rmk.indexOf(HIST_MARK_) === -1) rmk = (rmk ? rmk + ' ' : '') + '(' + HIST_MARK_ + ')';
      rmk = '[✅เสร็จสิ้น] ' + rmk;
      const row = ['H' + base + '_' + i, r[0], r[1], r[2], r[3] || '-', r[4] || '-', r[5] || '-', r[6] || '-', rmk];
      const k = key([row[1], row[2], row[3], row[4], 0, 0, 0, row[8]]);
      if (seen.has(k)) return;
      seen.add(k); plots.add(row[2]);
      out.push(r[8] && typeof r[8] === 'object' ? withHire_(sh, [row], r[8])[0] : row); // r[8] = รถจ้าง {by,u,r,q}
    });
    if (out.length) { const w = Math.max.apply(null, out.map(x => x.length)); out.forEach(x => { while (x.length < w) x.push(''); }); }
    appendRows_(sh, out);
    if (plots.size) syncPlots_(ss, [...plots]);
    const res = readAll_(ss);
    res.imported = out.length;
    return res;
  });
}

// ลบงานย้อนหลังทั้งชุด (เฉพาะแถวที่หมายเหตุมี HIST_MARK_) ถ้าใส่ plotIds = ลบเฉพาะแปลงนั้น
function removeHistoryImport(plotIds) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SH.ACT);
    const d = sh.getDataRange().getDisplayValues();
    const only = plotIds && plotIds.length ? new Set(plotIds) : null;
    const plots = new Set();
    let n = 0;
    for (let i = d.length - 1; i >= 1; i--) {
      if ((d[i][8] || '').indexOf(HIST_MARK_) === -1) continue;
      if (only && !only.has(d[i][2])) continue;
      plots.add(d[i][2]); sh.deleteRow(i + 1); n++;
    }
    if (plots.size) syncPlots_(ss, [...plots]);
    const res = readAll_(ss);
    res.removed = n;
    return res;
  });
}

function deleteActivity(logId, plotId) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SH.ACT);
    const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getDisplayValues();
    for (let i = ids.length - 1; i >= 1; i--) {
      if (ids[i][0] === String(logId)) { sh.deleteRow(i + 1); break; }
    }
    reverseUsage_(ss, logId);
    syncPlots_(ss, [plotId]);
    return readAll_(ss);
  });
}

// ======================= สต็อกยา / ปุ๋ย =======================
function invCols_(h) {
  return { id: h.indexOf('item_id'), name: h.indexOf('name'), stock: h.indexOf('stock'), unit: h.indexOf('unit'), upd: h.indexOf('updated_at') };
}

// ตัดสต็อกตามรายการที่ใช้ usage = [{name, qty}] (qty = หน่วยย่อย เช่น ml, g, กระสอบ)
function applyUsage_(ss, usage, ref, plotId, date, note) {
  usage = (usage || []).filter(u => u && u.name && Number(u.qty) > 0);
  if (!usage.length) return;
  const sh = ss.getSheetByName(SH.INV);
  const d = sh.getDataRange().getValues();
  const c = invCols_(d[0]);
  const today = getTodayStr(), logs = [], base = Date.now();
  usage.forEach((u, k) => {
    const r = d.findIndex((row, i) => i > 0 && String(row[c.name]) === u.name);
    let unit = '';
    if (r > 0) {
      unit = d[r][c.unit];
      const nv = round_((Number(d[r][c.stock]) || 0) - Number(u.qty));
      d[r][c.stock] = nv;
      sh.getRange(r + 1, c.stock + 1).setValue(nv);
      sh.getRange(r + 1, c.upd + 1).setNumberFormat('@').setValue(today);
    }
    logs.push(['S' + base + '_' + k, date, u.name, -round_(Number(u.qty)), unit, ref, plotId || '-', note || '']);
  });
  appendRows_(ss.getSheetByName(SH.SLOG), logs);
}

// คืนยอดสต็อกของงานที่ถูกแก้/ลบ
function reverseUsage_(ss, ref) {
  const slog = ss.getSheetByName(SH.SLOG);
  if (!slog || slog.getLastRow() < 2) return;
  const d = slog.getDataRange().getDisplayValues();
  const back = {}, rows = [];
  for (let i = 1; i < d.length; i++) {
    if (d[i][5] === String(ref)) {
      back[d[i][2]] = (back[d[i][2]] || 0) - (parseFloat(String(d[i][3]).replace(/,/g, '')) || 0);
      rows.push(i + 1);
    }
  }
  if (!rows.length) return;
  rows.reverse().forEach(r => slog.deleteRow(r));
  const sh = ss.getSheetByName(SH.INV);
  const v = sh.getDataRange().getValues();
  const c = invCols_(v[0]);
  Object.keys(back).forEach(name => {
    const r = v.findIndex((row, i) => i > 0 && String(row[c.name]) === name);
    if (r > 0) sh.getRange(r + 1, c.stock + 1).setValue(round_((Number(v[r][c.stock]) || 0) + back[name]));
  });
}

// รับของเข้า (mode 'in') หรือ นับยอดจริง (mode 'set')
function receiveStock(p) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SH.INV);
    const d = sh.getDataRange().getValues();
    const c = invCols_(d[0]);
    const r = d.findIndex((row, i) => i > 0 && String(row[c.name]) === p.name);
    if (r < 1) throw new Error('ไม่พบรายการ ' + p.name);
    const cur = Number(d[r][c.stock]) || 0, q = Number(p.qty) || 0;
    const nv = round_(p.mode === 'set' ? q : cur + q);
    sh.getRange(r + 1, c.stock + 1).setValue(nv);
    sh.getRange(r + 1, c.upd + 1).setNumberFormat('@').setValue(getTodayStr());
    appendRows_(ss.getSheetByName(SH.SLOG), [['S' + Date.now(), p.date || getTodayStr(), p.name, round_(nv - cur),
      d[r][c.unit], p.mode === 'set' ? '⚖️ ปรับยอด' : '📥 รับเข้า', '-', p.note || '']]);
    return readAll_(ss);
  });
}

function saveStockItem(p) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    saveStockItem_(ss, p);
    return readAll_(ss);
  });
}

// เพิ่ม/แก้รายการสต็อก (เรียกในล็อกเดียวกับ chatApply ได้)
function saveStockItem_(ss, p) {
  {
    const sh = ss.getSheetByName(SH.INV);
    const d = sh.getDataRange().getDisplayValues();
    const h = d[0];
    const textCols = ['item_id', 'category', 'name', 'note', 'unit', 'pack_name', 'updated_at'];
    const fields = ['category', 'name', 'note', 'unit', 'pack_size', 'pack_name', 'per_tank', 'reorder_point'];
    const dup = d.findIndex((row, i) => i > 0 && row[h.indexOf('name')] === p.name && row[h.indexOf('item_id')] !== p.item_id);
    if (dup > 0) throw new Error('มีรายการชื่อ "' + p.name + '" อยู่แล้ว');
    let r = p.item_id ? d.findIndex((row, i) => i > 0 && row[h.indexOf('item_id')] === p.item_id) : -1;
    if (r < 1) {
      const pre = { Chemical: 'CH_', Fertilizer: 'FT_', Fuel: 'FU_' }[p.category] || 'OT_';
      r = sh.getLastRow();
      const vals = { item_id: pre + Date.now().toString().slice(-6), stock: 0 };
      h.forEach((k, i) => { if (textCols.includes(k)) sh.getRange(r + 1, i + 1).setNumberFormat('@'); });
      sh.getRange(r + 1, 1, 1, h.length).setValues([h.map(k => k in vals ? vals[k] : (k === 'updated_at' ? getTodayStr() : (p[k] !== undefined ? p[k] : '')))]);
    } else {
      fields.forEach(f => {
        const ci = h.indexOf(f);
        if (ci === -1) return;
        const cell = sh.getRange(r + 1, ci + 1);
        if (textCols.includes(f)) cell.setNumberFormat('@');
        cell.setValue(p[f]);
      });
      sh.getRange(r + 1, h.indexOf('updated_at') + 1).setNumberFormat('@').setValue(getTodayStr());
    }
  }
}

function deleteStockItem(itemId) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SH.INV);
    const d = sh.getDataRange().getDisplayValues();
    for (let i = d.length - 1; i >= 1; i--) if (d[i][0] === itemId) { sh.deleteRow(i + 1); break; }
    return readAll_(ss);
  });
}

// ======================= รถ / พญานาค / คนงาน =======================
// keep_status = true → บันทึกงานบำรุงรักษาอย่างเดียว ไม่เปลี่ยนสถานะ
function saveAssetEvent(payload) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assetSheet = ss.getSheetByName(SH.ASSET);
    const logSheet = ss.getSheetByName(SH.ALOG);
    const actDate = payload.custom_date || getTodayStr();

    if (!payload.keep_status) {
      const aData = assetSheet.getDataRange().getDisplayValues();
      for (let i = 1; i < aData.length; i++) {
        if (aData[i][2] === payload.asset_name) {
          const bat = payload.battery_info !== undefined ? payload.battery_info : aData[i][6];
          const batDate = payload.battery_date !== undefined ? payload.battery_date : aData[i][7];
          const rg = assetSheet.getRange(i + 1, 4, 1, 6);
          rg.setNumberFormat('@');
          rg.setValues([[payload.status, payload.issue_detail || '-', payload.parts_needed || '-', bat, batDate, actDate]]);
          break;
        }
      }
    }
    appendRows_(logSheet, [['AL' + Date.now(), actDate, payload.asset_name, payload.category || '-',
      payload.event_type || payload.status, payload.issue_detail || '-',
      payload.parts_needed || payload.battery_info || '-', payload.ref_plot || '-']]);
    return readAll_(ss);
  });
}

function transferBattery(payload) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assetSheet = ss.getSheetByName(SH.ASSET);
    const logSheet = ss.getSheetByName(SH.ALOG);
    const actDate = payload.swap_date || getTodayStr();
    const aData = assetSheet.getDataRange().getDisplayValues();
    const setBat = (row, vals) => { const rg = assetSheet.getRange(row, 7, 1, 3); rg.setNumberFormat('@'); rg.setValues([vals]); };
    let batName = payload.new_bat_name || 'แบตลูกใหม่';
    const t = Date.now();

    if (payload.mode === 'swap') {
      let fromBat = '';
      for (let i = 1; i < aData.length; i++) {
        if (aData[i][2] === payload.from_vehicle) {
          fromBat = aData[i][6];
          if (!fromBat || fromBat.includes('ไม่มีแบต')) fromBat = `แบตเดิมของ ${payload.from_vehicle}`;
          setBat(i + 1, [`⚠️ ไม่มีแบต (ถอดไปใส่ ${payload.to_vehicle})`, actDate, actDate]);
          break;
        }
      }
      batName = payload.custom_bat_label ? `${payload.custom_bat_label} (ย้ายจาก ${payload.from_vehicle})` : `${fromBat} (ย้ายจาก ${payload.from_vehicle})`;
      for (let i = 1; i < aData.length; i++) {
        if (aData[i][2] === payload.to_vehicle) { setBat(i + 1, [batName, actDate, actDate]); break; }
      }
      appendRows_(logSheet, [
        ['BL' + t + '_1', actDate, payload.from_vehicle, 'Battery', '🔄 ถอดแบตออก', `ถอดแบตไปใส่ให้ ${payload.to_vehicle} (${payload.remark || '-'})`, fromBat, '-'],
        ['BL' + t + '_2', actDate, payload.to_vehicle, 'Battery', '🔋 รับแบตสลับมาใส่', `นำแบตมาจาก ${payload.from_vehicle} (${payload.remark || '-'})`, batName, '-']
      ]);
    } else {
      for (let i = 1; i < aData.length; i++) {
        if (aData[i][2] === payload.to_vehicle) { setBat(i + 1, [batName, actDate, actDate]); break; }
      }
      appendRows_(logSheet, [['BL' + t, actDate, payload.to_vehicle, 'Battery', '🆕 เปลี่ยน/ตั้งค่าแบต', payload.remark || 'ติดตั้งแบตเตอรี่', batName, '-']]);
    }
    return readAll_(ss);
  });
}

function isDownEvt_(e) { return /เสีย|จอด|ป่วย/.test(e) && !/ซ่อมเสร็จ/.test(e); }
function isUpEvt_(e) { return /พร้อมใช้|ปกติ|ซ่อมเสร็จ/.test(e); }

// วันที่เริ่มเสีย/จอด/ป่วย ของแต่ละคัน (ที่ยังไม่หาย)
function downSinceMap_(alogs) {
  const m = {};
  sortDesc_(alogs).reverse().forEach(l => {
    const e = l.event_type || '';
    if (isDownEvt_(e)) { if (!m[l.asset_name]) m[l.asset_name] = l.timestamp; }
    else if (isUpEvt_(e)) delete m[l.asset_name];
  });
  return m;
}

// ======================= ตั้งค่า + แจ้งเตือน LINE =======================
function saveSettings(obj) {
  return withLock_(() => {
    ensureSetup_(false);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SH.SET);
    const d = sh.getDataRange().getDisplayValues();
    const allowed = DEFAULT_SETTINGS.map(r => r[0]).filter(k => k !== 'LAST_NOTIFY');
    const col = d.slice(1).map(r => [r[1]]);
    Object.keys(obj || {}).forEach(k => {
      if (!allowed.includes(k)) return;
      const v = String(obj[k] === undefined ? '' : obj[k]).trim();
      if (k === 'LINE_CHANNEL_TOKEN' && !v) return; // เว้นว่าง = ใช้โทเคนเดิม
      const i = d.findIndex((r, j) => j > 0 && r[0] === k);
      if (i > 0) col[i - 1] = [v];
    });
    if (col.length) { const rg = sh.getRange(2, 2, col.length, 1); rg.setNumberFormat('@'); rg.setValues(col); }
    const s = getSettings_(ss);
    if (s.NOTIFY_ENABLED === 'เปิด') installNotifyTriggers_(s); else removeNotifyTriggers_();
    return readAll_(ss);
  });
}

function parseTime_(t) {
  const m = String(t || '').match(/(\d{1,2})[:.](\d{2})/);
  return m ? [Math.min(23, +m[1]), Math.min(59, +m[2])] : [4, 0];
}

// ตัวตั้งเวลาหลักทำงานก่อนเวลาส่ง ~2 ชม. แล้วสร้างตัวตั้งเวลาครั้งเดียวที่เวลาตรงเป๊ะ
function installNotifyTriggers_(s) {
  removeNotifyTriggers_();
  const [h] = parseTime_(s.NOTIFY_TIME);
  ScriptApp.newTrigger('dailyScheduler').timeBased().everyDays(1).atHour((h + 22) % 24).create();
  scheduleExactNotify_(s);
}

function removeNotifyTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    const f = t.getHandlerFunction();
    if (f === 'dailyScheduler' || f === 'sendMorningBrief') ScriptApp.deleteTrigger(t);
  });
}

function dailyScheduler() {
  scheduleExactNotify_(getSettings_(SpreadsheetApp.getActiveSpreadsheet()));
}

function scheduleExactNotify_(s) {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'sendMorningBrief') ScriptApp.deleteTrigger(t); });
  if (s.NOTIFY_ENABLED !== 'เปิด') return;
  const [h, m] = parseTime_(s.NOTIFY_TIME);
  const at = new Date(); at.setHours(h, m, 0, 0);
  if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
  ScriptApp.newTrigger('sendMorningBrief').timeBased().at(at).create();
}

function sendMorningBrief() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = getSettings_(ss);
  const today = getTodayStr();
  if (s.NOTIFY_ENABLED !== 'เปิด' || s.LAST_NOTIFY === today) return;
  const res = sendLine_(s, buildBrief_(ss, s));
  if (res.ok) setSetting_(ss, 'LAST_NOTIFY', today);
  else console.error(res.msg);
}

// ปุ่ม "ดูตัวอย่าง" ในแอป (ไม่ส่ง ไม่เสียโควตา)
function previewBrief() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return buildBrief_(ss, getSettings_(ss));
}

// ปุ่ม "ส่งทดสอบ" ในแอป
function testNotify() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = getSettings_(ss);
  return sendLine_(s, '🧪 ทดสอบระบบ\n\n' + buildBrief_(ss, s));
}

function sendLine_(s, text) {
  if (!s.LINE_CHANNEL_TOKEN) return { ok: false, msg: 'ยังไม่ได้ใส่ Channel access token' };
  const target = (s.LINE_TARGET_ID || '').trim();
  const url = target ? 'https://api.line.me/v2/bot/message/push' : 'https://api.line.me/v2/bot/message/broadcast';
  const body = { messages: [{ type: 'text', text: text.slice(0, 4900) }] };
  if (target) body.to = target;
  const r = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + s.LINE_CHANNEL_TOKEN },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  const code = r.getResponseCode();
  return { ok: code === 200, msg: code === 200 ? 'ส่งเข้า LINE สำเร็จ' : `LINE ตอบกลับ ${code}: ${r.getContentText().slice(0, 200)}` };
}

function thaiDate_(d) {
  const D = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${D[d.getDay()]} ${d.getDate()} ${M[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`;
}

function fmtStock_(it) {
  const q = Number(it.stock) || 0, pack = Number(it.pack_size) || 1, pt = Number(it.per_tank) || 0;
  let s = pack > 1 ? `${Math.round(q / pack * 10) / 10} ${it.pack_name || it.unit}` : `${q} ${it.unit}`;
  if (pt > 0) s += ` (≈${Math.max(0, Math.floor(q / pt))} ถัง)`;
  return s;
}

function buildBrief_(ss, s) {
  const plots = readSheet_(ss, SH.PLOTS);
  const acts = sortDesc_(readSheet_(ss, SH.ACT));
  const assets = readSheet_(ss, SH.ASSET);
  const alogs = readSheet_(ss, SH.ALOG);
  const inv = readSheet_(ss, SH.INV, true);
  const wNew = +s.WATER_DAYS_NEW || 12, wRat = +s.WATER_DAYS_RATOON || 15;
  const sMin = +s.SPRAY_DAY_MIN || 3, sMax = +s.SPRAY_DAY_MAX || 5;

  const water = [], spray = [], soon = [], ongoing = [], flow = [], busy = new Set();
  // ขั้นตอนจาก 📋 (ชีต Flow): งานถึงคิวรายแปลง · ฉีดยาคุมเตือนเฉพาะเมื่อถึงช่วงฉีดตามขั้นตอน (เดิมเตือนทุกรอบน้ำ)
  const steps = flowSteps_(ss), logsBy = {}, today = flowDay_(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy'));
  acts.forEach(a => { (logsBy[a.plot_id] = logsBy[a.plot_id] || []).push(a); });
  plots.forEach(p => {
    const note = p.status_note || '';
    const name = `${p.plot_id} ${p.plot_name}`;
    if (note.includes('[กำลังทำ]')) {
      ongoing.push(`• ${name}: ${note.replace('[กำลังทำ]', '').split('|')[0].trim()} (${(note.split('|')[1] || '').trim().split(' ').slice(0, 2).join(' ')})`);
      const l = acts.find(a => a.plot_id === p.plot_id && (a.remark || '').includes('[⏳กำลังทำ]'));
      if (l) (l.equipment || '').split(',').forEach(e => { e = e.trim(); if (e && e !== '-') busy.add(e); });
      return;
    }
    let due = [];
    try { due = flowDue_(p, logsBy[p.plot_id] || [], steps, today); } catch (e) {}
    const sprayDue = due.some(x => x.g.includes('ฉีดยา'));
    const w = daysSince_(p.last_water_date), damp = w !== null && w >= sMin && w <= sMax;
    const fl = due.filter(x => !(damp && x.g.includes('ฉีดยา')));
    if (fl.length) flow.push(`• ${name}: ${fl.map(x => x.n).join(', ')}`);
    if (note.includes('✅ ตัดอ้อย')) return;
    if (w === null) return;
    const lim = p.cane_type === 'อ้อยใหม่' ? wNew : wRat;
    if (w >= lim) water.push(`• ${name} (${p.area_rai} ไร่) ขาดน้ำ ${w} วัน`);
    else if (damp && sprayDue) spray.push(`• ${name} หลังน้ำ ${w} วัน`);
    else if (lim - w <= 2) soon.push(`• ${name} อีก ${lim - w} วัน`);
  });

  const dm = downSinceMap_(alogs);
  const icon = { Pump: '🐍', Truck: '🚛', Tractor: '🚜' };
  const isOk = a => a.status === 'พร้อมใช้' || a.status === 'ปกติ';
  const broken = [], sick = [], noBat = [];
  assets.forEach(a => {
    if (a.category === 'Worker') {
      if (!isOk(a)) sick.push(`• ${a.name}: ${a.issue_detail !== '-' ? a.issue_detail : a.status}`);
      return;
    }
    if (!isOk(a)) {
      const dd = dm[a.name] ? daysSince_(dm[a.name]) : null;
      broken.push(`• ${icon[a.category] || '🔧'} ${a.name}: ${a.issue_detail !== '-' ? a.issue_detail : a.status}${dd !== null ? ` (${dd} วัน)` : ''}${a.parts_needed && a.parts_needed !== '-' ? ` → ${a.parts_needed}` : ''}`);
    }
    if ((a.battery_info || '').includes('ไม่มีแบต')) noBat.push(`• ${a.name}`);
  });

  const low = inv.filter(it => (Number(it.reorder_point) || 0) > 0 && (Number(it.stock) || 0) <= Number(it.reorder_point))
    .map(it => `• ${it.name} เหลือ ${fmtStock_(it)}`);

  const avail = ['Pump', 'Truck', 'Tractor'].map(cat => {
    const list = assets.filter(a => a.category === cat);
    if (!list.length) return '';
    const free = list.filter(a => isOk(a) && !busy.has(a.name)).length;
    return `${icon[cat]} ${free}/${list.length}`;
  }).filter(Boolean).join(' | ');

  const sec = (title, arr) => arr.length ? `\n${title} (${arr.length})\n${arr.join('\n')}\n` : '';
  let msg = `🌾 สรุปไร่อ้อย ${thaiDate_(new Date())}\n`;
  msg += sec('💧 ถึงคิวขึ้นน้ำ', water);
  msg += sec('📋 ถึงคิวตามขั้นตอน', flow);
  msg += sec('🔫 ดินหมาด ฉีดยาคุมได้', spray);
  msg += sec('📅 ใกล้ถึงรอบน้ำ', soon);
  msg += sec('⏳ งานค้าง', ongoing);
  msg += sec('🔧 รถ/พญานาคเสีย', broken);
  msg += sec('🤒 คนงานลา/ป่วย', sick);
  msg += sec('🔋 รถไม่มีแบต', noBat);
  msg += sec('📦 ของใกล้หมด', low);
  try { msg += sec('🪪 ต่อภาษี/ทะเบียน (ต่อล่วงหน้าได้ 90 วัน)', regBrief_(assets)); } catch (e) {}
  try { msg += wxBrief_(ss); } catch (e) {}
  try { msg += sugarBrief_(); } catch (e) {}
  if (!water.length && !spray.length && !flow.length && !ongoing.length && !broken.length) msg += '\n✅ วันนี้ไม่มีคิวด่วน\n';
  if (avail) msg += `\nพร้อมใช้: ${avail}`;
  return msg.trim();
}


function authorizeFetch() {
  UrlFetchApp.fetch('https://www.google.com');
}

// ======================= อ่านบิลด้วย Gemini =======================
// รหัสอยู่ใน Script Properties: GEMINI_KEY (ห้ามใส่ในโค้ด/GitHub)  รุ่นเปลี่ยนได้ที่ GEMINI_MODEL
function geminiKey_() {
  const k = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  if (!k) throw new Error('ยังไม่ได้ใส่ GEMINI_KEY ในพร็อพเพอร์ตี้ของสคริปต์');
  return k.trim();
}

// เช็กว่ารหัสใช้ได้ + รุ่นที่อ่านรูปได้ (ไม่คืนรหัส)
function billAiModels() {
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': geminiKey_() }, muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code !== 200) return { ok: false, code: code, error: res.getContentText().slice(0, 300) };
  const j = JSON.parse(res.getContentText());
  return {
    ok: true,
    current: PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || '',
    models: (j.models || []).filter(m => (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1)
      .map(m => m.name.replace('models/', ''))
  };
}

const BILL_CATS_ = ['อะไหล่', 'น้ำมัน', 'ปุ๋ย', 'ยา', 'ค่าแรง', 'อื่นๆ'];
const EXP_HEADERS_ = ['exp_id', 'timestamp', 'bill_id', 'shop', 'category', 'item', 'qty', 'unit', 'amount',
  'asset', 'stock_item', 'stock_qty', 'photo_id', 'note', 'created_at'];

// รันครั้งเดียวในหน้า Apps Script เพื่อกดอนุญาตสิทธิ์ Drive (เก็บรูปบิล)
function authorizeBillDrive() {
  const f = billFolder_();
  Logger.log('✅ ใช้ Drive ได้แล้ว โฟลเดอร์: ' + f.getName() + ' ' + f.getUrl());
  return f.getUrl();
}

function billFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('BILL_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('บิลไร่อ้อย');
  props.setProperty('BILL_FOLDER_ID', f.getId());
  return f;
}

var geminiUsed_ = '';
function geminiCall_(parts, what) {
  const props = PropertiesService.getScriptProperties();
  // อ่านบิลไม่ต้องคิดนาน: ปิด thinking ให้เร็ว (รุ่น 2.5 ใช้ thinkingBudget, รุ่น 3 ขึ้นไปใช้ thinkingLevel)
  // ทดสอบ 1 พ.ย. 69: 2.5 เลิกให้บัญชีใหม่ใช้แล้ว, flash-latest ช้ามาก (นาทีกว่า), 3.5-flash + minimal ~1 วิ
  const models = [props.getProperty('GEMINI_MODEL') || 'gemini-3.5-flash', 'gemini-3.5-flash-lite']
    .filter((m, i, a) => m && a.indexOf(m) === i);
  const think = m => /2\.5/.test(m) ? { thinkingBudget: 0 } : { thinkingLevel: 'minimal' };
  let last = '';
  // รุ่นหลักลอง 2 ครั้ง (ถ้าติดโควตา/คนใช้เยอะ) แล้วค่อยใช้รุ่นสำรอง
  const tries = [];
  models.forEach(m => { tries.push(m); tries.push(m); }); // แต่ละรุ่นลอง 2 ครั้ง (503 คนใช้เยอะ มักหายในไม่กี่วิ)
  for (let i = 0; i < tries.length; i++) {
    if (i > 0) Utilities.sleep(i === 1 ? 1500 : 2500);
    const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + tries[i] + ':generateContent', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': geminiKey_() },
      payload: JSON.stringify({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', thinkingConfig: think(tries[i]) }
      })
    });
    const code = res.getResponseCode(), txt = res.getContentText();
    if (code === 200) {
      geminiUsed_ = tries[i];
      const j = JSON.parse(txt);
      const out = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      return out.map(p => p.text || '').join('');
    }
    last = code + ' ' + txt.slice(0, 200);
    if (i % 2 === 0 && code !== 429 && code < 500) i++; // ผิดแบบถาวร (เช่น 400/404) ไม่ต้องลองซ้ำรุ่นเดิม
  }
  if (/^(429|5\d\d)/.test(last)) throw new Error('Gemini ไม่ว่าง (คนใช้เยอะ) รอสักครู่แล้วกดส่งใหม่');
  throw new Error((what || 'อ่านบิล') + 'ไม่ได้ (Gemini ' + last.slice(0, 80) + ')');
}

// อ่านรูปบิล → เก็บรูปใน Drive + ให้ Gemini แยกรายการ (ยังไม่บันทึก รอผู้ใช้ตรวจก่อน)
// images = b64 เดียว หรือ array ของหน้าบิลเดียวกัน (หลายหน้า) / opts.photo_ids = รูปที่เก็บไปแล้ว (หน้าแรก ๆ) ไม่ต้องเก็บซ้ำ
function readBill(images, mime, opts) {
  const pages = (Array.isArray(images) ? images : [images]).filter(Boolean);
  if (!pages.length) throw new Error('ไม่มีรูป');
  mime = mime || 'image/jpeg';
  opts = opts || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inv = readSheet_(ss, SH.INV).map(i => `- ${i.name} [${i.category}] หน่วยย่อย ${i.unit}` +
    (Number(i.pack_size) > 1 ? ` (1 ${i.pack_name} = ${i.pack_size} ${i.unit})` : ''));
  const assets = readSheet_(ss, SH.ASSET).filter(a => a.category !== 'Worker' && a.category !== 'Home').map(a => `- ${a.name}`);
  const today = getTodayStr();
  const shops = readSheet_(ss, 'Expenses').map(e => e.shop).filter((x, i, a) => x && x !== '-' && a.indexOf(x) === i);
  const aliases = billAliases_(ss);

  try { if (!(opts.photo_ids || []).length) cleanBillPhotos(24 * 60); } catch (e) {}
  const t0 = Date.now();
  const ids = (opts.photo_ids || []).slice();
  const folder = billFolder_();
  for (let i = ids.length; i < pages.length; i++) {
    ids.push(folder.createFile(Utilities.newBlob(Utilities.base64Decode(pages[i]), mime,
      'บิล_' + today.replace(/\//g, '-') + '_' + Date.now() + '_' + (i + 1) + (mime === 'image/png' ? '.png' : '.jpg'))).getId());
  }
  const photoIds = ids.join(',');

  const prompt = `คุณอ่านบิล/ใบเสร็จของไร่อ้อยในประเทศไทย ส่วนใหญ่เป็นบิลเงินสดเขียนมือภาษาไทย ตอบเป็น JSON อย่างเดียว:
{"date":"dd/mm/yyyy พ.ศ.","shop":"ชื่อร้าน","vehicle":"รถ/เครื่องที่บิลระบุ หรือ \"\"","total":ยอดรวมที่เขียนในบิล,"items":[{"item":"ชื่อสินค้า","category":"หมวด","qty":ตัวเลข,"unit":"หน่วยในบิล","amount":เงินของบรรทัดเป็นบาท,"stock_item":"","stock_qty":0,"asset":""}]}
${pages.length > 1 ? `- รูปทั้ง ${pages.length} รูปคือบิลใบเดียวกันหลายหน้า (ดูเลขที่ มุมขวาบน) ให้รวมรายการทุกหน้าตามลำดับ ยอดรวมท้ายบิลมักอยู่หน้าสุดท้ายและเป็นยอดของทุกหน้ารวมกัน
` : ''}วิธีอ่านลายมือ:
- คอลัมน์: จำนวน | รายการ | หน่วยละ | จำนวนเงิน — amount เอาจากคอลัมน์จำนวนเงิน (ขวาสุด) ไม่ใช่หน่วยละ
- ถ้ามีหน่วยละ ใช้ จำนวน × หน่วยละ เช็กว่าตรงกับจำนวนเงิน
- ผลรวม amount ทุกบรรทัดควรเท่ากับยอดรวมในบิล ถ้าไม่เท่า ให้อ่านตัวเลขแต่ละบรรทัดใหม่อย่างระวัง (เลข 0/6/9, 1/7, 4/9 เขียนมือคล้ายกัน)
- คำย่อ/สะกดผิดที่พบบ่อย: 2ที/2T/ทูที/ไฮสปีด 2ที = น้ำมันเครื่อง 2 จังหวะ (ออโต้ลูป), แท้ = อะไหล่แท้, คลัทช์/ครัช, ลูกปืน, ซีล, โอริง, กรองโซล่า, กรองดักน้ำ, กรองไฮดรอลิค, กรองอากาศ, กรองน้ำมันเครื่อง, ไฟวีล = ฟลายวีล, ดุมล้อ, น้ำมันเกียร์, น้ำมันเบรก, ค่าแรง
- ชื่อสินค้าให้เขียนเป็นคำที่ถูกต้องอ่านง่าย (ไม่ต้องลอกตัวสะกดผิดในบิล) เลขรุ่นอะไหล่ (เช่น 29685 KOYO) ใส่ต่อท้ายชื่อ
- ชื่อร้าน (shop): มาจากหัวบิล/ตราประทับร้าน ช่อง "นาม/CUSTOMER" และ "ที่อยู่/ADDRESS" คือผู้ซื้อ (เจ้าของไร่) ไม่ใช่ร้าน ห้ามเอามาใส่ shop
  ร้านที่เคยซื้อ: ${shops.join(', ') || '-'} ถ้าไม่มีชื่อร้านในบิลใส่ ""
- วันที่: ปี 2 หลักคือ พ.ศ. 25xx (เช่น 68 = 2568) ปีที่เป็น ค.ศ. ให้ +543 ถ้าไม่มีวันที่ใส่ "${today}"
หมวด category เลือกจาก: ${BILL_CATS_.join(', ')}
- อะไหล่/ค่าเจียร/ค่ากลึง = อะไหล่, ค่าแรง/ค่าช่าง = ค่าแรง, ยาฆ่าหญ้า/ยาฉีด = ยา, ดีเซล/เบนซิน/น้ำมันเครื่อง/ไฮดรอลิก/น้ำมันเกียร์/น้ำมันเบรก = น้ำมัน
รถ/เครื่อง (asset):
- ถ้าหัวบิล (ช่องชื่อ/ที่อยู่) หรือรายการระบุรถ เช่น "TS-6020" = New Holland TS6020, "B2420" = Kubota B2420 ให้ใส่ vehicle และใส่ asset ให้ทุกบรรทัดที่เป็นอะไหล่ น้ำมันที่เติมตอนซ่อม และค่าแรงของรถคันนั้น ชื่อ asset ต้องตรงกับรายการด้านล่างทุกตัวอักษร
- ไม่ชัดใส่ ""
สต็อก (stock_item / stock_qty):
- ใส่เฉพาะของที่ซื้อมาเก็บไว้ใช้เอง และตรงกับรายการสต็อกด้านล่าง (ชื่อตรงทุกตัวอักษร) stock_qty แปลงเป็นหน่วยย่อยของรายการนั้น (เช่น ไซทรอน 1 ลิตร × 2 = 2000 ml)
- ถ้าเป็นบิลซ่อมรถที่มีค่าแรง/ระบุรถ น้ำมันในบิลถือว่าเติมใส่รถไปแล้ว ไม่ต้องรับเข้าสต็อก (stock_item "")
- ส่วนลด/ลดราคา: แยกเป็น 1 บรรทัด item "ส่วนลด" (ใส่รายละเอียดต่อท้ายได้ เช่น "ส่วนลด ตันละ 100") amount เป็นลบ qty 0 unit ""
- ปุ๋ย: qty/unit ใช้จำนวนกระสอบเป็นหลัก (1 ตัน = 20 กระสอบ 50 กก.) ถ้าบิลเขียนเป็นตัน ให้แปลงเป็นกระสอบ และ stock_qty เป็นกระสอบ
- อ่านไม่ออกใส่ amount 0 / ห้ามเดาจากอากาศ / ถ้าไม่ใช่บิลให้ items เป็น []
รายการสต็อก:
${inv.join('\n')}
${aliases.length ? `ชื่อในบิลที่ผู้ใช้เคยจับคู่กับสต็อกแล้ว (เจอชื่อเดียวกัน/คล้ายกันให้ใช้ตามนี้):
${aliases.slice(-60).map(a => `- "${a.bill_item}" → ${a.stock_item} (1 หน่วยในบิล = ${a.per_qty} หน่วยย่อย)`).join('\n')}` : ''}
รถ/เครื่อง:
${assets.join('\n')}`;

  let data, tAi = 0;
  try {
    const parts = [{ text: prompt }].concat(pages.map(p => ({ inline_data: { mime_type: mime, data: p } })));
    const t1 = Date.now();
    const txt = geminiCall_(parts);
    tAi = Date.now() - t1;
    data = JSON.parse(txt.replace(/^```json\s*|```\s*$/g, ''));
    if (Array.isArray(data)) data = data[0] || {};
  } catch (e) {
    return { photo_id: photoIds, pages: pages.length, error: String(e.message || e), date: today, shop: '', total: 0, items: [] };
  }
  const invNames = new Set(readSheet_(ss, SH.INV).map(i => i.name));
  const asNames = new Set(readSheet_(ss, SH.ASSET).map(a => a.name));
  const veh = asNames.has(data.vehicle) ? data.vehicle : '';
  const amap = {};
  aliases.forEach(a => { if (invNames.has(a.stock_item)) amap[a.key] = a; });
  data.items = (data.items || []).map(it => {
    // ชื่อในบิลที่เคยจับคู่ไว้ แต่ AI ไม่ได้ใส่สต็อก → ใส่ให้ตามที่จำไว้
    const al = !invNames.has(it.stock_item) && amap[billKey_(it.item)];
    if (al) { it.stock_item = al.stock_item; it.stock_qty = round_((Number(it.qty) || 1) * (Number(al.per_qty) || 0)); }
    return it;
  }).map(it => ({
    item: String(it.item || '').trim(),
    category: BILL_CATS_.indexOf(it.category) !== -1 ? it.category : 'อื่นๆ',
    qty: Number(it.qty) || 0, unit: String(it.unit || ''), amount: Number(it.amount) || 0,
    stock_item: invNames.has(it.stock_item) ? it.stock_item : '',
    stock_qty: invNames.has(it.stock_item) ? (Number(it.stock_qty) || 0) : 0,
    asset: asNames.has(it.asset) ? it.asset : (veh && it.category !== 'ปุ๋ย' && it.category !== 'ยา' ? veh : '')
  }));
  data.vehicle = veh;
  data.photo_id = photoIds;
  data.pages = pages.length;
  data.ms = { drive: Date.now() - t0 - tAi, ai: tAi, model: geminiUsed_ };
  return data;
}

// ยกเลิกบิล (ยังไม่บันทึก) → ทิ้งรูป
function discardBillPhoto(photoId) {
  String(photoId || '').split(',').map(x => x.trim()).filter(Boolean).forEach(id => {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
  });
  return true;
}

function addStock_(ss, name, qty, date, ref, note) {
  const sh = ss.getSheetByName(SH.INV);
  const d = sh.getDataRange().getValues();
  const c = invCols_(d[0]);
  const r = d.findIndex((row, i) => i > 0 && String(row[c.name]) === name);
  if (r < 1) return false;
  const nv = round_((Number(d[r][c.stock]) || 0) + Number(qty));
  sh.getRange(r + 1, c.stock + 1).setValue(nv);
  sh.getRange(r + 1, c.upd + 1).setNumberFormat('@').setValue(getTodayStr());
  appendRows_(ss.getSheetByName(SH.SLOG), [['S' + Date.now() + '_' + Math.floor(Math.random() * 1000), date, name,
    round_(Number(qty)), d[r][c.unit], ref, '-', note || '']]);
  return true;
}

// บันทึกบิลที่ผู้ใช้ตรวจแล้ว: ลงชีต Expenses + รับเข้าสต็อก + ประวัติรถ (อะไหล่)
function saveBill(b) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    writeBill_(ss, 'B' + Date.now(), b, getTodayStr(), '🧾 ซื้ออะไหล่');
    return readAll_(ss);
  });
}

// แก้บิลที่บันทึกแล้ว (หมวด/จำนวน/ราคา/รายการ/วันที่/ร้าน): ถอนผลของบิลเดิม (สต็อก, ประวัติรถ, แถวค่าใช้จ่าย)
// แล้วลงใหม่ด้วย bill_id และรูปเดิม — รูปไม่ถูกลบ
function updateBill(billId, b) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Expenses');
    if (!sh || !billId) throw new Error('ไม่พบบิล');
    const d = sh.getDataRange().getDisplayValues();
    const rows = [];
    for (let i = 1; i < d.length; i++) if (d[i][2] === billId) rows.push(i);
    if (!rows.length) throw new Error('ไม่พบบิล');
    const items = (b.items || []).filter(it => it && (it.item || Number(it.amount)));
    if (!items.length) throw new Error('ไม่มีรายการในบิล (ถ้าจะลบทั้งบิล ใช้ปุ่มลบบิล)');
    const created = d[rows[0]][14] || getTodayStr(), photo = d[rows[0]][12];
    const al = ss.getSheetByName(SH.ALOG), ad = al.getDataRange().getDisplayValues();
    let label = '🧾 ซื้ออะไหล่';
    for (let i = ad.length - 1; i >= 1; i--) if (String(ad[i][0]).indexOf(billId + '_A') === 0) { label = ad[i][4] || label; al.deleteRow(i + 1); }
    unstockBill_(ss, billId);
    for (let k = rows.length - 1; k >= 0; k--) sh.deleteRow(rows[k] + 1);
    writeBill_(ss, billId, Object.assign({}, b, { photo_id: photo }), created, label);
    return readAll_(ss);
  });
}

// คืนยอดสต็อกที่บิลนี้รับเข้า + ลบ StockLogs ของบิล
function unstockBill_(ss, billId) {
  const sl = ss.getSheetByName(SH.SLOG), sd = sl.getDataRange().getValues();
  const inv = ss.getSheetByName(SH.INV);
  for (let i = sd.length - 1; i >= 1; i--) {
    if (String(sd[i][5]) !== billId) continue;
    const id = inv.getDataRange().getValues(), c = invCols_(id[0]);
    const r = id.findIndex((row, k) => k > 0 && String(row[c.name]) === String(sd[i][2]));
    if (r > 0) inv.getRange(r + 1, c.stock + 1).setValue(round_((Number(id[r][c.stock]) || 0) - (Number(sd[i][3]) || 0)));
    sl.deleteRow(i + 1);
  }
}

// ลงแถวบิลในชีต Expenses + รับเข้าสต็อก + ประวัติรถ (ใช้ทั้งบิลใหม่และบิลที่แก้)
function writeBill_(ss, billId, b, now, assetLabel) {
  const sh = getOrCreate_(ss, 'Expenses', EXP_HEADERS_);
  const items = (b.items || []).filter(it => it && (it.item || Number(it.amount)));
  if (!items.length) throw new Error('ไม่มีรายการในบิล');
  const date = b.date || getTodayStr(), shop = String(b.shop || '').trim() || '-';
  const assetCat = {};
  readSheet_(ss, SH.ASSET).forEach(a => { assetCat[a.name] = a.category; });
  const rows = [], alog = [];
  items.forEach((it, i) => {
    const cat = BILL_CATS_.indexOf(it.category) !== -1 ? it.category : 'อื่นๆ';
    const sq = it.stock_item ? (Number(it.stock_qty) || 0) : 0;
    rows.push([billId + '_' + i, date, billId, shop, cat, it.item || '-', Number(it.qty) || '', it.unit || '',
      Number(it.amount) || 0, it.asset || '', it.stock_item || '', sq || '', b.photo_id || '', b.note || '', now]);
    if (sq > 0) addStock_(ss, it.stock_item, sq, date, billId, '🧾 บิล ' + shop);
    if (it.asset && assetCat[it.asset]) {
      alog.push([billId + '_A' + i, date, it.asset, assetCat[it.asset], assetLabel,
        `${it.item} ${Number(it.amount) || 0} บาท (${shop})`, it.item || '-', '-']);
    }
  });
  // ตัวเลข (จำนวน/เงิน/จำนวนสต็อก) เก็บเป็นตัวเลข ให้ SUM ในชีตได้ ที่เหลือเป็นข้อความกันวันที่เพี้ยน
  const rg = sh.getRange(sh.getLastRow() + 1, 1, rows.length, EXP_HEADERS_.length);
  rg.setNumberFormat('@');
  [6, 8, 11].forEach(c => sh.getRange(rg.getRow(), c + 1, rows.length, 1).setNumberFormat('#,##0.##'));
  rg.setValues(rows.map(r => r.map((v, c) => [6, 8, 11].indexOf(c) !== -1 ? (v === '' ? '' : Number(v)) : String(v === null || v === undefined ? '' : v))));
  if (alog.length) appendRows_(ss.getSheetByName(SH.ALOG), alog);
  try { learnBillAlias_(ss, items); } catch (e) {}
  nameBillPhotos_(b.photo_id, date, shop);
}

// ===== จำชื่อในบิล → รายการสต็อก (ผู้ใช้เลือกรับเข้าสต็อกครั้งเดียว รอบหน้าอ่านบิลแล้วใส่ให้เอง) =====
const ALIAS_H_ = ['key', 'bill_item', 'stock_item', 'per_qty', 'updated_at'];
function billKey_(s) { return String(s || '').toLowerCase().replace(/[\s.()\[\]\-_\/,]/g, ''); }
function billAliases_(ss) {
  const sh = ss.getSheetByName('BillAlias');
  return sh ? readSheet_(ss, 'BillAlias').filter(a => a.key && a.stock_item) : [];
}
function learnBillAlias_(ss, items) {
  const learn = (items || []).filter(it => it && it.item && it.stock_item && (Number(it.stock_qty) || 0) > 0 && billKey_(it.item) !== billKey_(it.stock_item));
  if (!learn.length) return;
  const sh = getOrCreate_(ss, 'BillAlias', ALIAS_H_);
  const d = sh.getDataRange().getDisplayValues(), at = {};
  for (let i = 1; i < d.length; i++) at[d[i][0]] = i + 1;
  learn.forEach(it => {
    const key = billKey_(it.item), per = round_((Number(it.stock_qty) || 0) / ((Number(it.qty) || 0) > 0 ? Number(it.qty) : 1));
    const row = [key, String(it.item).trim(), it.stock_item, String(per), getTodayStr()];
    if (at[key]) sh.getRange(at[key], 1, 1, row.length).setNumberFormat('@').setValues([row]);
    else { appendRows_(sh, [row]); at[key] = sh.getLastRow(); }
  });
}

// ลบบิลทั้งใบ: ลบแถวค่าใช้จ่าย, คืนสต็อกที่รับเข้า, ลบประวัติรถ, ทิ้งรูป
function deleteBill(billId) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Expenses');
    if (!sh || !billId) throw new Error('ไม่พบบิล');
    const d = sh.getDataRange().getDisplayValues();
    let photo = '';
    for (let i = d.length - 1; i >= 1; i--) if (d[i][2] === billId) { photo = photo || d[i][12]; sh.deleteRow(i + 1); }
    const sl = ss.getSheetByName(SH.SLOG), sd = sl.getDataRange().getValues();
    for (let i = sd.length - 1; i >= 1; i--) {
      if (String(sd[i][5]) !== billId) continue;
      const q = Number(sd[i][3]) || 0, name = String(sd[i][2]);
      const inv = ss.getSheetByName(SH.INV), id = inv.getDataRange().getValues(), c = invCols_(id[0]);
      const r = id.findIndex((row, k) => k > 0 && String(row[c.name]) === name);
      if (r > 0) inv.getRange(r + 1, c.stock + 1).setValue(round_((Number(id[r][c.stock]) || 0) - q));
      sl.deleteRow(i + 1);
    }
    const al = ss.getSheetByName(SH.ALOG), ad = al.getDataRange().getDisplayValues();
    for (let i = ad.length - 1; i >= 1; i--) if (String(ad[i][0]).indexOf(billId + '_A') === 0) al.deleteRow(i + 1);
    if (photo) discardBillPhoto(photo);
    return readAll_(ss);
  });
}

// ทดสอบรุ่น Gemini (ข้อความสั้น) คืนเวลา/รหัสตอบกลับ ไม่คืนรหัส API
function billAiTest(model, think) {
  const t0 = Date.now();
  const cfg = { temperature: 0 };
  if (think) cfg.thinkingConfig = think;
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-goog-api-key': geminiKey_() },
    payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ตอบคำเดียว: 2+2=?' }] }], generationConfig: cfg })
  });
  return { model: model, code: res.getResponseCode(), ms: Date.now() - t0, body: res.getContentText().slice(0, 400) };
}

// รวมบิล source เข้า target (บิลเดียวกันหลายหน้าที่บันทึกแยกไว้) → ใช้วันที่/ร้านของ target, รวมรูป,
// ย้าย StockLogs (ref) และ AssetLogs ไปเป็นของ target ด้วย (ลบบิลรวมทีหลังได้ครบ)
function mergeBills(targetId, sourceId) {
  return withLock_(() => {
    if (!targetId || !sourceId || targetId === sourceId) throw new Error('เลือกบิลไม่ถูก');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Expenses');
    const d = sh.getDataRange().getDisplayValues();
    const tRows = [], sRows = [];
    for (let i = 1; i < d.length; i++) { if (d[i][2] === targetId) tRows.push(i); if (d[i][2] === sourceId) sRows.push(i); }
    if (!tRows.length || !sRows.length) throw new Error('ไม่พบบิล');
    const t0 = d[tRows[0]], date = t0[1], shop = t0[3];
    const photos = [t0[12], d[sRows[0]][12]].join(',').split(',').map(x => x.trim()).filter((x, i, a) => x && a.indexOf(x) === i).join(',');
    const txt = (r, c, v) => sh.getRange(r + 1, c + 1).setNumberFormat('@').setValue(v);
    tRows.forEach(r => txt(r, 12, photos));
    nameBillPhotos_(photos, date, shop);
    sRows.forEach((r, k) => {
      txt(r, 0, targetId + '_' + (tRows.length + k)); txt(r, 1, date); txt(r, 2, targetId); txt(r, 3, shop); txt(r, 12, photos);
    });
    const sl = ss.getSheetByName(SH.SLOG), sd = sl.getDataRange().getDisplayValues();
    for (let i = 1; i < sd.length; i++) if (sd[i][5] === sourceId) {
      sl.getRange(i + 1, 2).setNumberFormat('@').setValue(date); sl.getRange(i + 1, 6).setNumberFormat('@').setValue(targetId);
    }
    const al = ss.getSheetByName(SH.ALOG), ad = al.getDataRange().getDisplayValues();
    let n = ad.filter(r => String(r[0]).indexOf(targetId + '_A') === 0).length + 100;
    for (let i = 1; i < ad.length; i++) if (String(ad[i][0]).indexOf(sourceId + '_A') === 0) {
      al.getRange(i + 1, 1, 1, 2).setNumberFormat('@').setValues([[targetId + '_A' + (n++), date]]);
    }
    return readAll_(ss);
  });
}

// ทั้งบิลเป็นของรถคันเดียว (บิลซ่อม): ใส่ asset ทุกรายการ + ลงประวัติรถที่ยังขาด
// noStock=true → เอารายการออกจากสต็อก (คืนยอดที่รับเข้า) เพราะใช้ไปกับการซ่อมแล้ว
function setBillAsset(billId, asset, noStock) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Expenses');
    const d = sh.getDataRange().getDisplayValues();
    const rows = [];
    for (let i = 1; i < d.length; i++) if (d[i][2] === billId) rows.push(i);
    if (!rows.length) throw new Error('ไม่พบบิล');
    const cat = {};
    readSheet_(ss, SH.ASSET).forEach(a => { cat[a.name] = a.category; });
    if (asset && !cat[asset]) throw new Error('ไม่พบรถ/เครื่อง ' + asset);
    const al = ss.getSheetByName(SH.ALOG), ad = al.getDataRange().getDisplayValues();
    // ลบประวัติรถเดิมของบิลนี้ แล้วลงใหม่ให้ครบตรงกับรถที่เลือก
    for (let i = ad.length - 1; i >= 1; i--) if (String(ad[i][0]).indexOf(billId + '_A') === 0) al.deleteRow(i + 1);
    const logs = [];
    rows.forEach((r, k) => {
      const row = d[r];
      sh.getRange(r + 1, 10).setNumberFormat('@').setValue(asset || '');
      if (noStock) { sh.getRange(r + 1, 11).setValue(''); sh.getRange(r + 1, 12).setValue(''); }
      if (asset) logs.push([billId + '_A' + k, row[1], asset, cat[asset], '🧾 ซ่อม/อะไหล่',
        `${row[5]} ${Number(String(row[8]).replace(/,/g, '')) || 0} บาท (${row[3]})`, row[5], '-']);
    });
    if (logs.length) appendRows_(al, logs);
    if (noStock) {
      const sl = ss.getSheetByName(SH.SLOG), sd = sl.getDataRange().getValues();
      const inv = ss.getSheetByName(SH.INV);
      for (let i = sd.length - 1; i >= 1; i--) {
        if (String(sd[i][5]) !== billId) continue;
        const id = inv.getDataRange().getValues(), c = invCols_(id[0]);
        const r = id.findIndex((row, k) => k > 0 && String(row[c.name]) === String(sd[i][2]));
        if (r > 0) inv.getRange(r + 1, c.stock + 1).setValue(round_((Number(id[r][c.stock]) || 0) - (Number(sd[i][3]) || 0)));
        sl.deleteRow(i + 1);
      }
    }
    return readAll_(ss);
  });
}

// ตั้งชื่อรูปบิลให้อ่านง่าย: บิล_21-10-2568_ช่างวิท_หน้า1.jpg
function nameBillPhotos_(photoIds, date, shop) {
  const ids = String(photoIds || '').split(',').map(x => x.trim()).filter(Boolean);
  const base = 'บิล_' + String(date || '').replace(/\//g, '-') + '_' + String(shop || '-').replace(/[\\/:*?"<>|]/g, '').slice(0, 30);
  ids.forEach((id, k) => {
    try { DriveApp.getFileById(id).setName(base + (ids.length > 1 ? '_หน้า' + (k + 1) : '') + '.jpg'); } catch (e) {}
  });
}

// ทิ้งรูปในโฟลเดอร์บิลที่ไม่ได้อยู่ในบิลไหนเลย (อ่านแล้วไม่ได้บันทึก) และเก่ากว่า maxAgeMin นาที
function cleanBillPhotos(maxAgeMin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const used = new Set();
  readSheet_(ss, 'Expenses').forEach(e => String(e.photo_id || '').split(',').forEach(id => { if (id.trim()) used.add(id.trim()); }));
  const limit = Date.now() - (Number(maxAgeMin) || 60) * 60000;
  const it = billFolder_().getFiles();
  let n = 0;
  while (it.hasNext()) {
    const f = it.next();
    if (used.has(f.getId()) || f.getDateCreated().getTime() > limit) continue;
    f.setTrashed(true); n++;
  }
  return n;
}

function renameAllBillPhotos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), seen = {};
  readSheet_(ss, 'Expenses').forEach(e => { if (!seen[e.bill_id]) { seen[e.bill_id] = 1; nameBillPhotos_(e.photo_id, e.timestamp, e.shop); } });
  return Object.keys(seen).length;
}

// ของในบิลใช้หมดแล้ว (เช่นบิลเก่า): เอาออกจากสต็อก คืนยอดที่รับเข้า ค่าใช้จ่ายยังอยู่
function billUnstock(billId) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Expenses');
    const d = sh.getDataRange().getDisplayValues();
    let found = false;
    for (let i = 1; i < d.length; i++) if (d[i][2] === billId) {
      found = true; sh.getRange(i + 1, 11).setValue(''); sh.getRange(i + 1, 12).setValue('');
    }
    if (!found) throw new Error('ไม่พบบิล');
    const sl = ss.getSheetByName(SH.SLOG), sd = sl.getDataRange().getValues(), inv = ss.getSheetByName(SH.INV);
    for (let i = sd.length - 1; i >= 1; i--) {
      if (String(sd[i][5]) !== billId) continue;
      const id = inv.getDataRange().getValues(), c = invCols_(id[0]);
      const r = id.findIndex((row, k) => k > 0 && String(row[c.name]) === String(sd[i][2]));
      if (r > 0) inv.getRange(r + 1, c.stock + 1).setValue(round_((Number(id[r][c.stock]) || 0) - (Number(sd[i][3]) || 0)));
      sl.deleteRow(i + 1);
    }
    return readAll_(ss);
  });
}


// ======================= ฝากดู =======================
// แปลงที่ต้องไปดู/ทำ (อ้อยไม่สวย ต้องขึ้นน้ำ, น้ำท่วมขังต้องสูบออก ฯลฯ) ขึ้นหน้า "วันนี้" จนกว่าจะบันทึกงานนั้นหรือกดเสร็จ
const WATCH_HEADERS_ = ['watch_id', 'created', 'plot_id', 'reason', 'note', 'status', 'done_at', 'done_ref'];
// เหตุผล → งานที่ปิดฝากดูได้ (กลุ่มงาน, คำในรายละเอียดที่ต้องมี)
const WATCH_CLOSE_ = {
  'ขึ้นน้ำ': [['ขึ้นน้ำ', ''], ['ฝนตก', '']],
  'หว่านปุ๋ย': [['ใส่ปุ๋ย', ''], ['รถไถเตรียมดิน/บำรุง', 'ฝังปุ๋ย']],
  'ฉีดยา': [['ฉีดยา', '']],
  'น้ำขัง สูบออก': [['ขึ้นน้ำ', 'สูบน้ำขัง'], ['ใส่ปุ๋ย', 'ระบายน้ำ']]
};

function addWatch(plotIds, reason, note) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = getOrCreate_(ss, 'Watch', WATCH_HEADERS_);
    const ids = (plotIds || []).filter(Boolean);
    if (!ids.length) throw new Error('ยังไม่ได้เลือกแปลง');
    const r = String(reason || '').trim() || 'ไปดูอาการ';
    const base = Date.now(), today = getTodayStr();
    appendRows_(sh, ids.map((pid, i) => ['W' + base + '_' + i, today, pid, r, String(note || '').trim(), 'open', '', '']));
    return readAll_(ss);
  });
}

function closeWatch(watchId, ref) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Watch');
    if (!sh) throw new Error('ไม่พบรายการฝากดู');
    const d = sh.getDataRange().getDisplayValues();
    for (let i = 1; i < d.length; i++) if (d[i][0] === watchId) {
      sh.getRange(i + 1, 6, 1, 3).setNumberFormat('@').setValues([['done', getTodayStr(), ref || 'กดเสร็จเอง']]);
    }
    return readAll_(ss);
  });
}

// ยกเลิกฝากดู (ลงผิด/ทดลอง/ไม่ต้องดูแล้ว) = ลบแถวทิ้ง ไม่เก็บเป็นประวัติ "ดูแล้ว"
function cancelWatch(watchId) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    deleteWatch_(ss, watchId);
    return readAll_(ss);
  });
}
function deleteWatch_(ss, watchId) {
  const sh = ss.getSheetByName('Watch');
  if (!sh || sh.getLastRow() < 2) return false;
  const d = sh.getRange(1, 1, sh.getLastRow(), 1).getDisplayValues();
  for (let i = d.length - 1; i >= 1; i--) if (d[i][0] === String(watchId)) { sh.deleteRow(i + 1); return true; }
  return false;
}

function closeWatchesFor_(ss, plotIds, group, detail, logId) {
  const sh = ss.getSheetByName('Watch');
  if (!sh) return;
  const d = sh.getDataRange().getDisplayValues(), want = new Set(plotIds || []);
  for (let i = 1; i < d.length; i++) {
    if (d[i][5] !== 'open' || !want.has(d[i][2])) continue;
    const rules = WATCH_CLOSE_[d[i][3]];
    if (!rules) continue; // ไปดูอาการ / อื่น ๆ → ปิดเองเท่านั้น
    if (rules.some(([g, kw]) => g === group && (!kw || String(detail).indexOf(kw) !== -1))) {
      sh.getRange(i + 1, 6, 1, 3).setNumberFormat('@').setValues([['done', getTodayStr(), logId]]);
    }
  }
}

// เปลี่ยนชื่อรถ/เครื่อง/คนงาน: ชื่อใช้เป็นตัวเชื่อมทุกชีต → แก้ MasterOptions, Assets (+ แบตติดรถ), AssetLogs, Activities.equipment/operator
function renameAsset(oldN, newN) {
  oldN = String(oldN || '').trim(); newN = String(newN || '').trim();
  if (!oldN || !newN || oldN === newN) throw new Error('ชื่อไม่ถูกต้อง');
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aSh = ss.getSheetByName(SH.ASSET), ad = aSh.getDataRange().getDisplayValues();
    if (ad.some((r, i) => i && r[2] === newN)) throw new Error('มีชื่อ "' + newN + '" อยู่แล้ว');
    let cat = '';
    for (let i = 1; i < ad.length; i++) if (ad[i][2] === oldN) {
      cat = ad[i][1]; aSh.getRange(i + 1, 3).setNumberFormat('@').setValue(newN);
      if (ad[i][6] && ad[i][6].includes('(' + oldN + ')')) aSh.getRange(i + 1, 7).setValue(ad[i][6].split('(' + oldN + ')').join('(' + newN + ')'));
    }
    if (!cat) throw new Error('ไม่พบ "' + oldN + '"');
    const oSh = ss.getSheetByName(SH.OPT), od = oSh.getDataRange().getDisplayValues(), oc = od[0].indexOf(cat);
    if (oc >= 0) for (let r = 1; r < od.length; r++) if (od[r][oc] === oldN) oSh.getRange(r + 1, oc + 1).setNumberFormat('@').setValue(newN);
    // แก้ทั้งคอลัมน์ทีเดียว (ชื่อในรายการคั่นด้วย , ให้ตรงทั้งคำ)
    const fixCol = (sh, col) => {
      if (!sh) return; const c = headCol_(sh, col), n = sh.getLastRow() - 1; if (n < 1) return;
      const rg = sh.getRange(2, c, n, 1), v = rg.getDisplayValues(); let ch = false;
      const out = v.map(([x]) => {
        if (!x || x.indexOf(oldN) < 0) return [x];
        const t = x.split(',').map(s => s.trim() === oldN ? (ch = true, s.replace(oldN, newN)) : s).join(',');
        return [t];
      });
      if (ch) rg.setValues(out);
    };
    fixCol(ss.getSheetByName(SH.ALOG), 'asset_name');
    const act = ss.getSheetByName(SH.ACT);
    if (act) { const h = act.getRange(1, 1, 1, act.getLastColumn()).getDisplayValues()[0]; ['equipment', 'operator'].forEach(k => { if (h.includes(k)) fixCol(act, k); }); }
    return readAll_(ss);
  });
}
