// ===== 🔔 นัด/เตือน (K2 16 พ.ย. 69) — เรื่องในไร่หรือนอกไร่ ไม่ใช่งานของแปลง (ไม่ลงผัง/สต็อก) =====
// date = dd/MM/yyyy พ.ศ. · time = "09:00" ว่างได้ · repeat = '' | 'วัน' | 'สัปดาห์' | 'เดือน' | 'ปี' (วัน/สัปดาห์ เพิ่ม 16 พ.ย. 09:00 ผู้ใช้ขอ) · lead_days = เตือนล่วงหน้ากี่วัน (0 = วันจริง+พรุ่งนี้)
// status open/done · ทำแล้ว: ซ้ำ = เลื่อนไปรอบถัดไป · ไม่ซ้ำ = done · id สร้างฝั่งเว็บ (R...) ส่งซ้ำไม่เบิ้ล
const REM_REP_ = ['วัน', 'สัปดาห์', 'เดือน', 'ปี'];
// '6 เดือน' (ตัวเลข+เดือน) = ทุก N เดือน (22 พ.ย. 69 บำรุงรถตามระยะ เช่น กรองโซล่าทุก 6 เดือน) · ทำแล้ว = นับรอบใหม่จากวันที่ทำจริง
const remRepOk_ = r => REM_REP_.indexOf(r) !== -1 || /^\d{1,2} เดือน$/.test(r);
const REM_H_ = ['rem_id', 'created', 'date', 'time', 'text', 'repeat', 'lead_days', 'status', 'done_at'];
const remSheet_ = ss => getOrCreate_(ss, 'Reminders', REM_H_);
const remBE_ = iso => { const p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + (Number(p[0]) + 543) : getTodayStr(); };
function remDate_(be) { const p = String(be || '').split('/'); return p.length === 3 ? new Date(Number(p[2]) - 543, Number(p[1]) - 1, Number(p[0])) : null; }
function remFind_(sh, id) { const d = sh.getDataRange().getDisplayValues(); return { d, r: d.findIndex((row, i) => i > 0 && row[0] === String(id)) }; }
function remAdd_(ss, p, id) {
  const sh = remSheet_(ss);
  if (remFind_(sh, id).r > 0) return false;
  const rep = remRepOk_(String(p.repeat || '').trim()) ? String(p.repeat).trim() : '';
  appendRows_(sh, [[String(id), getTodayStr(), remBE_(p.date), String(p.time || '').slice(0, 5), String(p.text || '').slice(0, 200), rep, Math.max(0, Math.round(Number(p.lead_days) || 0)), 'open', '']]);
  return true;
}
function remSet_(sh, r, col, v) { sh.getRange(r + 1, REM_H_.indexOf(col) + 1).setNumberFormat('@').setValue(v); }
function remDone_(ss, id) {
  const sh = remSheet_(ss), f = remFind_(sh, id); if (f.r < 1) return false;
  const row = f.d[f.r], rep = row[REM_H_.indexOf('repeat')];
  const nm = /^(\d{1,2}) เดือน$/.exec(rep);
  if (nm) {
    const now = new Date(), d = new Date(now.getFullYear(), now.getMonth() + Number(nm[1]), 1);
    d.setDate(Math.min(now.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    remSet_(sh, f.r, 'date', Utilities.formatDate(d, 'Asia/Bangkok', 'dd/MM/') + (d.getFullYear() + 543));
  } else if (REM_REP_.indexOf(rep) !== -1) {
    const d = remDate_(row[REM_H_.indexOf('date')]), day = d.getDate(), now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (rep === 'วัน') { if (d < t0) d.setTime(t0.getTime()); d.setDate(d.getDate() + 1); }
    else if (rep === 'สัปดาห์') { do d.setDate(d.getDate() + 7); while (d <= t0); }
    else if (rep === 'ปี') d.setFullYear(d.getFullYear() + 1); else { d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
    remSet_(sh, f.r, 'date', Utilities.formatDate(d, 'Asia/Bangkok', 'dd/MM/') + (d.getFullYear() + 543));
  } else { remSet_(sh, f.r, 'status', 'done'); remSet_(sh, f.r, 'done_at', getTodayStr()); }
  return true;
}
function remDel_(ss, id) { const sh = remSheet_(ss), f = remFind_(sh, id); if (f.r < 1) return false; sh.deleteRow(f.r + 1); return true; }
function remMove_(ss, id, iso) { const sh = remSheet_(ss), f = remFind_(sh, id); if (f.r < 1) return false; remSet_(sh, f.r, 'date', remBE_(iso)); return true; }
function readRem_(ss) { return readSheet_(ss, 'Reminders').filter(r => r.status === 'open'); }
// หน้าเว็บเรียกตรง: op = {fn:'add'|'done'|'del'|'move', id, p, date}
function remOp(op) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (op.fn === 'add') remAdd_(ss, op.p || {}, op.id);
    else if (op.fn === 'done') remDone_(ss, op.id);
    else if (op.fn === 'del') remDel_(ss, op.id);
    else if (op.fn === 'move') remMove_(ss, op.id, op.date);
    else if (op.fn === 'repeat') { const sh = remSheet_(ss), f = remFind_(sh, op.id); if (f.r > 0 && (remRepOk_(op.repeat) || op.repeat === '')) remSet_(sh, f.r, 'repeat', op.repeat); }
    return { reminders: readRem_(ss) };
  });
}
// LINE เช้า: วันนี้ / พรุ่งนี้ / ใกล้ถึง (ขึ้นวันแรกที่เข้าช่วงเตือนล่วงหน้า แล้วที่ 7, 3 วัน — ไม่ขึ้นทุกวันกันรก) / เลยกำหนดยังไม่ทำ
function remBrief_(ss) {
  const now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = [], tmr = [], soon = [], late = [];
  readRem_(ss).forEach(r => {
    const d = remDate_(r.date); if (!d) return;
    const n = Math.round((d - t0) / 864e5), lead = Number(r.lead_days) || 0, tm = r.time ? r.time + ' ' : '';
    const dd = d.getDate() + ' ' + ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][d.getMonth()];
    if (r.repeat === 'วัน' && n < 0) { today.push(`• ${tm}${r.text} (ทุกวัน)`); return; }
    if (n === 0) today.push(`• ${tm}${r.text}`);
    else if (n === 1) tmr.push(`• ${tm}${r.text}`);
    else if (n < 0 && n >= -30) late.push(`• ${r.text} (เลยมา ${-n} วัน · ${dd})`);
    else if (n > 1 && n <= lead && (n === lead || n === 7 || n === 3)) soon.push(`• อีก ${n} วัน (${dd}) ${r.text}`);
  });
  const sec = (t, a) => a.length ? `\n${t} (${a.length})\n${a.join('\n')}\n` : '';
  return sec('🔔 นัด/เตือนวันนี้', today) + sec('🔔 พรุ่งนี้', tmr) + sec('🔔 ใกล้ถึง', soon) + sec('🔔 เลยกำหนด ยังไม่ได้ทำ', late);
}

// ===== 🏠 บันทึกนอกไร่ (16 พ.ย. 69 ผู้ใช้: เรื่องนอกไร่ "ควรขึ้นให้แก้ไข แล้วกดบันทึก") — ไม่ลงบัญชี/สต็อก/ผังของไร่ ขึ้นแค่ในปฏิทิน =====
const NOTE_H_ = ['note_id', 'created', 'date', 'text', 'amount', 'shop', 'photo_ids', 'workers', 'cat', 'kind', 'tags']; // cat/kind/tags 17 พ.ย. (บันทึกวันนี้: หมวด · kind idea = ความคิด/สิ่งที่อ่าน) // workers เพิ่ม 17 พ.ย. (งานนอกไร่ของคนงาน → นับวันในสรุปคนงาน)
function noteSheet_(ss) { const sh = getOrCreate_(ss, 'Notes', NOTE_H_); if (sh.getLastColumn() < NOTE_H_.length) sh.getRange(1, 1, 1, NOTE_H_.length).setValues([NOTE_H_]); return sh; }
function noteAdd_(ss, p, id) {
  const sh = noteSheet_(ss);
  if (sh.getDataRange().getDisplayValues().some(r => r[0] === String(id))) return false;
  const be = remBE_(p.date);
  try { if ((p.photo_ids || []).length) nameChatPhotos_(p.photo_ids, 'นอกไร่_' + String(p.text || '').slice(0, 20), be); } catch (e) {}
  appendRows_(sh, [[String(id), getTodayStr(), be, String(p.text || '').slice(0, 200), Number(p.amount) || '', String(p.shop || '').slice(0, 80), (p.photo_ids || []).join(','), String(p.workers || '').slice(0, 80), String(p.cat || '').slice(0, 30), p.kind === 'idea' ? 'idea' : '', (p.tags || []).join(',').slice(0, 120)]]);
  return true;
}
function noteOp(op) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = getOrCreate_(ss, 'Notes', NOTE_H_);
    if (op.fn === 'del') { const d = sh.getDataRange().getDisplayValues(), r = d.findIndex((row, i) => i > 0 && row[0] === String(op.id)); if (r > 0) sh.deleteRow(r + 1); }
    else if (op.fn === 'move') { const d = sh.getDataRange().getDisplayValues(), r = d.findIndex((row, i) => i > 0 && row[0] === String(op.id)); if (r > 0) sh.getRange(r + 1, 3).setNumberFormat('@').setValue(remBE_(op.date)); }
    return { notes: readSheet_(ss, 'Notes') };
  });
}

// ===== 🟫 ผลดูดินหน้างาน (16 พ.ย. 69 ผู้ใช้: แอปบอก "พอเข้าได้" แต่หน้างาน "ชื้นมาก เข้าไม่ได้") — ใช้เทียบ/ปรับตัวคิดน้ำในดิน + แชตเชื่อผลหน้างานก่อน =====
const SOILCHK_H_ = ['chk_id', 'created', 'date', 'area', 'plot_ids', 'state', 'model_pct', 'note'];
function soilChkAdd_(ss, p, id) {
  const sh = getOrCreate_(ss, 'SoilChecks', SOILCHK_H_);
  if (sh.getDataRange().getDisplayValues().some(r => r[0] === String(id))) return false;
  appendRows_(sh, [[String(id), getTodayStr(), remBE_(p.date), String(p.area || '').slice(0, 60), (p.plot_ids || []).join(','), String(p.state || '').slice(0, 40), p.model_pct === undefined ? '' : p.model_pct, String(p.note || '').slice(0, 200)]]);
  return true;
}
