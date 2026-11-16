// ===== 🔔 นัด/เตือน (K2 16 พ.ย. 69) — เรื่องในไร่หรือนอกไร่ ไม่ใช่งานของแปลง (ไม่ลงผัง/สต็อก) =====
// date = dd/MM/yyyy พ.ศ. · time = "09:00" ว่างได้ · repeat = '' | 'เดือน' | 'ปี' · lead_days = เตือนล่วงหน้ากี่วัน (0 = วันจริง+พรุ่งนี้)
// status open/done · ทำแล้ว: ซ้ำ = เลื่อนไปรอบถัดไป · ไม่ซ้ำ = done · id สร้างฝั่งเว็บ (R...) ส่งซ้ำไม่เบิ้ล
const REM_H_ = ['rem_id', 'created', 'date', 'time', 'text', 'repeat', 'lead_days', 'status', 'done_at'];
const remSheet_ = ss => getOrCreate_(ss, 'Reminders', REM_H_);
const remBE_ = iso => { const p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + (Number(p[0]) + 543) : getTodayStr(); };
function remDate_(be) { const p = String(be || '').split('/'); return p.length === 3 ? new Date(Number(p[2]) - 543, Number(p[1]) - 1, Number(p[0])) : null; }
function remFind_(sh, id) { const d = sh.getDataRange().getDisplayValues(); return { d, r: d.findIndex((row, i) => i > 0 && row[0] === String(id)) }; }
function remAdd_(ss, p, id) {
  const sh = remSheet_(ss);
  if (remFind_(sh, id).r > 0) return false;
  const rep = ['เดือน', 'ปี'].indexOf(p.repeat) !== -1 ? p.repeat : '';
  appendRows_(sh, [[String(id), getTodayStr(), remBE_(p.date), String(p.time || '').slice(0, 5), String(p.text || '').slice(0, 200), rep, Math.max(0, Math.round(Number(p.lead_days) || 0)), 'open', '']]);
  return true;
}
function remSet_(sh, r, col, v) { sh.getRange(r + 1, REM_H_.indexOf(col) + 1).setNumberFormat('@').setValue(v); }
function remDone_(ss, id) {
  const sh = remSheet_(ss), f = remFind_(sh, id); if (f.r < 1) return false;
  const row = f.d[f.r], rep = row[REM_H_.indexOf('repeat')];
  if (rep === 'เดือน' || rep === 'ปี') {
    const d = remDate_(row[REM_H_.indexOf('date')]), day = d.getDate();
    if (rep === 'ปี') d.setFullYear(d.getFullYear() + 1); else { d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
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
    if (n === 0) today.push(`• ${tm}${r.text}`);
    else if (n === 1) tmr.push(`• ${tm}${r.text}`);
    else if (n < 0 && n >= -30) late.push(`• ${r.text} (เลยมา ${-n} วัน · ${dd})`);
    else if (n > 1 && n <= lead && (n === lead || n === 7 || n === 3)) soon.push(`• อีก ${n} วัน (${dd}) ${r.text}`);
  });
  const sec = (t, a) => a.length ? `\n${t} (${a.length})\n${a.join('\n')}\n` : '';
  return sec('🔔 นัด/เตือนวันนี้', today) + sec('🔔 พรุ่งนี้', tmr) + sec('🔔 ใกล้ถึง', soon) + sec('🔔 เลยกำหนด ยังไม่ได้ทำ', late);
}
