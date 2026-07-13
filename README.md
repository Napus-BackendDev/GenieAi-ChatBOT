# GenieAI - ผู้ช่วยธุรกิจอัจฉริยะแบบ Multi-tenant SaaS (AI Business Assistant)

GenieAI คือระบบผู้ช่วยธุรกิจอัจฉริยะ (AI Business Assistant) สำหรับผู้ประกอบการร้านค้าและสถานบริการต่าง ๆ (เช่น คลินิกทันตกรรม ร้านสปา ร้านเสริมสวย) โดยระบบจะรับคู่มือหรือเอกสารการให้บริการ (PDF/TXT/MD) มาประมวลผลเพื่อสร้าง AI Chatbot ตอบคำถามลูกค้า และทำรายการจองนัดหมายคิวแบบเรียลไทม์โดยอัตโนมัติผ่าน LINE OA รวมถึงมีหน้าระบบควบคุมสำหรับแอดมิน (Admin Dashboard) ในการควบคุม จัดการคิว และคุยแบบ Live Chat

---

## 🌟 ฟีเจอร์เด่นของระบบ (Key Features)

1. **Hybrid Context Engine (RAG + CAG)**:
   * **CAG Mode (Context-As-Generator)**: หากคู่มือร้านมีขนาดเล็ก (ไม่เกิน 15,000 tokens) ระบบจะนำข้อมูลทั้งหมดป้อนเข้าสู่ Prompt ของ LLM โดยตรงเพื่อให้ตอบคำถามได้ถูกต้องแม่นยำ 100%
   * **RAG Mode (Retrieval-Augmented Generation)**: หากคู่มือร้านมีขนาดใหญ่ ระบบจะค้นหาข้อมูลจากเวกเตอร์ (ChromaDB) และดึงส่วนที่เกี่ยวข้องที่สุด 5 ส่วนมาประกอบการตอบคำถาม
2. **LINE OA Integration (Multi-Bubble & Typing Jitter)**:
   * **AIS-style Human Pacing**: จำลองการพิมพ์และการหน่วงเวลาของแชตบอตบับเบิ้ลละ 2-4 วินาที ให้เหมือนมนุษย์จริงตอบคำถาม
   * **Flex Message Carousel**: ส่งภาพโปรโมชันแบบภาพสไลด์ตามแคมเปญของร้านได้อย่างสวยงาม
   * **Silent Human Handover**: ระบบจะหยุดตอบอัตโนมัติเมื่อผู้ใช้ส่ง Emoji โดยจะแจ้งเตือน (Alert) แอดมินใน Dashboard ทันทีเพื่อให้แอดมินเข้ามาคุยสดแทนบอต
3. **Smart Scheduling & Booking System**:
   * **Deterministic Thai Schedule Parser**: ตรรกะตรวจเช็ควันเวลาทำงานของช่าง/แพทย์เฉพาะทาง รองรับรูปแบบเวลาไทย (เช่น พฤหัส–อาทิตย์, สัปดาห์ที่ 2,4) ทำให้การเลือกแพทย์และจองคิวมีความแม่นยำ ไม่สับสน
   * **Conflict Guard**: ป้องกันการจองซ้อนของแพทย์แต่ละท่านในระยะเวลา 30 นาที และตรวจสอบสิทธิ์การเข้าใช้งานแบบ Multi-tenant
4. **Premium Admin Dashboard UI**:
   * ดีไซน์ระดับพรีเมียมด้วยธีม **Glassmorphic** (ผสมผสานระหว่างสี Navy `#1A365D` และ Cyan Glow) พัฒนาด้วย React 19 + HeroUI + Tailwind CSS v4
   * **Bookings Manager**: ปฏิทินแสดงคิวงานของแพทย์แต่ละท่านแบบแยกหมวดหมู่
   * **Document Manager**: ระบบจัดการคู่มือ ความเชี่ยวชาญ และค่าบริการของพนักงาน
   * **Line Chat Manager**: หน้าระบบตอบแชตลูกค้าจริง พร้อมระบบแจ้งเตือนกรณีลูกค้าต้องการคุยกับเจ้าหน้าที่ (Requires Human Intervention)

---

## 📂 โครงสร้างโฟลเดอร์โปรเจกต์ (Project Directory)

```text
GenieAI/
├── backend/
│   ├── app/
│   │   ├── core/              # การเชื่อมต่อฐานข้อมูล & คอนฟิก (Redis, MongoDB)
│   │   ├── models/            # โมเดลข้อมูล Pydantic สำหรับกรอง Input
│   │   ├── routers/           # API Endpoints (auth, bookings, chat, webhooks)
│   │   ├── services/          # ตรรกะคำนวณ (booking_service, openai_service, rag, schedule)
│   │   └── main.py            # จุดเริ่มต้นแอป FastAPI
│   ├── data/                  # ไฟล์เก็บข้อมูลท้องถิ่น JSON และ ChromaDB (Git Ignored)
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/        # ส่วนประกอบของ UI ที่นำกลับมาใช้ใหม่ (เช่น Sidebar)
│   │   ├── pages/             # หน้าการแสดงผลหลัก (Bookings, Chat, Dashboard)
│   │   └── index.css          # การปรับแต่งธีม Glassmorphism
│   ├── package.json
│   └── vite.config.js
│
├── docs/                      # เอกสารสถาปัตยกรรมระบบ
├── System.md                  # ข้อกำหนดสเปกและสถาปัตยกรรมโดยละเอียด
└── start.bat                  # สคริปต์คลิกเดียวสำหรับเปิดใช้งานระบบ (One-click Launcher)
```

---

## 🛠️ วิธีการติดตั้งและรันระบบ (Setup & Running)

### วิธีรันด้วย Quick Launcher (สำหรับผู้ใช้งานทั่วไป)
ดับเบิลคลิกที่ไฟล์ `start.bat` ที่โฟลเดอร์หลักของโปรเจกต์ ระบบจะทำการติดตั้งแพ็กเกจของ Python, รันคำสั่ง `npm install` และเริ่มการทำงานของ Server ทั้งฝั่งหลังบ้านและหน้าบ้านพร้อมกันในหน้าต่างเดียว พร้อมเปิดบราวเซอร์ให้อัตโนมัติ

---

### วิธีการติดตั้งและรันแบบทีละส่วน (Manual Setup)

#### 1. การติดตั้งฝั่ง Backend (FastAPI + Python 3.11)
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # สำหรับ Windows
pip install -r requirements.txt
```
ทำการสร้างไฟล์ `.env` ที่โฟลเดอร์ `backend/` และระบุคีย์ดังนี้:
```env
OPENAI_API_KEY=your_openai_key
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
LINE_CHANNEL_SECRET=your_line_secret
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_key
CORS_ORIGINS=http://localhost:5173
```
จากนั้นรัน Backend Server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. การติดตั้งฝั่ง Frontend (React 19 + Vite 8 + Tailwind v4)
```bash
cd frontend
npm install
npm run dev
```
ระบบจะเปิดใช้งาน Dev Server ที่ตำแหน่ง `http://localhost:5173`

---

## 🔒 นโยบายความปลอดภัยของ Repository (Security & Secrets)

โปรเจกต์นี้ได้รับการตั้งค่าในไฟล์ `.gitignore` เพื่อป้องกันไม่ให้ข้อมูลที่สำคัญถูกอัปโหลดขึ้น GitHub อย่างเข้มงวด:
* **ไฟล์ความลับและคอนฟิก**: `.env` และไฟล์ `.env.*` ทั้งฝั่งหลังบ้านและหน้าบ้านจะไม่ถูกอัปโหลด
* **ข้อมูลผู้ใช้และการจอง (PII)**: ข้อมูลทั้งหมดในโฟลเดอร์ `backend/data/` (เช่น ข้อมูลคนไข้ คิวการจอง คีย์ข้อมูลร้าน) จะถูกล็อกไม่ให้ตามแทร็ก
* **ข้อมูลปัญญาประดิษฐ์ในเครื่อง (AI States)**: โฟลเดอร์ของ `.claude/` และ `.antigravity/` รวมถึงข้อมูลกฎส่วนตัวทั้งหมดจะไม่ถูกดึงขึ้นระบบ
