// ===== แผนที่ไร่: ขอบแปลง (วาดบนแผนที่ในแอป) + ที่ดินที่จะเช่า =====
// ชีต Plots: เพิ่มคอลัมน์ boundary ("lat,lng;lat,lng;..."), map_rai (เนื้อที่จากแผนที่), center_lat, center_lng (ใช้กับพยากรณ์อากาศ)
// ชีต Lands: ที่ดินที่ยังไม่ใช่แปลง (เช่น จะไปเช่า) — วัดขนาด จดเจ้าของ/เบอร์ไว้

const LAND_H_ = ['land_id', 'created', 'name', 'owner', 'phone', 'note', 'boundary', 'map_rai', 'center_lat', 'center_lng'];
const RAI_M2_ = 1600;

// หา/สร้างคอลัมน์ชื่อ name ในแถวหัว คืนเลขคอลัมน์ (เริ่ม 1)
function headCol_(sh, name) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const i = head.indexOf(name);
  if (i !== -1) return i + 1;
  let c = head.length;
  while (c > 0 && head[c - 1] === '') c--;
  sh.getRange(1, c + 1).setValue(name).setFontWeight('bold');
  return c + 1;
}

function parsePath_(path) {
  return String(path || '').split(';').map(x => x.split(',').map(Number))
    .filter(x => x.length === 2 && isFinite(x[0]) && isFinite(x[1]) && x[0] && x[1]);
}

// เนื้อที่ (ตร.ม.) + จุดกลาง ของรูปหลายเหลี่ยมเล็ก ๆ (ฉายลงระนาบรอบจุดเฉลี่ย พอสำหรับไร่ไม่กี่ร้อยไร่)
function polyInfo_(pts) {
  if (pts.length < 3) return null;
  const lat0 = pts.reduce((t, p) => t + p[0], 0) / pts.length, lng0 = pts.reduce((t, p) => t + p[1], 0) / pts.length;
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  const xy = pts.map(p => [(p[1] - lng0) * kx, (p[0] - lat0) * ky]);
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length], f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  a /= 2;
  if (!a) return null;
  cx /= (6 * a); cy /= (6 * a);
  return { m2: Math.abs(a), lat: lat0 + cy / ky, lng: lng0 + cx / kx };
}

function cleanPath_(pts) { return pts.map(p => p[0].toFixed(6) + ',' + p[1].toFixed(6)).join(';'); }

// วาด/แก้/ลบ ขอบแปลง (path ว่าง = ลบขอบ) → คืน { plots }
function setPlotBoundary(plotId, path) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SH.PLOTS);
    const pts = parsePath_(path);
    if (pts.length && pts.length < 3) throw new Error('ขอบแปลงต้องมีอย่างน้อย 3 มุม');
    const info = polyInfo_(pts);
    const cB = headCol_(sh, 'boundary'), cR = headCol_(sh, 'map_rai'), cLa = headCol_(sh, 'center_lat'), cLn = headCol_(sh, 'center_lng');
    const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getDisplayValues().map(r => r[0]);
    const r = ids.indexOf(plotId);
    if (r < 1) throw new Error('ไม่พบแปลง ' + plotId);
    const put = (c, v) => sh.getRange(r + 1, c).setNumberFormat('@').setValue(v === '' ? '' : String(v));
    put(cB, info ? cleanPath_(pts) : '');
    put(cR, info ? Math.round(info.m2 / RAI_M2_ * 100) / 100 : '');
    put(cLa, info ? info.lat.toFixed(6) : '');
    put(cLn, info ? info.lng.toFixed(6) : '');
    return { plots: readSheet_(ss, SH.PLOTS) };
  });
}

// ที่ดินที่จะเช่า/ดูไว้: เพิ่ม/แก้ (ไม่มี land_id = ใหม่) → คืน { lands, savedLand }
function saveLand(o) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = getOrCreate_(ss, 'Lands', LAND_H_);
    o = o || {};
    const d = sh.getDataRange().getDisplayValues();
    let r = o.land_id ? d.findIndex((row, i) => i > 0 && row[0] === o.land_id) : -1;
    if (o.land_id && r < 1) throw new Error('ไม่พบที่ดินนี้');
    const cur = {};
    LAND_H_.forEach((k, i) => { cur[k] = r > 0 ? d[r][i] : ''; });
    if (r < 1) { cur.land_id = 'D' + Date.now(); cur.created = getTodayStr(); }
    ['name', 'owner', 'phone', 'note'].forEach(k => { if (o[k] !== undefined) cur[k] = String(o[k]).trim(); });
    if (o.boundary !== undefined) {
      const pts = parsePath_(o.boundary), info = polyInfo_(pts);
      if (!info) throw new Error('ขอบที่ดินต้องมีอย่างน้อย 3 มุม');
      cur.boundary = cleanPath_(pts); cur.map_rai = String(Math.round(info.m2 / RAI_M2_ * 100) / 100);
      cur.center_lat = info.lat.toFixed(6); cur.center_lng = info.lng.toFixed(6);
    }
    if (!cur.name) cur.name = 'ที่ดิน ' + cur.created;
    const row = [LAND_H_.map(k => String(cur[k] || ''))];
    if (r > 0) sh.getRange(r + 1, 1, 1, LAND_H_.length).setNumberFormat('@').setValues(row);
    else appendRows_(sh, row);
    return { lands: readSheet_(ss, 'Lands'), savedLand: cur.land_id };
  });
}

function deleteLand(landId) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('Lands');
    if (!sh) throw new Error('ไม่พบที่ดินนี้');
    const d = sh.getDataRange().getDisplayValues();
    const r = d.findIndex((row, i) => i > 0 && row[0] === landId);
    if (r < 1) throw new Error('ไม่พบที่ดินนี้');
    sh.deleteRow(r + 1);
    return { lands: readSheet_(ss, 'Lands') };
  });
}

// นำเข้าขอบหลายรายการในครั้งเดียว (จากไฟล์ KML ของแอป Ling ฯลฯ)
// items: [{kind:'plot', id, path} | {kind:'land', name, note, path}] → คืน { plots, lands, done }
function importBoundaries(items) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SH.PLOTS);
    const cB = headCol_(sh, 'boundary'), cR = headCol_(sh, 'map_rai'), cLa = headCol_(sh, 'center_lat'), cLn = headCol_(sh, 'center_lng');
    const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getDisplayValues().map(r => r[0]);
    let done = 0;
    const lands = [];
    (items || []).forEach(it => {
      const pts = parsePath_(it.path), info = polyInfo_(pts);
      if (!info) return;
      const path = cleanPath_(pts), rai = String(Math.round(info.m2 / RAI_M2_ * 100) / 100);
      if (it.kind === 'plot') {
        const r = ids.indexOf(it.id);
        if (r < 1) return;
        [[cB, path], [cR, rai], [cLa, info.lat.toFixed(6)], [cLn, info.lng.toFixed(6)]].forEach(([c, v]) => sh.getRange(r + 1, c).setNumberFormat('@').setValue(v));
        done++;
      } else if (it.kind === 'land') {
        lands.push(['D' + Date.now() + '_' + lands.length, getTodayStr(), String(it.name || 'ที่ดินนำเข้า').trim(), '', '', String(it.note || '').trim(),
          path, rai, info.lat.toFixed(6), info.lng.toFixed(6)]);
        done++;
      }
    });
    if (lands.length) appendRows_(getOrCreate_(ss, 'Lands', LAND_H_), lands);
    return { plots: readSheet_(ss, SH.PLOTS), lands: readSheet_(ss, 'Lands'), done: done };
  });
}
