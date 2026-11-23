# ส่งโค้ดให้ Gemini รีวิว (เรียกจาก .github/workflows/gemini-review.yml)
# FILES = "index.html:8682-9915 PROJECT.md"  (path หรือ path:เริ่ม-จบ คั่นด้วยเว้นวรรค)
# ASK   = โจทย์ที่อยากให้ดูเป็นพิเศษ · MODELS = รายชื่อรุ่น คั่นด้วยจุลภาค (ลองตามลำดับ)
import json, os, sys, time, urllib.request, urllib.error

key = os.environ.get('GEMINI_API_KEY', '').strip()
if not key:
    sys.exit('ไม่มี GEMINI_API_KEY ใน Secrets')
files = os.environ.get('FILES', '').split()
ask = os.environ.get('ASK', '').strip()
models = [m.strip() for m in os.environ.get('MODELS', '').split(',') if m.strip()]
out = os.environ.get('OUT', 'review.md')

parts = []
for spec in files:
    path, _, rng = spec.partition(':')
    lines = open(path, encoding='utf-8').read().split('\n')
    a, b = 1, len(lines)
    if rng:
        a, b = (int(x) for x in rng.split('-'))
    body = '\n'.join(f'{i}| {lines[i-1]}' for i in range(a, min(b, len(lines)) + 1))
    parts.append(f'===== ไฟล์ {path} บรรทัด {a}-{b} (เลขหน้า | คือเลขบรรทัดจริง) =====\n{body}')

prompt = f"""คุณคือผู้รีวิวโค้ดอาวุโส ช่วยรีวิวโค้ดเว็บแอปมือถือ (iPhone, เปิดเป็นแอปจากหน้าจอโฮม iOS 26) ด้านล่าง
แอปนี้: GitHub Pages + Google Apps Script + Google Sheets ผู้ใช้เป็นเจ้าของไร่อ้อย ใช้มือเดียวบนมือถือ

โจทย์เฉพาะรอบนี้: {ask or 'หาบั๊ก จุดเสี่ยง และจุดที่ใช้งานบนมือถือยาก'}

กติกาคำตอบ:
- ภาษาไทยทั้งหมด กระชับ ไม่เขียนโค้ดใหม่ทั้งไฟล์
- เรียงจากร้ายแรงสุด แบ่งหัวข้อ: 🔴 บั๊กจริง / 🟠 เสี่ยงหรือพังบางกรณี / 🟡 ใช้งานยาก (UX) / ⚪ เล็กน้อย
- ทุกข้อต้องมี: เลขบรรทัด · เกิดอะไร (สถานการณ์จริงที่ทำให้พัง) · แก้ยังไง (สั้น ๆ ระบุชื่อฟังก์ชัน/ตัวแปร)
- ห้ามเดา ถ้าไม่แน่ใจเพราะไม่เห็นโค้ดส่วนอื่น ให้เขียน "(ต้องเช็กโค้ดส่วนอื่น)"
- ไม่เกิน 25 ข้อ ข้อที่ไม่สำคัญตัดทิ้ง
- ปิดท้ายด้วย "สรุป 3 ข้อที่ควรแก้ก่อน"

{chr(10).join(parts)}"""

def call(model):
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
    data = json.dumps({'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
                       'generationConfig': {'temperature': 0.3}}).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=600) as r:
        j = json.load(r)
    return ''.join(p.get('text', '') for p in j['candidates'][0]['content']['parts'])

def list_models():
    try:
        with urllib.request.urlopen(f'https://generativelanguage.googleapis.com/v1beta/models?key={key}&pageSize=200', timeout=30) as r:
            return [m['name'].split('/')[-1] for m in json.load(r).get('models', [])
                    if 'generateContent' in m.get('supportedGenerationMethods', [])]
    except Exception:
        return []

avail = list_models()
print('รุ่นที่ใช้ได้:', ', '.join(m for m in avail if m.startswith('gemini')))
if avail:
    # ชื่อที่ไม่มีจริง → ลองหาชื่อที่ขึ้นต้นเหมือนกัน (เช่น gemini-3.1-pro → gemini-3.1-pro-preview)
    fixed = []
    for m in models:
        if m in avail: fixed.append(m)
        else: fixed += [a for a in avail if a.startswith(m + '-') and 'image' not in a and 'tts' not in a][:1]
    models = fixed or models

text, used, trace = None, None, []
for m in models:
    for attempt in range(4):
        try:
            t0 = time.time()
            text, used = call(m), m
            trace.append(f'{m} ok {int(time.time()-t0)}s')
            break
        except urllib.error.HTTPError as e:
            trace.append(f'{m} HTTP {e.code}')
            if e.code in (400, 403, 404) or (e.code == 429 and 'PerDay' in e.read().decode('utf-8', 'ignore')):
                break
            time.sleep(15 * (attempt + 1))  # 503 ไม่ว่าง: รอ 15/30/45 วิ
        except Exception as e:
            trace.append(f'{m} {type(e).__name__}')
            time.sleep(3)
    if text:
        break

print('trace:', ' · '.join(trace))
if not text:
    sys.exit('Gemini ไม่ตอบทุกรุ่น')
head = f"# รีวิวโดย Gemini ({used})\n\n- ไฟล์: {' '.join(files)}\n- โจทย์: {ask or '-'}\n\n"
open(out, 'w', encoding='utf-8').write(head + text.strip() + '\n')
print('เขียนผลแล้ว', len(text), 'ตัวอักษร')
