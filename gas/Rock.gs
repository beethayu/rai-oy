// ===== งานหินคลุก (งานนอก เดือน 11): สมาคมให้โควต้าหินคลุก ไปลงทางเข้าไร่ของสมาชิก =====
// สมาชิก 1 คนมีได้หลายจุด · แต่ละจุดมีพิกัดต้นทาง/ปลายทาง (นำทางด้วย Google Maps), รูปก่อน/หลังลง, เที่ยวสิบล้อ
// ชีต RockPoints = จุด, RockLogs = รูป (before/after) + เที่ยวรถ (trip) · รูปเก็บใน Drive โฟลเดอร์ "หินคลุก ไร่อ้อย/<สมาชิก>"

const ROCK_PT_ = ['point_id', 'created', 'member', 'phone', 'name', 'start_lat', 'start_lng', 'end_lat', 'end_lng',
  'dist_m', 'quota', 'note', 'status', 'done_at', 'pair_before', 'pair_after', 'path'];
const ROCK_LOG_ = ['log_id', 'point_id', 'type', 'timestamp', 'file_id', 'lat', 'lng', 'truck', 'driver', 'trips', 'note',
  'created', 'thumb'];
const ROCK_ST_ = ['รอลง', 'กำลังลง', 'ลงเสร็จ'];

function rockSheets_(ss) {
  const pt = getOrCreate_(ss, 'RockPoints', ROCK_PT_), log = getOrCreate_(ss, 'RockLogs', ROCK_LOG_);
  [[pt, ROCK_PT_], [log, ROCK_LOG_]].forEach(([sh, h]) => {   // คอลัมน์ที่เพิ่มทีหลัง (เช่น path)
    if (sh.getLastColumn() < h.length) sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#38761d').setFontColor('#ffffff');
  });
  return { pt: pt, log: log };
}

// เส้นที่แตะบนแผนที่ "lat,lng;lat,lng;..." → ระยะรวม (เมตร)
function rockPathLen_(path) {
  const pts = String(path || '').split(';').map(x => x.split(',').map(Number)).filter(x => x.length === 2 && x[0] && x[1]);
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += Number(rockDist_(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])) || 0;
  return Math.round(m);
}

// ฟังก์ชันหินคลุกคืนแค่ข้อมูลหินคลุก (เร็วกว่า readAll_ มาก) · readAll_ ก็ใช้อันนี้: ไม่ส่ง thumb (ใหญ่) ไปกับข้อมูลหลัก ดึงทีละจุดด้วย rockThumbs
function readRock_(ss) {
  return {
    rockPoints: readSheet_(ss, 'RockPoints'),
    rockLogs: readSheet_(ss, 'RockLogs').map(l => { const o = Object.assign({}, l); o.has_thumb = !!o.thumb; delete o.thumb; return o; })
  };
}

function rockFolder_(member) {
  const props = PropertiesService.getScriptProperties();
  let root = null;
  const id = props.getProperty('ROCK_FOLDER_ID');
  if (id) { try { root = DriveApp.getFolderById(id); } catch (e) {} }
  if (!root) { root = DriveApp.createFolder('หินคลุก ไร่อ้อย'); props.setProperty('ROCK_FOLDER_ID', root.getId()); }
  const name = String(member || 'ไม่ระบุ').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || 'ไม่ระบุ';
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

function rockRow_(sh, id) {
  const d = sh.getDataRange().getDisplayValues();
  for (let i = 1; i < d.length; i++) if (d[i][0] === id) return { r: i + 1, v: d[i] };
  return null;
}

function rockDist_(a, b, c, d) {
  const n = [a, b, c, d].map(Number);
  if (n.some(x => !x)) return '';
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(n[2] - n[0]), dLng = rad(n[3] - n[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(n[0])) * Math.cos(rad(n[2])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

const rockCoord_ = v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? '' : String(Math.round(Number(v) * 1e6) / 1e6);

// เพิ่ม/แก้จุด (ไม่มี point_id = จุดใหม่) · ส่งเฉพาะช่องที่จะแก้ก็ได้
function saveRockPoint(p) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = rockSheets_(ss).pt;
    if (!p) throw new Error('ไม่มีข้อมูล');
    let row = p.point_id ? rockRow_(sh, p.point_id) : null;
    if (p.point_id && !row) throw new Error('ไม่พบจุดนี้');
    const o = {};
    ROCK_PT_.forEach((k, i) => { o[k] = row ? row.v[i] : ''; });
    if (!row) { o.point_id = 'R' + Date.now(); o.created = getTodayStr(); o.status = 'รอลง'; }
    ['member', 'phone', 'name', 'note', 'quota'].forEach(k => { if (p[k] !== undefined) o[k] = String(p[k]).trim(); });
    ['start_lat', 'start_lng', 'end_lat', 'end_lng'].forEach(k => { if (p[k] !== undefined) o[k] = rockCoord_(p[k]); });
    if (p.path !== undefined) {
      o.path = String(p.path || '').split(';').map(x => x.split(',').map(rockCoord_).join(',')).filter(x => /^-?\d.*,-?\d/.test(x)).join(';');
    }
    if (p.status !== undefined && ROCK_ST_.indexOf(p.status) !== -1) {
      o.status = p.status; o.done_at = p.status === 'ลงเสร็จ' ? (o.done_at || getTodayStr()) : '';
    }
    if (!o.member) throw new Error('ใส่ชื่อสมาชิกก่อน');
    if (!o.name) o.name = 'จุด ' + o.created;
    o.dist_m = o.path && o.path.indexOf(';') > 0 ? rockPathLen_(o.path) : rockDist_(o.start_lat, o.start_lng, o.end_lat, o.end_lng);
    const vals = [ROCK_PT_.map(k => o[k] === undefined || o[k] === null ? '' : String(o[k]))];
    if (row) sh.getRange(row.r, 1, 1, ROCK_PT_.length).setNumberFormat('@').setValues(vals);
    else appendRows_(sh, vals);
    const out = readRock_(ss); out.savedPoint = o.point_id;
    return out;
  });
}

// ลบจุด + รูป/เที่ยวของจุดนั้น (รูปใน Drive ไปถังขยะ)
function deleteRockPoint(pointId) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), s = rockSheets_(ss);
    const row = rockRow_(s.pt, pointId); if (!row) throw new Error('ไม่พบจุดนี้');
    const d = s.log.getDataRange().getDisplayValues();
    for (let i = d.length - 1; i >= 1; i--) if (d[i][1] === pointId) {
      if (d[i][4]) { try { DriveApp.getFileById(d[i][4]).setTrashed(true); } catch (e) {} }
      s.log.deleteRow(i + 1);
    }
    s.pt.deleteRow(row.r);
    return readRock_(ss);
  });
}

// ถ่ายรูป: stage = before | after, b64 = JPEG (ย่อแล้ว), thumb = JPEG เล็ก (เก็บในชีตไว้โชว์เร็ว)
// (ไม่ปักจุดเริ่มจากพิกัดรูปแล้ว — ผู้ใช้อยากเลือกจุดเริ่มเองบนแผนที่)
function addRockPhoto(pointId, stage, b64, opts) {
  opts = opts || {};
  if (['before', 'after'].indexOf(stage) === -1) throw new Error('ระบุก่อนลง/หลังลง');
  if (!b64) throw new Error('ไม่มีรูป');
  const ss = SpreadsheetApp.getActiveSpreadsheet(), s = rockSheets_(ss);
  const row = rockRow_(s.pt, pointId); if (!row) throw new Error('ไม่พบจุดนี้');
  const member = row.v[2], pname = row.v[4], date = opts.date || getTodayStr();
  const n = s.log.getDataRange().getDisplayValues().filter(r => r[1] === pointId && r[2] === stage).length + 1;
  const fname = `${member}_${pname}_${stage === 'before' ? 'ก่อนลง' : 'หลังลง'}_${String(date).replace(/\//g, '-')}_${n}.jpg`.replace(/[\\/:*?"<>|]/g, '');
  const file = rockFolder_(member).createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', fname));
  return withLock_(() => {
    const lat = rockCoord_(opts.lat), lng = rockCoord_(opts.lng);
    const thumb = String(opts.thumb || '').length < 45000 ? String(opts.thumb || '') : '';
    appendRows_(s.log, [['L' + Date.now() + '_' + Math.floor(Math.random() * 1000), pointId, stage, date, file.getId(),
      lat, lng, '', '', '', opts.note || '', getTodayStr(), thumb]]);
    return readRock_(ss);
  });
}

// เที่ยวสิบล้อ: { date, truck, driver, trips, note } — จุดที่ยัง "รอลง" เปลี่ยนเป็น "กำลังลง"
function addRockTrip(pointId, t) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), s = rockSheets_(ss);
    const row = rockRow_(s.pt, pointId); if (!row) throw new Error('ไม่พบจุดนี้');
    t = t || {};
    const trips = Number(t.trips) || 0;
    if (trips <= 0) throw new Error('ใส่จำนวนเที่ยว');
    appendRows_(s.log, [['L' + Date.now(), pointId, 'trip', t.date || getTodayStr(), '', '', '', t.truck || '', t.driver || '',
      String(trips), t.note || '', getTodayStr(), '']]);
    if (row.v[12] === 'รอลง' || !row.v[12]) s.pt.getRange(row.r, 13).setNumberFormat('@').setValue('กำลังลง');
    return readRock_(ss);
  });
}

// ลบรูป/เที่ยว 1 รายการ
function deleteRockLog(logId) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), s = rockSheets_(ss);
    const row = rockRow_(s.log, logId); if (!row) throw new Error('ไม่พบรายการ');
    if (row.v[4]) { try { DriveApp.getFileById(row.v[4]).setTrashed(true); } catch (e) {} }
    s.log.deleteRow(row.r);
    return readRock_(ss);
  });
}

// เลือกรูปที่ใช้ทำรูปคู่ ก่อน/หลัง
function setRockPair(pointId, beforeLog, afterLog) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = rockSheets_(ss).pt;
    const row = rockRow_(sh, pointId); if (!row) throw new Error('ไม่พบจุดนี้');
    sh.getRange(row.r, 15, 1, 2).setNumberFormat('@').setValues([[beforeLog || '', afterLog || '']]);
    return readRock_(ss);
  });
}

// รูปเล็กของจุด {log_id: base64}
function rockThumbs(pointId) {
  const out = {};
  readSheet_(SpreadsheetApp.getActiveSpreadsheet(), 'RockLogs').forEach(l => { if (l.point_id === pointId && l.thumb) out[l.log_id] = l.thumb; });
  return out;
}

// รูปเต็ม (ไว้ทำรูปคู่) {log_id: base64}
function rockPhotos(logIds) {
  const want = (logIds || []).slice(0, 4), out = {};
  readSheet_(SpreadsheetApp.getActiveSpreadsheet(), 'RockLogs').forEach(l => {
    if (want.indexOf(l.log_id) === -1 || !l.file_id) return;
    try { out[l.log_id] = Utilities.base64Encode(DriveApp.getFileById(l.file_id).getBlob().getBytes()); } catch (e) {}
  });
  return out;
}

// แปลงลิงก์/ข้อความ Google Maps เป็นพิกัด (รองรับลิงก์สั้น maps.app.goo.gl)
function resolveMapLink(text) {
  text = String(text || '').trim();
  const pick = s => {
    s = decodeURIComponent(String(s || '')).replace(/\+/g, ' ');
    const pats = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
      /\/place\/(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /\/search\/(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{2,3}\.\d{3,})/];
    for (const p of pats) { const m = s.match(p); if (m) return { lat: Number(m[1]), lng: Number(m[2]) }; }
    return null;
  };
  let hit = pick(text);
  if (hit) return hit;
  const url = (text.match(/https?:\/\/\S+/) || [])[0];
  if (!url) throw new Error('ไม่พบพิกัดในข้อความ');
  let u = url;
  for (let i = 0; i < 6; i++) {
    const res = UrlFetchApp.fetch(u, { followRedirects: false, muteHttpExceptions: true });
    const loc = res.getHeaders()['Location'] || res.getHeaders()['location'];
    hit = pick(u) || (loc && pick(loc));
    if (hit) return hit;
    if (!loc) { hit = pick(res.getContentText().slice(0, 200000)); if (hit) return hit; break; }
    u = loc;
  }
  throw new Error('อ่านพิกัดจากลิงก์ไม่ได้ ลองกดค้างที่จุดใน Google Maps แล้วก๊อปตัวเลขพิกัดมาวางแทน');
}
