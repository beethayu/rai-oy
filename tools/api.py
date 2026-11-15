"""เรียก API ของแอป (Apps Script) จาก workspace · รหัสเข้าแอปใส่ผ่าน env K (ขอจากผู้ใช้ในแชต ห้ามเขียนลงไฟล์/commit)
ใช้: K=<รหัส> python3 tools/api.py getInitialData '[]' /tmp/data.json
     K=<รหัส> python3 tools/api.py chatParse '["ข้อความ", {"today":"2026-11-15","plots":[]}]' /tmp/out.json
ระวัง: ฟังก์ชันที่เขียนข้อมูล (importHistory, removeHistoryImport, saveFlowAns …) ลงชีตจริงทันที → ดึง getInitialData เก็บสำรองก่อนทุกครั้ง
       removeHistoryImport ต้องส่ง args ซ้อน [["P01","P02"]]"""
import json, os, sys, urllib.request
import re
U = re.search(r"https://script\.google\.com/macros/s/[^'\"]+/exec", open(os.path.join(os.path.dirname(__file__), '..', 'index.html'), encoding='utf-8').read()).group(0)
def call(fn, args=None):
    body = json.dumps({"fn": fn, "args": args or [], "k": os.environ["K"]}).encode()
    req = urllib.request.Request(U, data=body, headers={"Content-Type": "text/plain;charset=utf-8"})
    j = json.loads(urllib.request.urlopen(req, timeout=300).read())
    if not j.get("ok"): raise SystemExit(j)
    return j["result"]
if __name__ == "__main__":
    d = call(sys.argv[1], json.loads(sys.argv[2]) if len(sys.argv) > 2 else [])
    json.dump(d, open(sys.argv[3] if len(sys.argv) > 3 else '/tmp/out.json', 'w'), ensure_ascii=False)
    print('ok', sys.argv[1])
