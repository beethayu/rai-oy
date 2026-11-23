// ===== สรุปงานตอนเย็น ส่ง LINE ~17:00 ทุกวัน (23 พ.ย. 69) =====
// ผู้ใช้: "อยากให้มีสรุปงานรายวันส่งประมาณ 5 โมงเย็นทุกวัน วันนี้ทำอะไรบ้าง"
// ส่งเมื่อ LINE เช้าเปิดอยู่ (ใช้โทเคนเดียวกัน) และ EVENING_ENABLED ไม่ใช่ 'ปิด' · ตัวตั้งเวลารายวัน 17:00 (Apps Script เลื่อนได้ ~15 นาที)
// ตัวตั้งเวลาติดตั้งเองตอนเปิดแอป (getInitialData → eveEnsure_ เช็ก 6 ชม./ครั้ง) และใน dailyScheduler

function eveEnsure_() {
  try {
    const c = CacheService.getScriptCache();
    if (c.get('eve_trig')) return;
    const has = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'sendEveningBrief');
    if (!has) ScriptApp.newTrigger('sendEveningBrief').timeBased().atHour(17).nearMinute(0).everyDays(1).inTimezone('Asia/Bangkok').create();
    c.put('eve_trig', '1', 21600); // จำหลังสร้างสำเร็จ (ล้ม = ลองใหม่รอบหน้า)
  } catch (e) { console.error('eveEnsure_', e); }
}

function sendEveningBrief() { return withLock_(sendEveningBrief0_); } // กดส่งตอนนี้ชนตัวตั้งเวลา = ไม่เบิ้ล
function sendEveningBrief0_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = getSettings_(ss), today = getTodayStr();
  if (!s.LINE_CHANNEL_TOKEN || s.EVENING_ENABLED === 'ปิด' || s.LAST_EVENING === today) return;
  const res = sendLine_(s, buildEvening_(ss));
  if (res.ok) setSetting_(ss, 'LAST_EVENING', today); else console.error(res.msg);
}

// ปุ่ม "ส่งสรุปเย็นเข้า LINE ตอนนี้" (ส่งแล้วเย็นนี้ตัวตั้งเวลาไม่ส่งซ้ำ)
function sendEveningNow() { return withLock_(() => {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), s = getSettings_(ss);
  const res = sendLine_(s, buildEvening_(ss));
  if (res.ok) setSetting_(ss, 'LAST_EVENING', getTodayStr());
  return res;
}); }

// ปุ่ม "ดูตัวอย่างสรุปเย็น" ในแอป (ไม่ส่ง)
function previewEvening() { return buildEvening_(SpreadsheetApp.getActiveSpreadsheet()); }

function buildEvening_(ss) {
  const today = getTodayStr(), day = d => String(d || '').split(' ')[0];
  const pName = {}; readSheet_(ss, SH.PLOTS).forEach(p => { pName[p.plot_id] = p.plot_name; });
  const acts = readSheet_(ss, SH.ACT);
  const ICON = { 'ขึ้นน้ำ': '💧', 'ฉีดยา': '🧪', 'ใส่ปุ๋ย': '🌱', 'รถไถเตรียมดิน/บำรุง': '🚜', 'ตัดอ้อย': '🌾' };
  const clean = v => { v = String(v || '').trim(); return v && v !== '-' ? v : ''; };
  const TAG = /^⚠️ แชตเข้าใจผิด — จดธรรมดาไว้ · /;
  const list = (a, n) => a.length > n ? a.slice(0, n).join(', ') + ` และอีก ${a.length - n}` : a.join(', ');
  const people = new Set(), addP = s => String(s || '').split(/[,+]/).map(x => x.trim()).filter(x => x && x !== '-' && x !== 'ไม่ระบุ' && x !== 'ธรรมชาติ').forEach(x => people.add(x));
  const out = [`🌇 สรุปงาน ${thaiDate_(new Date())}`], sec = (h, lines) => { if (lines.length) out.push('', h, ...lines); };

  // ✅ งานวันนี้ — แปลงที่เป็นงานเดียวกัน (ชนิด · รายละเอียด · คน · สถานะ) รวมบรรทัดเดียว
  const grp = {}, rain = [];
  acts.forEach(a => {
    if (day(a.timestamp) !== today) return;
    if (/^ฝนตก/.test(a.activity_group)) { rain.push(pName[a.plot_id] || a.plot_id); return; }
    const ong = String(a.remark || '').includes('[⏳กำลังทำ]');
    const k = [a.activity_group, clean(a.activity_detail), clean(a.operator), ong].join('|');
    (grp[k] = grp[k] || { a, ong, plots: [] }).plots.push(pName[a.plot_id] || a.plot_id);
    addP(a.operator);
  });
  const fin = {};
  acts.forEach(a => { if (day(a.timestamp) !== today && String(a.remark || '').includes('เสร็จ ' + today)) (fin[a.activity_group] = fin[a.activity_group] || []).push(pName[a.plot_id] || a.plot_id); });
  const work = Object.values(grp).map(g => { const a = g.a, det = clean(a.activity_detail), q = clean(a.quantity), who = clean(a.operator);
    const g0 = a.activity_group === 'รถไถเตรียมดิน/บำรุง' ? 'รถไถ' : a.activity_group;
    return `• ${ICON[a.activity_group] || '📝'} ${g0}${det ? ' ' + det : ''} — ${list(g.plots, 5)}${who ? `\n    ${who}` : ''}${q ? ` · ${q}` : ''}${g.ong ? ' · ยังไม่เสร็จ' : ''}`; });
  Object.keys(fin).forEach(k => work.push(`• ✅ ${k} — ${list(fin[k], 5)} เสร็จแล้ว`));
  if (rain.length) work.push(`• 🌧️ ฝนตก — ${list(rain, 5)}`);
  sec('✅ งานวันนี้', work);

  // 👀 ไปดูหน้างาน (ผลดูดิน + บันทึก/รูปแปลง) — สั้น ๆ ไม่ใส่หมายเหตุยาว
  try {
    const L = [];
    readSheet_(ss, 'SoilChecks').filter(c => day(c.date) === today).forEach(c => L.push(`• ${c.area || String(c.plot_ids || '').split(',').map(id => pName[id] || id).join(', ')}: ${c.state}`));
    const pp = {}; readSheet_(ss, 'PlotPhotos').filter(x => day(x.timestamp) === today).forEach(x => { const k = String(x.photo_id).replace(/_\d+$/, ''); (pp[k] = pp[k] || { x, ps: [] }).ps.push(pName[x.plot_id] || x.plot_id); });
    Object.values(pp).forEach(o => { const t = (String(o.x.diagnosis || '').replace(/^📝.*$/, '') + ' ' + String(o.x.note || '').replace(TAG, '')).trim();
      L.push(`• ${o.ps.join(', ')}: ${t.slice(0, 80) || 'ถ่ายรูปไว้'}${o.x.file_ids ? ' 📷' : ''}`); });
    sec('👀 ไปดูหน้างาน', L);
  } catch (e) {}

  // 🚚 รถ — คันละบรรทัด: เข้าร้าน / รับรถกลับ + อาการ + ค่าซ่อม
  const veh = {};
  readSheet_(ss, SH.ALOG).filter(l => day(l.timestamp) === today && !/ค้างซ่อม|ทะเบียน|ภาษี/.test(l.event_type)).forEach(l => (veh[l.asset_name] = veh[l.asset_name] || []).push(l));
  sec('🚚 รถ', Object.keys(veh).map(nm => {
    let st = '', shop = '', amt = ''; const txt = [];
    veh[nm].forEach(l => { const e = String(l.event_type || '');
      if (/รับรถกลับ|ซ่อมเสร็จ/.test(e)) st = 'รับรถกลับ'; else if (/จอดอยู่ร้าน/.test(e) && st !== 'รับรถกลับ') st = 'เอาเข้าร้าน';
      String(l.detail || '').replace(TAG, '').split(' · ').map(x => x.trim()).forEach(x => {
        if (!x || x === '-') return;
        if (/^ร้าน\s*/.test(x)) { shop = x.replace(/^ร้าน\s*/, ''); return; }
        if (/^ค่า /.test(x)) { amt = x.replace(/^ค่า /, 'ค่าซ่อม '); return; }
        if (/รับรถกลับ|รอคิว|ซ่อมตามรายการ/.test(x)) return;
        x = x.replace(/^อาการ\s*[:：]\s*/, ''); if (!txt.includes(x)) txt.push(x);
      });
      if (!st && !txt.length && /บำรุง|ถ่ายรูป|บันทึก/.test(e)) txt.push(e.replace(/^[^\p{L}]+/u, ''));
    });
    const head = st === 'รับรถกลับ' ? 'รับรถกลับ' + (shop ? 'จากร้าน' + shop : '') : st ? 'เอาเข้าร้าน' + shop : shop ? 'ร้าน' + shop : '';
    return `• ${nm}: ${[head, txt.slice(0, 2).join(', ').slice(0, 90), amt].filter(Boolean).join(' · ')}`;
  }));

  // ⛽ / 🧪 สต็อก
  try {
    const inv = {}; readSheet_(ss, SH.INV, true).forEach(i => { inv[i.name] = i; });
    const use = {}, got = {}, fuel = [];
    readSheet_(ss, SH.SLOG).forEach(l => { if (day(l.timestamp) !== today) return; const q = Number(String(l.change_qty).replace(/,/g, '')) || 0;
      if (/^⛽ให้น้ำมัน\|/.test(String(l.note || ''))) { fuel.push(`${String(l.note).split('|')[1]} ${Math.round(-q * 10) / 10} ลิตร`); return; }
      if (String(l.ref_log_id || '') === '⚖️ ปรับยอด') return; // นับสต็อกใหม่ ไม่ใช่ใช้/ซื้อจริง
      if (q < 0) use[l.item_name] = (use[l.item_name] || 0) - q; else if (q > 0) got[l.item_name] = (got[l.item_name] || 0) + q; });
    const fq = (n, q) => { const i = inv[n] || {}, pk = Number(i.pack_size) || 1; return pk > 1 ? `${Math.round(q / pk * 10) / 10} ${i.pack_name || i.unit || ''}` : `${Math.round(q * 10) / 10} ${i.unit || ''}`; };
    const L = [];
    if (fuel.length) L.push('• ⛽ ให้น้ำมันเครื่องพ่นยา: ' + fuel.join(', '));
    if (Object.keys(use).length) L.push('• ใช้ไป: ' + Object.keys(use).map(n => `${n} ${fq(n, use[n])}`).join(', '));
    if (Object.keys(got).length) L.push('• ซื้อ/รับเข้า: ' + Object.keys(got).map(n => `${n} ${fq(n, got[n])}`).join(', '));
    sec('📦 ยา / น้ำมัน', L);
  } catch (e) { out.push('', '📦 ยา / น้ำมัน: ดึงข้อมูลไม่ได้'); }

  // 🏠 นอกไร่
  try {
    const iso = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
    sec('🏠 นอกไร่', readSheet_(ss, 'Notes').filter(n => (day(n.date) === today || day(n.date) === iso) && n.kind !== 'idea').map(n => { addP(n.workers);
      return `• ${String(n.text || '').replace(TAG, '').slice(0, 80)}${Number(n.amount) > 0 ? ' · ' + Number(n.amount).toLocaleString('en-US') + ' บ.' : ''}${clean(n.workers) ? ' · ' + n.workers : ''}`; }));
  } catch (e) {}

  if (out.length === 1) out.push('', 'วันนี้ยังไม่มีบันทึกงาน — ถ้าทำอะไรไป จดในแอปได้เลย');
  else if (people.size) out.push('', `👷 คนทำงานวันนี้ ${people.size} คน: ${[...people].join(', ')}`);

  const og = {};
  acts.forEach(a => { if (String(a.remark || '').includes('[⏳กำลังทำ]')) (og[a.activity_group] = og[a.activity_group] || []).push(pName[a.plot_id] || a.plot_id); });
  if (Object.keys(og).length) out.push('', '⏳ ยังค้าง: ' + Object.keys(og).map(k => `${k} ${list(og[k], 4)}`).join(' · '));
  try {
    const t = new Date(); t.setDate(t.getDate() + 1);
    const tm = `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear() + 543}`;
    const rem = readSheet_(ss, 'Reminders').filter(r => r.status !== 'done' && day(r.date) === tm);
    if (rem.length) out.push('', '📅 พรุ่งนี้: ' + rem.map(r => (r.time ? r.time + ' ' : '') + r.text).join(' · '));
  } catch (e) {}
  return out.join('\n');
}
