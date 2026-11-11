// ===== ขั้นตอนอ้อยใหม่ / อ้อยตอ (flowchart ที่ผู้ใช้แก้เองได้ในแอป) =====
// ชีต Flow แถวละชนิดอ้อย: key (อ้อยใหม่|อ้อยตอ), data = JSON [{id,n,f,t,g,m,k,tool,note}], updated
const FLOW_H_ = ['key', 'data', 'updated'];

function saveFlow(key, data) {
  key = String(key || '').trim();
  if (['อ้อยใหม่', 'อ้อยตอ'].indexOf(key) < 0) throw new Error('ชนิดอ้อยไม่ถูกต้อง');
  const js = typeof data === 'string' ? data : JSON.stringify(data || []);
  if (!Array.isArray(JSON.parse(js))) throw new Error('ข้อมูลขั้นตอนไม่ถูกต้อง');
  if (js.length > 45000) throw new Error('ขั้นตอนยาวเกินไป');
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = getOrCreate_(ss, 'Flow', FLOW_H_);
    const d = sh.getDataRange().getDisplayValues(), r = d.findIndex((row, i) => i > 0 && row[0] === key);
    const row = [[key, js, Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm')]];
    if (r > 0) sh.getRange(r + 1, 1, 1, FLOW_H_.length).setNumberFormat('@').setValues(row);
    else appendRows_(sh, row);
    return { flows: readSheet_(ss, 'Flow') };
  });
}
