คำสั่งสำหรับ Gemini: อ่านทั้งหมดแล้วออกแบบเลย ไม่ต้องถามกลับ

# ออกแบบหน้า "วันนี้" ของแอปไร่อ้อย ใหม่ทั้งหน้า (คุณออกแบบเองทั้งหมด)

## เป้าหมาย
ทำให้หน้านี้ **สวย แปลกตา มีบุคลิก** ไม่เหมือนแอปทั่วไปที่ AI ทำ
- **ไม่ต้องลดหรือรวมเนื้อหา** ใส่ครบทุกส่วนตามข้อมูลด้านล่าง เจ้าของอยากเห็นแบบเต็มก่อน
- **ขนาดแบบแอป iPhone ปกติ** (เหมือนแอป Apple อย่าง Weather / Reminders / Health): ตัวเนื้อหา 15–17px ป้ายรอง 13px ปุ่มสูงประมาณ 36–44px ห้ามปุ่มใหญ่เทอะทะ ห้ามช่องเต็มความกว้างตัวโต
- ข้อมูลแน่นได้ แต่ต้องอ่านง่ายด้วยลำดับขนาด/น้ำหนักตัวอักษร ไม่ใช่ด้วยกล่องใหญ่
- ถ้ามีภาพหน้าจอแอปตัวอย่างแนบมาด้วย ให้ยึดบรรยากาศ/ความแน่น/สไตล์จากภาพนั้นเป็นหลัก


## แบบอ้างอิงที่เจ้าของชอบ (สำคัญที่สุด)
หน้า "ผังงานอ้อยตอ" ที่คุณ (Gemini) เคยออกแบบให้แอปนี้ เจ้าของชอบมาก — ให้หน้าวันนี้ **อยู่ในตระกูลเดียวกับหน้านั้น** (CSS จริงของหน้านั้นอยู่ท้ายไฟล์):
- กล่องขาวมุมมน เส้นขอบบาง เงานุ่มยกขึ้นเล็กน้อย พื้นหลังเทาอมเขียวอ่อน
- ปุ่มแบ่งช่อง (segmented) ชิปมน ป้ายเล็กสีอ่อน (ม่วงอ่อน / เหลืองอ่อน "มีงานแทรก")
- ขนาดตัวอักษรและปุ่มพอดี ไม่ใหญ่เทอะทะ
- **แตะรายการแล้วมีแผ่นเด้งขึ้นจากด้านล่าง (bottom sheet) แสดงรายละเอียด/ปุ่มทำต่อ ได้** — ต้องเด้งเนียนแบบหน้าผังงาน: ฉากหลังจางเข้า 0.2s · แผ่นเลื่อนขึ้น `transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)` · มีขีดจับด้านบน · ปัดลง/แตะฉากหลัง = ปิด
- อย่าลอกโครงผังงาน (เส้นเชื่อม/ทางแยก) มาใช้ ใช้แค่ภาษาภาพ (สี กล่อง เงา ชิป แผ่นล่าง)

## คนใช้
- เจ้าของไร่อ้อย 281 ไร่ 25 แปลง มีคนงานหลายทีม ใช้ iPhone คนเดียว
- เปิดหน้านี้ทุกเช้า (มักอยู่บ้าน) และกลางแดดในไร่
- ลำดับความสำคัญของข้อมูล (ใช้จัดลำดับสายตา ไม่ใช่ให้ตัดทิ้ง):
  1. วันนี้ต้องทำ/สั่งงานอะไร (สำคัญสุด)
  2. มีอะไรผิดปกติที่ต้องรีบดูไหม
  3. ฝนเป็นยังไง (มีผลกับการฉีดยา/ให้น้ำ/รถเข้าแปลง)
  4. แอปมีเรื่องถามรอให้ตอบไหม
  5. ปฏิทินงานเดือนนี้ (ดูย้อน/ล่วงหน้า แตะวันดูรายการ)

## ข้อมูลตัวอย่าง (ใช้ชุดนี้ในแบบ)
- หัว: 281 ไร่ · 25 แปลง · อ. 24 พ.ย. 69 · ปุ่ม: จดฝนตก · เพิ่ม · ตั้งค่า
- อากาศ: วันนี้ฝน 0 มม. ฝนตกล่าสุด 9 พ.ย. · 7 วันข้างหน้าไม่มีฝน · แตะ = ดูรายชั่วโมงและ 7 วัน
- ราคาน้ำตาล: 17.4 ¢/ปอนด์ (เมื่อวาน 17.1) · แตะ = ดูกราฟ
- ต้องทำวันนี้:
  - กำลังทำ: ฉีดหญ้ารอบไร่ หนองกระทู้ 4 แปลง (P10 P18 P19 P20) · หำ + ผัน · เริ่ม 24 พ.ย.
  - ถึงคิว: ใส่ปุ๋ยตอครั้งที่ 1 · โนนสูง 2 แปลง (P3 P5) · ช่วงที่ควรทำ 20 พ.ย.–5 ธ.ค.
  - ถึงคิว: ให้น้ำ · ขวาถนน · ขาดน้ำ 15 วัน (ครบเกณฑ์ 15 วัน)
  - ฝากดู: แปลงสำนักแจง ดาวเทียมเห็นแห้งลง ~1.2 ไร่ ไม่มีบันทึกช่วงนี้ → ควรไปดูหน้างาน
- นัด/เตือนวันนี้: ให้คนงานไปฉีดยารอบไร่ (นัด)
- เฝ้าไร่: คืนที่ 10 (ช่วงอ้อยใกล้ตัด) · ปุ่มเลิกเฝ้า
- รถ: Jazz ค้างซ่อมที่ร้าน (หน้าปัด) 3 วัน · ปุ่มโทรเช็ค
- แอปถาม (ตอบด้วยปุ่ม): "หนองกระทู้ P18 ฉีดเสร็จแล้วหรือยัง?" [เสร็จแล้ว] [ยังทำอยู่] · "น้ำมันที่ให้หำ+ผัน วันนี้กี่ลิตร?" [ช่องตัวเลข]
- ตรวจข้อมูลอัตโนมัติ: พบ 1 จุด — "บันทึกซ้ำ: ฉีดยา P10 วันที่ 22 พ.ย. 2 รายการ" [ดู] (ถ้าไม่พบ = "ไม่พบจุดผิด")
- ปฏิทิน พ.ย. 2569: วันที่มีงานมีจุดสี (หมวดงาน: ฉีดยา/ปุ๋ย/น้ำ/ตัด/รถ/นัด) · 15–23 มีงานเกือบทุกวัน · 30 พ.ย. มีนัด · แตะวัน = รายการวันนั้นใต้ปฏิทิน + ปุ่ม "+ จดงานวันที่ …"
- เมนูล่าง 5 ปุ่ม: วันนี้ · แปลง · บันทึก · รถ/คน · สต็อก

## ข้อบังคับ (มีแค่นี้ ที่เหลือคุณตัดสินใจเอง)
- ไฟล์ HTML ไฟล์เดียว ไม่ใช้ framework · จอ iPhone 390×844 · แตะทดลองได้ (กาง/พับ เลือกวัน กดปุ่มตอบ)
- ฟอนต์ IBM Plex Sans Thai · ช่องพิมพ์ 16px (กัน iPhone ซูม) · อ่านออกกลางแดด (ตัดกันชัด)
- แผ่นล่างเด้งได้ (ตามข้างบน) แต่ไม่มีหน้าต่างกลางจอ · เมนูล่าง 5 ปุ่มหน้าตาเท่ากัน ไม่มีปุ่มนูนกลาง
- iPhone: `viewport-fit=cover` · html และ body สีเดียวกับ theme-color · เลื่อนในกล่อง #app ที่เริ่มใต้ `env(safe-area-inset-top)` · html/body ไม่เลื่อน

## ส่งกลับ
ไฟล์ HTML 1 ไฟล์ (ทำแบบเดียวให้สุด) + อธิบายสั้น ๆ ว่าแนวคิดหน้าตาคืออะไร


===== CSS จริงของหน้าผังงานอ้อยตอ (ใช้เป็นแบบภาษาภาพ) =====
    /* ===== ผังงานอ้อยตอ (24 พ.ย. 69 รอบ H · ออกแบบ Gemini · ทุก rule อยู่ใต้ #fcx ไม่ชนของแอป) ===== */
  #fcx {
    --brand: #1F5E3B;
    --brand-dark: #15452A;
    --brand-soft: #E8F3EC;
    --brand-mid: #A8CBB5;
    --bg: #F4F5F1;
    --surface: #FFFFFF;
    --surface-note: #EEF4F0;
    --ink: #16241B;
    --ink-2: #46594E;
    --ink-3: #6D7B72;
    --line: #B8C6BC;
    --line-soft: #D3DDD6;
    --border: #DCE3DC;
    --ask: #6D28D9;
    --ask-soft: #F3EEFF;
    --ask-border: #C4B5FD;
    --due: #C2410C;
    --due-soft: #FFF1E6;
    --due-border: #FDBA74;
    --nolog-bg: #F6EFE0;
    --nolog-ink: #7A5919;
    --radius: 14px;
    --radius-sm: 10px;
    --shadow: 0 1px 3px rgba(20, 46, 30, 0.06), 0 1px 1px rgba(20, 46, 30, 0.03);
  }
  #fcx, #fcx * {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }
  #fcx { width: 100%; position: relative; padding-bottom: 16px; margin: 0 -2px; }
  
  #fcx .top-dock {
    position: sticky;
    top: 0;
    z-index: 30;
    background: rgba(244, 245, 241, 0.96);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 10px 12px 8px;
    border-bottom: 1px solid rgba(31, 94, 59, 0.1);
  }
  #fcx .plot-trigger {
    width: 100%;
    min-height: 48px;
    padding: 8px 12px;
    background: var(--surface);
    border: 1.5px solid var(--brand);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
    text-align: left;
    box-shadow: var(--shadow);
    transition: background 0.15s, transform 0.1s;
  }
  #fcx .plot-trigger:active { transform: scale(0.99); background: var(--brand-soft); }
  #fcx .plot-trigger-main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }
  #fcx .plot-trigger-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--brand);
    flex-shrink: 0;
  }
  #fcx .plot-trigger-dot.has-alert { background: var(--ask); box-shadow: 0 0 0 3px var(--ask-soft); }
  #fcx .plot-trigger-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  #fcx .plot-trigger-meta {
    font-size: 13px;
    font-weight: 500;
    color: var(--brand);
    background: var(--brand-soft);
    padding: 2px 8px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  #fcx .plot-trigger-chev {
    flex-shrink: 0;
    color: var(--brand);
    display: flex;
    align-items: center;
  }
  #fcx .stage-nav {
    display: flex;
    gap: 6px;
    margin-top: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  #fcx .stage-nav::-webkit-scrollbar { display: none; }
  #fcx .stage-chip {
    min-height: 44px;
    padding: 0 11px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink-2);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  #fcx .stage-chip:active { transform: scale(0.97); }
  #fcx .stage-chip.is-current {
    background: var(--brand);
    border-color: var(--brand);
    color: #FFFFFF;
    font-weight: 600;
  }
  #fcx .stage-chip .chip-alert {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ask);
    display: inline-block;
  }
  #fcx .stage-chip.is-current .chip-alert { background: #FDE047; }
  #fcx .plot-summary {
    margin: 10px 12px 2px;
    padding: 11px 13px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 4px solid var(--brand);
    border-radius: 12px;
    box-shadow: var(--shadow);
  }
  #fcx .plot-summary.has-action { border-left-color: var(--ask); }
  #fcx .summary-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  #fcx .summary-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
  }
  #fcx .summary-stage-pill {
    font-size: 13px;
    font-weight: 600;
    color: var(--brand-dark);
    background: var(--brand-soft);
    padding: 2px 9px;
    border-radius: 999px;
  }
  #fcx .summary-stats {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 7px;
    flex-wrap: wrap;
  }
  #fcx .summary-counts {
    font-size: 13px;
    color: var(--ink-2);
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  #fcx .count-item { display: inline-flex; align-items: center; gap: 4px; font-weight: 500; }
  #fcx .count-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  #fcx .count-dot.done { background: var(--brand); }
  #fcx .count-dot.ask { background: var(--ask); }
  #fcx .count-dot.due { background: var(--due); }
  #fcx .jump-btn {
    min-height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--brand-mid);
    background: var(--brand-soft);
    color: var(--brand-dark);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  #fcx .jump-btn.is-ask {
    border-color: var(--ask-border);
    background: var(--ask-soft);
    color: var(--ask);
  }
  #fcx .jump-btn:active { transform: scale(0.97); }
  #fcx .legend-bar {
    margin: 10px 12px 2px;
    padding: 8px 11px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 13px;
    color: var(--ink-2);
  }
  #fcx .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }
  #fcx .sym-diamond {
    width: 10px;
    height: 10px;
    background: var(--ask);
    transform: rotate(45deg);
    border-radius: 2px;
    display: inline-block;
  }
  #fcx .sym-arrow {
    font-weight: 700;
    color: var(--brand);
  }
  #fcx .sym-note {
    width: 12px;
    height: 10px;
    border: 1.5px dashed #8AA794;
    background: var(--surface-note);
    border-radius: 3px;
    display: inline-block;
  }
  #fcx .flow-canvas {
    position: relative;
    padding: 12px 12px 24px;
  }
  #fcx .flow-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
    overflow: visible;
  }
  #fcx .flow-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  #fcx .stage-banner-wrap {
    display: flex;
    justify-content: center;
    margin: 22px 0 18px;
    scroll-margin-top: 120px;
  }
  #fcx .stage-banner-wrap:first-child {
    margin-top: 4px;
  }
  #fcx .stage-banner {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 14px;
    border-radius: 999px;
    background: #E5ECE6;
    border: 1px solid #C6D5CA;
    color: var(--brand-dark);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  #fcx .stage-banner .stage-sub {
    font-weight: 500;
    color: var(--ink-2);
  }
  #fcx .stage-banner.is-current-stage {
    background: var(--brand);
    border-color: var(--brand);
    color: #FFFFFF;
    box-shadow: 0 2px 8px rgba(31, 94, 59, 0.22);
  }
  #fcx .stage-banner.is-current-stage .stage-sub {
    color: #D7EFE0;
  }
  #fcx .here-marker {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 0 12px;
    scroll-margin-top: 130px;
  }
  #fcx .here-marker-line {
    flex: 1;
    height: 1.5px;
    background: repeating-linear-gradient(90deg, var(--brand) 0 6px, transparent 6px 10px);
    opacity: 0.7;
  }
  #fcx .here-marker-pill {
    position: relative;
    z-index: 3;
    background: var(--brand);
    color: #FFFFFF;
    font-size: 13px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 8px rgba(31, 94, 59, 0.24);
    white-space: nowrap;
  }
  #fcx .pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #86EFAC;
    box-shadow: 0 0 0 0 rgba(134, 239, 172, 0.8);
    animation: fcxPulse 1.8s infinite;
  }
  @keyframes fcxPulse {
    0% { box-shadow: 0 0 0 0 rgba(134, 239, 172, 0.75); }
    70% { box-shadow: 0 0 0 6px rgba(134, 239, 172, 0); }
    100% { box-shadow: 0 0 0 0 rgba(134, 239, 172, 0); }
  }
  #fcx .fc-block {
    position: relative;
    margin-bottom: 22px;
  }
  #fcx .fc-block:last-child {
    margin-bottom: 4px;
  }
  #fcx .junction-row {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 10px;
    position: relative;
  }
  #fcx .junction-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--bg);
    border: 2px solid var(--line);
    position: relative;
    z-index: 3;
  }
  #fcx .junction-dot.is-active {
    border-color: var(--brand);
    background: var(--brand-soft);
  }
  #fcx .fc-node {
    width: 100%;
    min-height: 56px;
    padding: 10px 11px;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: var(--ink);
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
    transition: transform 0.1s, border-color 0.15s, background 0.15s;
  }
  #fcx .fc-node:active { transform: scale(0.985); }
  #fcx .fc-node.type-ask {
    border-color: var(--ask-border);
    background: #FFFFFF;
  }
  #fcx .fc-node.type-note {
    background: var(--surface-note);
    border: 1.5px dashed #A8BEB0;
    box-shadow: none;
  }
  #fcx .fc-node.st-done {
    border-color: var(--brand);
    border-left-width: 4px;
    background: #FFFFFF;
  }
  #fcx .fc-node.st-ans {
    border-color: var(--brand);
    border-left-width: 4px;
    background: #FFFFFF;
  }
  #fcx .fc-node.st-due {
    border-color: var(--due);
    border-left-width: 4px;
    background: #FFFBF7;
  }
  #fcx .fc-node.st-ask {
    border-color: var(--ask);
    border-width: 2px;
    background: #FCF9FF;
    box-shadow: 0 2px 10px rgba(109, 40, 217, 0.12);
  }
  #fcx .fc-node.st-skip {
    opacity: 0.48;
    border-style: dashed;
    border-color: #C7D0C9;
    background: #F6F7F4;
    box-shadow: none;
  }
  #fcx .fc-node.st-hold {
    border-style: dashed;
    border-color: var(--ask-border);
    background: #FAF8FF;
  }
  #fcx .fc-node.st-nolog {
    border-color: #E2DAC6;
    background: #FCFBF8;
  }
  #fcx .fc-node.st-none {
    border-color: #DFE5DF;
    background: #FAFBFA;
  }
  #fcx .fc-node.st-note.is-now {
    border-style: solid;
    border-color: var(--brand);
    background: var(--brand-soft);
  }
  #fcx .single-wrap {
    max-width: 100%;
  }
  #fcx .node-head {
    display: flex;
    align-items: flex-start;
    gap: 7px;
  }
  #fcx .node-icon {
    flex-shrink: 0;
    margin-top: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  #fcx .ico-diamond {
    width: 11px;
    height: 11px;
    background: var(--ask);
    transform: rotate(45deg);
    border-radius: 2px;
    margin: 3px 2px 0 2px;
  }
  #fcx .st-ans .ico-diamond { background: var(--brand); }
  #fcx .ico-circle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--brand);
    background: #FFFFFF;
    margin-top: 4px;
  }
  #fcx .st-done .ico-circle { background: var(--brand); }
  #fcx .st-due .ico-circle { border-color: var(--due); background: var(--due); }
  #fcx .st-skip .ico-circle { border-color: #A6B2A9; }
  #fcx .st-none .ico-circle, #fcx .st-nolog .ico-circle { border-color: #97A79C; }
  #fcx .ico-info {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #D5E4D9;
    color: var(--brand-dark);
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    margin-top: 1px;
  }
  #fcx .node-title {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.32;
    color: var(--ink);
    word-break: break-word;
  }
  #fcx .st-skip .node-title {
    text-decoration: line-through;
    color: var(--ink-3);
  }
  #fcx .node-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    font-size: 13px;
    color: var(--ink-2);
  }
  #fcx .node-days {
    font-size: 13px;
    color: var(--ink-2);
    font-weight: 500;
  }
  #fcx .mini-tag {
    font-size: 13px;
    font-weight: 500;
    padding: 1px 7px;
    border-radius: 6px;
    background: #EDF2EE;
    color: var(--brand-dark);
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  #fcx .mini-tag.is-branch {
    background: #FEF3C7;
    color: #92400E;
  }
  #fcx .node-status-row {
    margin-top: 2px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
  }
  #fcx .st-pill {
    font-size: 13px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    line-height: 1.3;
  }
  #fcx .st-pill.done { background: var(--brand-soft); color: var(--brand-dark); }
  #fcx .st-pill.ans { background: var(--brand-soft); color: var(--brand-dark); }
  #fcx .st-pill.due { background: var(--due-soft); color: var(--due); }
  #fcx .st-pill.ask { background: var(--ask-soft); color: var(--ask); }
  #fcx .st-pill.hold { background: #F0EBF8; color: #5B3E8C; font-weight: 500; }
  #fcx .st-pill.nolog { background: var(--nolog-bg); color: var(--nolog-ink); font-weight: 500; }
  #fcx .st-pill.wait { background: #EEF2EF; color: var(--ink-2); font-weight: 500; }
  #fcx .st-pill.skip { background: #ECEFE9; color: var(--ink-3); font-weight: 500; }
  #fcx .st-pill.note { background: rgba(255,255,255,0.85); color: var(--brand-dark); font-weight: 500; }
  #fcx .st-none-txt {
    font-size: 13px;
    color: var(--ink-3);
    font-weight: 400;
  }
  #fcx .inline-opts {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 3px;
  }
  #fcx .inline-opt-chip {
    font-size: 13px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--ask-border);
    background: var(--ask-soft);
    color: var(--ask);
  }
  #fcx .inline-opt-chip.is-skip-opt {
    border-color: var(--border);
    background: #F4F5F3;
    color: var(--ink-2);
  }
  #fcx .inline-opt-chip.is-chosen {
    border-color: var(--brand);
    background: var(--brand);
    color: #FFFFFF;
    font-weight: 600;
  }
  #fcx .fork-decision-wrap {
    display: flex;
    justify-content: center;
  }
  #fcx .fork-decision-wrap .fc-node {
    width: 100%;
  }
  #fcx .fork-branches {
    display: grid;
    gap: 6px;
    margin-top: 26px;
    margin-bottom: 18px;
    align-items: stretch;
  }
  #fcx .fork-branches.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  #fcx .fork-branches.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  #fcx .fork-branches.cols-many { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 14px; }
  #fcx .fork-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }
  #fcx .edge-label-pill {
    font-size: 13px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--ask-soft);
    border: 1px solid var(--ask-border);
    color: var(--ask);
    margin-bottom: 6px;
    text-align: center;
    line-height: 1.25;
    max-width: 100%;
    word-break: break-word;
  }
  #fcx .edge-label-pill.is-chosen {
    background: var(--brand);
    border-color: var(--brand);
    color: #FFFFFF;
  }
  #fcx .edge-label-pill.is-dim {
    background: #ECEFE9;
    border-color: #D2DBD4;
    color: var(--ink-3);
    opacity: 0.7;
  }
  #fcx .fork-branches.cols-3 .fc-node {
    padding: 8px 7px;
    border-radius: 12px;
    flex: 1;
  }
  #fcx .fork-branches.cols-3 .node-head {
    gap: 4px;
  }
  #fcx .fork-branches.cols-3 .node-icon {
    display: none;
  }
  #fcx .fork-branches.cols-3 .node-title {
    font-size: 13px;
    line-height: 1.3;
  }
  #fcx .fork-branches.cols-3 .st-pill {
    padding: 2px 6px;
    font-size: 13px;
  }
  #fcx .parallel-lanes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 20px;
    margin-bottom: 18px;
    align-items: start;
  }
  #fcx .lane-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
  }
  #fcx .lane-caption {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-3);
    text-align: center;
    margin-bottom: 6px;
    padding: 1px 6px;
    background: var(--bg);
    align-self: center;
    border-radius: 6px;
  }
  #fcx .lane-caption.is-chain { color: var(--brand-dark); }
  #fcx .lane-items {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  #fcx .lane-indep-gap {
    height: 12px;
    position: relative;
  }
  #fcx .chain-gap {
    min-height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 3;
  }
  #fcx .chain-offset-pill {
    font-size: 13px;
    font-weight: 600;
    color: var(--brand-dark);
    background: #FFFFFF;
    border: 1.25px solid var(--brand-mid);
    padding: 1px 8px;
    border-radius: 999px;
    line-height: 1.35;
    box-shadow: 0 1px 2px rgba(20, 46, 30, 0.06);
  }
  #fcx .terminal-endpoints {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 26px;
  }
  #fcx .term-pill-btn {
    min-height: 48px;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1.5px solid var(--border);
    background: var(--surface);
    color: var(--ink);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    text-align: center;
    box-shadow: var(--shadow);
    transition: all 0.15s;
  }
  #fcx .term-pill-btn:active { transform: scale(0.98); }
  #fcx .term-pill-btn .term-sub {
    font-size: 13px;
    font-weight: 400;
    color: var(--ink-2);
  }
  #fcx .term-pill-btn.is-chosen {
    border-color: var(--brand);
    background: var(--brand);
    color: #FFFFFF;
  }
  #fcx .term-pill-btn.is-chosen .term-sub { color: #D7EFE0; }
  #fcx .term-pill-btn.is-dim {
    opacity: 0.45;
    border-style: dashed;
  }
  #fcx .sheet-backdrop {
    position: fixed; z-index: 2100 !important;
    inset: 0;
    background: rgba(16, 32, 22, 0.45);
    z-index: 60;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }
  #fcx .sheet-backdrop.open {
    opacity: 1;
    pointer-events: auto;
  }
  #fcx .sheet-panel {
    width: 100%;
    max-width: 390px;
    max-height: 84dvh;
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    display: flex;
    flex-direction: column;
    transform: translateY(100%);
    transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
    overflow: hidden;
    box-shadow: 0 -6px 28px rgba(0, 0, 0, 0.16);
  }
  #fcx .sheet-backdrop.open .sheet-panel {
    transform: translateY(0);
  }
  #fcx .sheet-handle {
    width: 38px;
    height: 4px;
    border-radius: 999px;
    background: #D0D8D2;
    margin: 10px auto 4px;
    flex-shrink: 0;
  }
  #fcx .sheet-header {
    padding: 6px 14px 12px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    flex-shrink: 0;
  }
  #fcx .sheet-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.3;
  }
  #fcx .sheet-subtitle {
    font-size: 13px;
    color: var(--ink-2);
    margin-top: 2px;
  }
  #fcx .sheet-close {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: none;
    background: #EFF3F0;
    color: var(--ink);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  #fcx .sheet-close:active { background: #E0E7E2; }
  #fcx .sheet-body {
    padding: 14px 16px 24px;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  #fcx .detail-box {
    padding: 11px 13px;
    border-radius: 12px;
    background: #F7F9F7;
    border: 1px solid var(--border);
    font-size: 14px;
    color: var(--ink);
  }
  #fcx .detail-box.is-branch {
    background: #FFFBEB;
    border-color: #FCD34D;
  }
  #fcx .detail-box.is-ask {
    background: var(--ask-soft);
    border-color: var(--ask-border);
  }
  #fcx .detail-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-2);
    margin-bottom: 4px;
  }
  #fcx .detail-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  #fcx .detail-chip {
    font-size: 13px;
    padding: 3px 10px;
    border-radius: 999px;
    background: #E8EFEA;
    color: var(--brand-dark);
    font-weight: 500;
  }
  #fcx .answer-btn-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }
  #fcx .answer-opt-btn {
    width: 100%;
    min-height: 48px;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1.5px solid var(--border);
    background: var(--surface);
    color: var(--ink);
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    text-align: left;
  }
  #fcx .answer-opt-btn:active { transform: scale(0.99); }
  #fcx .answer-opt-btn.selected {
    border-color: var(--brand);
    background: var(--brand);
    color: #FFFFFF;
  }
  #fcx .answer-opt-sub {
    font-size: 13px;
    font-weight: 400;
    opacity: 0.85;
  }
  #fcx .reset-ans-btn {
    min-height: 44px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px dashed var(--border);
    background: transparent;
    color: var(--ink-2);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    margin-top: 4px;
  }
  #fcx .plot-item-btn {
    width: 100%;
    min-height: 54px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1.5px solid var(--border);
    background: var(--surface);
    color: var(--ink);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  #fcx .plot-item-btn:active { background: var(--brand-soft); }
  #fcx .plot-item-btn.active {
    border-color: var(--brand);
    background: var(--brand-soft);
  }
  #fcx .plot-item-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
  }
  #fcx .plot-item-sub {
    font-size: 13px;
    color: var(--ink-2);
    margin-top: 2px;
  }
  #fcx .plot-item-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }
  #fcx .plot-badge-age {
    font-size: 13px;
    font-weight: 600;
    color: var(--brand-dark);
    background: #E8F1EB;
    padding: 2px 8px;
    border-radius: 999px;
  }
  #fcx .plot-badge-alert {
    font-size: 13px;
    font-weight: 600;
    color: var(--ask);
    background: var(--ask-soft);
    padding: 1px 8px;
    border-radius: 999px;
  }
  #fcx .fcx-toast {
    position: fixed;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%) translateY(80px);
    background: var(--ink);
    color: #FFFFFF;
    font-size: 14px;
    font-weight: 500;
    padding: 10px 16px;
    border-radius: 999px;
    z-index: 80;
    opacity: 0;
    transition: all 0.25s ease;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  }
  #fcx .fcx-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

    #fcx .top-dock { top: -16px; background: #F4F5F1; margin: 0 -12px; padding-left: 14px; padding-right: 14px; }
    #fcx .ico-info { display: inline-flex; align-items: center; justify-content: center; }
    .fc-alt { display: block; text-align: center; margin: 14px 0 4px; color: #5E6A63; font-size: 14px; text-decoration: underline; }
