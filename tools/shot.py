"""เรนเดอร์แอปจริงเป็นรูป (iPhone 390×844) ด้วยข้อมูลจริงที่ดึงเก็บไว้ — ใช้ "ทำให้ดูก่อน" และเทสต์ก่อน push
เตรียมครั้งแรกของแชต:
  mkdir -p /tmp/t && cd /tmp/t && npm i bootstrap@5.3.0 leaflet@1.9.4 leaflet-rotate@0.5.2
  K=<รหัส> python3 tools/api.py getInitialData '[]' /tmp/data.json
ใช้:  python3 tools/shot.py /tmp/data.json /tmp/out "openFlow('อ้อยตอ')" "SHOT flow" "SCROLL #flowModal .modal-body 800" "SHOT flow2"
คำสั่ง: SHOT ชื่อ = ถ่าย /tmp/out_ชื่อ.png · SCROLL <css> <px> · WAIT <ms> · PRINT <js> = พิมพ์ค่า · อื่น ๆ = รัน JS ในหน้า
API ถูก mock: getInitialData คืนไฟล์ข้อมูล · ฟังก์ชันอื่นคืน null (ไม่เขียนชีตจริง) → error "reading 'flows' of null" จาก mock ไม่ต้องสนใจ
หน้าหลักเลื่อนที่ window ไม่ใช่ #app · หน้าต่างเลื่อนที่ '#<id> .modal-body'"""
import json, subprocess, sys, time, os
from playwright.sync_api import sync_playwright
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); NM = '/tmp/t/node_modules'
data, out, cmds = sys.argv[1], sys.argv[2], sys.argv[3:]
srv = subprocess.Popen(['python3', '-m', 'http.server', '8766'], cwd=R, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
CDN = {'bootstrap.min.css': 'bootstrap/dist/css/bootstrap.min.css', 'bootstrap.bundle.min.js': 'bootstrap/dist/js/bootstrap.bundle.min.js', 'leaflet-rotate.js': 'leaflet-rotate/dist/leaflet-rotate.js', 'leaflet.min.css': 'leaflet/dist/leaflet.css', 'leaflet.min.js': 'leaflet/dist/leaflet.js'}
def cdn(route):
    for k, v in CDN.items():
        if route.request.url.endswith(k): return route.fulfill(path=f'{NM}/{v}')
    route.fulfill(status=200, body='')
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); c = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        D = open(data, encoding='utf-8').read()
        mock = lambda fn: D if fn == 'getInitialData' else (open(f'/tmp/mock_{fn}.json').read() if os.path.exists(f'/tmp/mock_{fn}.json') else 'null')  # /tmp/mock_<fn>.json = ผลจำลองของฟังก์ชันอื่น
        pg.route('https://script.google.com/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"ok":true,"result":' + mock(json.loads(r.request.post_data or '{}').get('fn')) + '}'))
        pg.route('https://api.open-meteo.com/**', lambda r: r.fulfill(status=500, body=''))
        for h in ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com']: pg.route(f'https://{h}/**', cdn)
        pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body=''))
        pg.add_init_script("localStorage.setItem('raioy_key','x');localStorage.setItem('raioy_leafseed2','1')")
        pg.goto('http://localhost:8766/index.html'); pg.wait_for_function("typeof gData!=='undefined' && gData && gData.plots && gData.plots.length>0", timeout=30000); pg.wait_for_timeout(1500)
        for cmd in cmds:
            if cmd.startswith('SHOT '): pg.screenshot(path=f'{out}_{cmd[5:].strip()}.png')
            elif cmd.startswith('SCROLL '): sel, px = cmd[7:].rsplit(' ', 1); pg.evaluate("([s,y])=>{document.querySelector(s).scrollTop=y}", [sel, int(px)])
            elif cmd.startswith('WAIT '): pg.wait_for_timeout(int(cmd[5:]))
            elif cmd.startswith('PRINT '): print(pg.evaluate(cmd[6:]))
            else: pg.evaluate(cmd)
            pg.wait_for_timeout(500)
        print('ERR', errs); b.close()
finally:
    srv.terminate()
