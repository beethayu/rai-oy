/**
 * ผลผลิตต่อแปลง (ชีต Yields) — เทียบอ้อยใหม่ กับ ตอ 1 / ตอ 2 / ตอ 3+
 * คอลัมน์: yield_id, plot_id, season (เช่น 2569/70), stage, cut_date (วว/ดด/พ.ศ.), tons (น้ำหนักรวมที่ส่งโรงงาน),
 *          area_rai (เก็บเนื้อที่ตอนบันทึก), ccs, note, created_at
 * คืน readAll_ ทั้งก้อน (เหมือน addWatch) หน้าเว็บเรียก init(d)
 */
const YIELD_HEADERS_ = ['yield_id', 'plot_id', 'season', 'stage', 'cut_date', 'tons', 'area_rai', 'ccs', 'note', 'created_at'];
const YIELD_STAGES_ = ['อ้อยใหม่', 'ตอ 1', 'ตอ 2', 'ตอ 3+'];

function saveYield(y) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    y = y || {};
    const pid = String(y.plot_id || '').trim();
    const tons = Number(String(y.tons === undefined ? '' : y.tons).replace(/,/g, ''));
    if (!pid) throw new Error('ยังไม่ได้เลือกแปลง');
    if (!(tons > 0)) throw new Error('ใส่น้ำหนักอ้อย (ตัน) ให้ถูกต้อง');
    const plot = readSheet_(ss, SH.PLOTS).filter(p => p.plot_id === pid)[0];
    if (!plot) throw new Error('ไม่พบแปลง ' + pid);
    const stage = YIELD_STAGES_.indexOf(y.stage) >= 0 ? y.stage : 'อ้อยใหม่';
    const sh = getOrCreate_(ss, 'Yields', YIELD_HEADERS_);
    const area = Number(String(plot.area_rai || '').replace(/,/g, '')) || '';
    const ccs = Number(y.ccs) || '';
    const row = [y.yield_id || ('Y' + Date.now()), pid, String(y.season || '').trim(), stage,
      String(y.cut_date || '').trim(), tons, area, ccs, String(y.note || '').trim().slice(0, 200), getTodayStr()];
    if (y.yield_id) {
      const d = sh.getDataRange().getDisplayValues();
      let hit = -1;
      for (let i = 1; i < d.length; i++) if (d[i][0] === y.yield_id) { hit = i; break; }
      if (hit < 0) throw new Error('ไม่พบรายการผลผลิตที่จะแก้');
      row[9] = d[hit][9] || row[9]; // วันที่สร้างเดิม
      sh.getRange(hit + 1, 1, 1, row.length).setNumberFormat('@').setValues([row.map(v => String(v === null || v === undefined ? '' : v))]);
    } else {
      appendRows_(sh, [row]);
    }
    return readAll_(ss);
  });
}

function deleteYield(yieldId) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Yields');
    if (!sh) throw new Error('ยังไม่มีข้อมูลผลผลิต');
    const d = sh.getDataRange().getDisplayValues();
    for (let i = d.length - 1; i >= 1; i--) if (d[i][0] === yieldId) sh.deleteRow(i + 1);
    return readAll_(ss);
  });
}
