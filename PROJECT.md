สรุปโปรเจกต์ "ไร่อ้อย 281 ไร่ V8" (อัปเดต 1 พ.ย. 2569)

== โครงสร้าง ==
- Google Sheets = เก็บข้อมูล (25 แปลง, งาน, รถ/คน/ปั๊ม, สต็อก, ตั้งค่า)
- Apps Script = หลังบ้าน / API (ห้ามลบ)
  URL: https://script.google.com/macros/s/AKfycbzWvJ2M0C7ZHQTVTWVCFCh7ugALw9dWws9A52iYEYvpxivqWzRCN22qWa4R6mE5XcZBuA/exec
  - Code.gs: ฟังก์ชันเดิมทั้งหมด (doGet เดิมเปลี่ยนชื่อเป็น doGetOld)
    ฟังก์ชันที่หน้าเว็บเรียก: getInitialData, saveActivities, deleteActivity, updatePlotInfo,
    saveAssetEvent, transferBattery, receiveStock, saveStockItem, deleteStockItem,
    saveSettings, previewBrief, testNotify, updateMasterOption
  - Api.gs: router (สำเนาอยู่ใน GitHub: gas/Api.gs)
    • GET ?page=html → Index.html เป็น JSON (ไม่ต้องใช้รหัส)
    • GET ?fn=ชื่อ&k=รหัส หรือ POST {fn, args, k} (text/plain) → {ok, result} / {ok:false, error}
    • รหัสผิด → error ขึ้นต้นด้วย "AUTH"
    • รหัสอยู่ใน Script Properties ชื่อ API_KEY — ตั้งแล้ว 1 พ.ย. 2569 (ทดสอบแล้ว: ไม่มีรหัส = AUTH)
      (ห้ามแตะ SETUP_VER = 7.0 ที่อยู่ในหน้าเดียวกัน)
    • บล็อกฟังก์ชันที่ลงท้าย _ และ doGet, doPost, doGetOld, setupV7
  - Index.html: หน้าจอ V7 เดิม (ใช้โดย index.html บน GitHub เท่านั้น)
- GitHub Pages (beethayu/rai-oy) = หน้าบ้าน, Claude แก้และ push ได้เอง (ติดตั้ง GitHub App แล้ว)
  - index.html = แอป V7 เดิม (เปลือก ดึงหน้าจาก ?page=html)  https://beethayu.github.io/rai-oy/
  - v8.html = แอปใหม่ ไฟล์เดียวจบ เรียก API ตรง          https://beethayu.github.io/rai-oy/v8.html
    • สร้างจาก Index.html เดิม: ฟอร์ม/โมดัล/ตรรกะเดิมทั้งหมด เปลี่ยนแค่หัว, การ์ดแปลง, เมนูล่าง
    • หน้าแรก = "วันนี้" (แปลงถึงคิว + กำลังทำ), ปุ่มบันทึกงานตรงกลางเมนูล่าง → เลือกแปลง → ฟอร์มเดิม
    • ฟอนต์ IBM Plex Sans Thai, สีหลัก #1F5E3B, ส้ม = ถึงคิว, น้ำเงิน = กำลังทำ
    • จำข้อมูลล่าสุดใน localStorage (raioy_v8_data) เปิดแล้วเห็นทันที, เน็ตไม่ดีมีแถบ "ลองใหม่"
  - รหัส API จำใน localStorage (raioy_key) ใช้ร่วมกันทั้ง index.html และ v8.html
    ลิงก์ ...?k=รหัส จำรหัสให้อัตโนมัติ (ใช้ส่งให้คนงานทาง LINE)

== กฎ iOS 26 โหมดไอคอน (ห้ามเปลี่ยนกลับ) ==
1. apple-mobile-web-app-status-bar-style = default (black-translucent ทำให้ปุ่มกดไม่ติด + มีแถบเขียวล่าง)
2. ห้ามมีกล่องที่เลื่อนได้อยู่ใต้แถบสถานะ ไม่งั้น iOS ใส่เงาขาวแล้วค้าง
   - #app เริ่มที่ top: env(safe-area-inset-top), html/body ไม่เลื่อน
   - .modal และ .modal-backdrop เริ่มใต้แถบสถานะ
   - #sbar แถบเขียวทึบใต้แถบสถานะ, theme-color และพื้น html = #1F5E3B
3. ปุ่มใส่ color: inherit (iOS ระบายตัวอักษรปุ่มเป็นสีน้ำเงินเอง)
หลังเปลี่ยน meta/theme-color ต้องลบไอคอนแล้วเพิ่มใหม่

== ข้อมูลที่ควรรู้ ==
- ทั้ง 25 แปลงยังไม่มี last_water_date → ระบบเตือนคิวน้ำ/ฉีดยายังไม่ทำงาน (ด่วน = เฉพาะงานค้าง)
- P01 งานตัดอ้อยวันที่เริ่ม 15/12/2569 (อาจพิมพ์ผิด)

== วิธีทำงาน ==
- แก้หน้าตา v8 → Claude แก้ v8.html แล้ว push เอง → รอ 1–2 นาที → ปัดปิดแอปแล้วเปิดใหม่
- แก้หลังบ้าน → Claude ให้ไฟล์เต็ม → วางใน Apps Script → Deploy > จัดการ > แก้ไข > เวอร์ชันใหม่
  (Claude อ่าน Code.gs ไม่ได้ ต้องแคปหน้าจอให้ดู)
- Claude อ่านข้อมูล/หน้าจอผ่าน API ได้ ต้องอนุญาตโดเมน script.google.com และ
  script.googleusercontent.com ในการตั้งค่า > ความสามารถ (อนุญาตแล้ว)
  และต้องบอกรหัส API ให้ Claude ในแชตนั้น

== สถานะล่าสุด (1 พ.ย. 2569 19:00) ==
✅ v8.html ใช้งานได้ ทดสอบกับข้อมูลจริงแล้ว
✅ แถบเงาด้านบนบน iOS หายแล้ว (ตามกฎ iOS 26 ด้านบน)
✅ หน้าโหลด + จำข้อมูลในเครื่อง + แถบ "เน็ตไม่ดี / ลองใหม่"
✅ รหัสผ่าน API ใช้งานแล้ว ทั้ง index.html และ v8.html ถามรหัสครั้งเดียวต่อเครื่อง
✅ Claude push GitHub ได้เอง (ติดตั้ง GitHub App ให้ repo rai-oy แล้ว)
⏳ รอผู้ใช้ทดลองใช้ v8 ในไร่ แล้วเก็บสิ่งที่อยากปรับ

== ยังไม่ได้ทำ ==
- ส่งลิงก์ v8 พร้อมรหัส (?k=) ให้คนงาน
- สลับลิงก์หลักให้เปิด v8 (เมื่อใช้ v8 แล้วโอเค)
- ตั้ง GitHub → Apps Script อัตโนมัติ (clasp) ต้องใช้คอมพิวเตอร์
