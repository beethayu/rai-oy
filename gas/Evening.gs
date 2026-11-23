// ===== สรุปงานตอนเย็น ส่ง LINE ~17:00 ทุกวัน (23 พ.ย. 69) =====
// ผู้ใช้: "อยากให้มีสรุปงานรายวันส่งประมาณ 5 โมงเย็นทุกวัน วันนี้ทำอะไรบ้าง"
// ส่งเมื่อ LINE เช้าเปิดอยู่ (ใช้โทเคนเดียวกัน) และ EVENING_ENABLED ไม่ใช่ 'ปิด' · ตัวตั้งเวลารายวัน 17:00 (Apps Script เลื่อนได้ ~15 นาที)
// ตัวตั้งเวลาติดตั้งเองตอนเปิดแอป (getInitialData → eveEnsure_ เช็ก 6 ชม./ครั้ง) และใน dailyScheduler

function eveEnsure_() {
  try {
    const c = CacheService.getScriptCache();
    if (c.get('eve_trig')) return;
    c.put('eve_trig', '1', 21600);
    const has = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'sendEveningBrief');
    if (!has) ScriptApp.newTrigger('sendEveningBrief').timeBased().atHour(17).nearMinute(0).everyDays(1).inTimezone('Asia/Bangkok').create();
  } catch (e) { console.error('eveEnsure_', e); }
}

function sendEveningBrief() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = getSettings_(ss), today = getTodayStr();
  if (s.NOTIFY_ENABLED !== 'เปิด' || s.EVENING_ENABLED === 'ปิด' || s.LAST_EVENING === today) return;
  const res = sendLine_(s, buildEvening_(ss));
  if (res.ok) setSetting_(ss, 'LAST_EVENING', today); else console.error(res.msg);
}

// ปุ่ม "ดูตัวอย่างสรุปเย็น" ในแอป (ไม่ส่ง)
function previewEvening() { return buildEvening_(SpreadsheetApp.getActiveSpreadsheet()); }

function buildEvening_(ss) {
  const today = getTodayStr(), day = d => String(d || '').split(' ')[0];
  const pName = {}; readSheet_(ss, SH.PLOTS).forEach(p => { pName[p.plot_id] = p.plot_name; });
  const acts = readSheet_(ss, SH.ACT);
  const ICON = { 'ขึ้นน้ำ': '💧', 'ฉีดยา': '🧪', 'ใส่ปุ๋ย': '🌱', 'รถไถเตรียมดิน/บำรุง': '🚜', 'ตัดอ้อย': '🌾', 'ฝนตก': '🌧️' };
  const clean = v => { v = String(v || '').trim(); return v && v !== '-' ? v : ''; };
  const people = new Set(), addP = s => String(s || '').split(/[,+、]/).map(x => x.trim()).filter(x => x && x !== '-').forEach(x => people.add(x));
  const out = [`🌇 สรุปงานวันนี้ · ${thaiDate_(new Date())}`];

  // งานในไร่วันนี้: รวมแปลงที่เป็นงานเดียวกัน (ชนิด · รายละเอียด · คน · สถานะ)
  const grp = {}, rain = [];
  acts.forEach(a => {
    if (day(a.timestamp) !== today) return;
    if (/^ฝนตก/.test(a.activity_group)) { rain.push(pName[a.plot_id] || a.plot_id); return; }
    const ong = String(a.remark || '').includes('[⏳กำลังทำ]');
    const k = [a.activity_group, clean(a.activity_detail), clean(a.operator), clean(a.equipment), ong].join('|');
    (grp[k] = grp[k] || { a, ong, plots: [] }).plots.push(pName[a.plot_id] || a.plot_id);
    addP(a.operator);
  });
  // ปิดงานค้างวันนี้ (กดเสร็จแบบคงวันเริ่ม → หมายเหตุ "เสร็จ <วันนี้>")
  const fin = {};
  acts.forEach(a => { if (day(a.timestamp) !== today && String(a.remark || '').includes('เสร็จ ' + today)) (fin[a.activity_group] = fin[a.activity_group] || []).push(pName[a.plot_id] || a.plot_id); });
  const G = Object.values(grp);
  if (G.length || Object.keys(fin).length) {
    out.push('', '🌾 งานในไร่');
    G.forEach(g => {
      const a = g.a, det = clean(a.activity_detail), q = clean(a.quantity);
      out.push(`• ${ICON[a.activity_group] || '📝'} ${a.activity_group}${det ? ' (' + det + ')' : ''} · ${g.plots.join(', ')}`
        + (clean(a.operator) ? `\n   👷 ${clean(a.operator)}` : '') + (clean(a.equipment) ? ` · 🚜 ${clean(a.equipment)}` : '') + (q ? ` · ${q}` : '')
        + (g.ong ? ' · ⏳ ยังไม่เสร็จ' : ''));
    });
    Object.keys(fin).forEach(k => out.push(`• ✅ ${k} เสร็จ · ${fin[k].join(', ')}`));
  }
  if (rain.length) out.push('', `🌧️ ฝนตก: ${rain.join(', ')}`);

  // รถ (ไม่นับรายการค้างซ่อม/จดข้อมูล)
  const al = readSheet_(ss, SH.ALOG).filter(l => day(l.timestamp) === today && !/ค้างซ่อม/.test(l.event_type));
  if (al.length) {
    out.push('', '🚚 รถ/เครื่องมือ');
    al.forEach(l => out.push(`• ${l.asset_name} · ${String(l.event_type || '').trim()}${clean(l.detail) ? ' · ' + String(l.detail).replace(/^⚠️ แชตเข้าใจผิด — จดธรรมดาไว้ · /, '').slice(0, 120) : ''}`));
  }

  // สต็อก: ใช้ไป / รับเข้า วันนี้ (รวมต่อชนิด)
  try {
    const inv = {}; readSheet_(ss, SH.INV, true).forEach(i => { inv[i.name] = i; });
    const use = {}, got = {};
    readSheet_(ss, SH.SLOG).forEach(l => { if (day(l.timestamp) !== today) return; const q = Number(String(l.change_qty).replace(/,/g, '')) || 0; if (q < 0) use[l.item_name] = (use[l.item_name] || 0) - q; else if (q > 0) got[l.item_name] = (got[l.item_name] || 0) + q; });
    const fq = (n, q) => { const i = inv[n] || {}, pk = Number(i.pack_size) || 1; return pk > 1 ? `${Math.round(q / pk * 10) / 10} ${i.pack_name || i.unit || ''}` : `${Math.round(q * 10) / 10} ${i.unit || ''}`; };
    const u = Object.keys(use), g = Object.keys(got);
    if (u.length || g.length) {
      out.push('', '📦 สต็อก');
      if (u.length) out.push('• ใช้ไป: ' + u.map(n => `${n} ${fq(n, use[n])}`).join(', '));
      if (g.length) out.push('• รับเข้า: ' + g.map(n => `${n} ${fq(n, got[n])}`).join(', '));
    }
  } catch (e) { out.push('', '📦 สต็อก: ดึงข้อมูลไม่ได้'); }

  // นอกไร่ / บันทึกทั่วไป
  try {
    const iso = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
    const notes = readSheet_(ss, 'Notes').filter(n => (day(n.date) === today || day(n.date) === iso) && n.kind !== 'idea');
    if (notes.length) {
      out.push('', '🏠 นอกไร่ / บันทึก');
      notes.forEach(n => { addP(n.workers); out.push(`• ${String(n.text || '').replace(/^⚠️ แชตเข้าใจผิด — จดธรรมดาไว้ · /, '📝 ').slice(0, 120)}${Number(n.amount) > 0 ? ' · ' + Number(n.amount).toLocaleString('en-US') + ' บ.' : ''}${clean(n.workers) ? ' · 👷 ' + n.workers : ''}`); });
    }
  } catch (e) {}

  if (out.length === 1) out.push('', 'วันนี้ยังไม่มีบันทึกงาน — ถ้าทำอะไรไป จดในแอปได้เลย');
  else if (people.size) out.push('', `👷 คนทำงานวันนี้ (${people.size}): ${[...people].join(', ')}`);

  // งานที่ยังค้าง (⏳) ทั้งไร่
  const og = {};
  acts.forEach(a => { if (String(a.remark || '').includes('[⏳กำลังทำ]')) (og[a.activity_group] = og[a.activity_group] || []).push(pName[a.plot_id] || a.plot_id); });
  if (Object.keys(og).length) out.push('', '⏳ ยังค้างอยู่: ' + Object.keys(og).map(k => `${k} ${og[k].join(', ')}`).join(' · '));

  // พรุ่งนี้: นัด/เตือน
  try {
    const t = new Date(); t.setDate(t.getDate() + 1);
    const tm = `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear() + 543}`;
    const rem = readSheet_(ss, 'Reminders').filter(r => r.status !== 'done' && day(r.date) === tm);
    if (rem.length) out.push('', '📅 พรุ่งนี้: ' + rem.map(r => (r.time ? r.time + ' ' : '') + r.text).join(' · '));
  } catch (e) {}
  return out.join('\n');
}
