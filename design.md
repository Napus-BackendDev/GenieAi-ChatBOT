# GenieAI — UI/UX Design Document

> Last updated: 2026-06-09 (Checkpoint: LINE Chatbot + Flex Message + Multi-bubble)

---

## 1. Product Vision

GenieAI เป็น **AI Business Assistant แบบ SaaS** สำหรับเจ้าของธุรกิจขนาดเล็ก-กลาง เช่น ร้านทำผม, คลินิกความงาม, ร้านอาหาร

เจ้าของร้านอัปโหลดคู่มือบริการ → AI สร้าง chatbot อัตโนมัติ → ลูกค้าแชทถามข้อมูล + จองนัดหมาย ผ่าน LINE, Facebook Messenger, หรือ Web Chat

**Target Users:**
- **Admin (เจ้าของร้าน):** ใช้ Dashboard จัดการข้อมูลร้าน, ดูนัดหมาย, ทดสอบ AI
- **End-user (ลูกค้า):** แชทกับ AI ผ่าน LINE/Messenger/Web เพื่อสอบถามข้อมูลและจองนัด

---

## 2. Tech Stack (Frontend)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2 |
| Build Tool | Vite | 8.0 |
| CSS | Tailwind CSS | v4.3 |
| UI Library | HeroUI | v3.1 |
| Icons | Lucide React | 1.17 |
| Animation | Framer Motion | 12.40 |
| Font | Outfit (Google Fonts) | 300-700 |

---

## 3. Design System

### 3.1 Color Palette & System Patterns

ระบบใช้สีหลัก สีรอง และสีเน้นย้ำที่กำหนดเฉพาะเพื่อความสม่ำเสมอทั่วทั้งระบบ (Consistency Across All Frontend Modules):

#### 1) Primary Colors (สีหลักสำหรับการแสดงผลกราฟิกและพื้นหลัง)
- **`#E6F4F8`**: ใช้เป็นพื้นหลังไอคอนกราฟิกหลัก (Icon Graphic Backgrounds) 
- **`#A2D9E8`**: ใช้เป็นพื้นหลังไอคอนกราฟิกหลักและส่วนเน้นของงานกราฟิก
- **`#FFFFFF`**: ใช้เป็นสีพื้นหลังการแสดงผลทั่วไป บอร์ดการ์ด และช่องป้อนข้อความ (Text Input Fields) เพื่อความสะอาดตา

#### 2) Secondary Colors (สีรองสำหรับตัวอักษรและเส้นขอบโครงสร้าง)
- **`#1A365D`** (Navy เข้ม): ใช้สำหรับหัวข้อความ (Headers/Titles), ตัวหนังสือหลัก (Primary Text) และเส้นกรอบโครงสร้างหลักของระบบ
- **`#2B6CB0`** (Blue สว่าง): ใช้สำหรับหัวข้อย่อย, ตัวอักษรลิงก์/เน้นความสำคัญ และเส้นกรอบที่ต้องการการตอบสนอง

#### 3) Accent Colors (สีเน้นย้ำสถานะระบบ)
- **`#E53E3E`** (Red): สีแดงเน้นปัญหา ความผิดพลาด หรือสถานะที่ต้องการการแก้ไขอย่างด่วน
- **`#38A169`** (Green): สีเขียวเน้นผลลัพธ์ที่ดี (Success) สถานะเชื่อมต่อสำเร็จ หรือการยืนยันข้อมูลเสร็จสิ้น ✅

> [!IMPORTANT]
> ระบบ Frontend ทั้งหมดรวมถึงหน้าจอแดชบอร์ด แผงตั้งค่า ปฏิทินจอง และระบบกล่องแชตทดสอบ ต้องยึดสีตามโครงสร้าง Priority นี้เป็นหลักในการตกแต่งองค์ประกอบ UI ต่าง ๆ


### 3.2 Visual Style — Glassmorphism

```css
.glass-panel {
  backdrop-filter: blur(16px);
  background: rgba(0, 0, 0, 0.2);       /* dark */
  background: rgba(255, 255, 255, 0.6);  /* light */
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

ใช้ glass-panel เป็นพื้นฐานของทุก Card, Sidebar, Modal เพื่อให้ได้ feel ที่ premium และ modern

### 3.3 Typography

```
Font Family:  "Outfit", sans-serif
Heading:      font-semibold / font-bold, text-xl ~ text-3xl
Body:         font-normal, text-sm ~ text-base
Caption:      text-xs, text-default-400
Badge:        text-[10px] ~ text-[11px], uppercase, tracking-wider
```

### 3.4 Spacing & Layout

```
Sidebar:       260px fixed width, sticky top-0
Main Content:  padding 40px, overflow-y auto, max-height 100vh
Grid:          grid-template-columns: 260px 1fr
Card Gap:      gap-4 ~ gap-6
Section Gap:   gap-8 ~ gap-10
```

### 3.5 Animations & Interactions

| Class | Effect | Duration |
|-------|--------|----------|
| `.hover-scale` | translateY(-2px) + scale(1.01) | 300ms ease |
| `.animate-fade-in` | opacity 0→1 + translateY(10px→0) | 400ms ease |
| `.pulse-ring` | Box-shadow pulse (indigo) | 2s infinite |
| `.pulse-ring-success` | Box-shadow pulse (emerald) | 2s infinite |
| `.glow-indigo-cyan` | Hover glow shadow (indigo+cyan) | on hover |
| `.glow-emerald` | Hover glow shadow (emerald) | on hover |
| `animate-scanline` | Vertical scan line (loading effect) | 2.5s linear infinite |

### 3.6 Theme System

- Toggle: Light (สว่าง) / Dark (มืด) ใน Sidebar
- Persistence: `localStorage('genie_ai_theme')`
- Implementation: `.light` / `.dark` class บน `<html>`
- HeroUI + Tailwind auto-adapt ตาม class

### 3.7 Golden Standard Layout Pattern (รูปแบบโครงสร้างหน้ามาตรฐาน)

หน้าจอหลักทั้งหมดใน Dashboard ควรกำหนดโครงสร้างตามรูปแบบมาตรฐานที่สมบูรณ์แบบ (Golden Standard) ดังต่อไปนี้ เพื่อความเป็นเอกภาพทั่วทั้งเว็บไซต์:

#### 1) Page Wrapper (กรอบครอบหน้า)
* คลาสพื้นฐาน: `animate-fade-in text-left flex flex-col gap-8 p-6 md:p-8 w-full max-w-full`

#### 2) Page Header Section (หัวข้อหน้าควบคุมหลัก)
* รูปแบบโครงสร้าง:
  ```jsx
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <div>
      <h2 className="text-2xl font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2">
        <PageIcon size={22} className="text-[#2B6CB0] dark:text-cyan-400" />
        <span>{t.title}</span>
      </h2>
      <p className="text-xs text-[#2B6CB0] font-semibold mt-1">
        {t.subtitle}
      </p>
    </div>
    {/* ปุ่มควบคุมขวาบน (ถ้ามี) */}
    <Button className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-11 px-5 shadow-md shadow-cyan-500/20 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-2">
      <Plus size={16} />
      <span>{t.addBtn}</span>
    </Button>
  </div>
  ```

#### 3) Search & Filter Row (แถวเครื่องมือค้นหาและกรอง)
* วางใต้ Header ถัดลงมาในระดับเดียวกัน โดยใช้คอนโทรลแบบกระจายตามความเหมาะสม:
  - ช่องค้นหา (Search Input Box) ความสูง `h-11` ขอบมน `rounded-2xl`
  - กล่องเลือกแบบย่อย (CustomSelect/Filter Dropdowns) ความสูง `h-11` ขอบมน `rounded-2xl`
* คลาสพื้นฐาน: `flex flex-wrap gap-4 w-full items-center`

#### 4) Grid & Card Layout (ส่วนแสดงการ์ดรายการ)
* แสดงผลเป็นการ์ดแก้วโปร่งแสง (`glass-panel`) วางเรียงต่อกันในระบบกริด:
  - กริดคลาส: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6` (หรือ 4 คอลัมน์/สไลเดอร์แนวนอนขึ้นอยู่กับหน้า)
  - คาร์ดคลาส: `glass-panel border-white/5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between group hover:scale-[1.01]`
  - คอนเทนเนอร์แสดงเวลา/ไฮไลต์ย่อยภายในคาร์ด: ใช้กรอบสีเขียวโปร่งแสงขอบมน `p-3 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 rounded-xl` เพื่อเน้นย้ำ

---

## 4. Application Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  AuthPage   │ ──→ │ OnboardingUpload │ ──→ │    Dashboard    │
│  (Login)    │     │ (Upload + Verify)│     │  (Main App)     │
└─────────────┘     └──────────────────┘     └─────────────────┘
                                                     │
                                              ┌──────┼──────┐
                                              │      │      │
                                              ▼      ▼      ▼
                                          Overview  Docs  Bookings  Chat
```

### 4.1 Navigation Model

- ไม่ใช้ React Router — ใช้ `activeTab` state ใน App.jsx
- Sidebar เป็น persistent navigation (ซ้ายมือ)
- 4 แท็บหลัก: หน้าภาพรวม / คู่มือ&บริการ / นัดหมายลูกค้า / กล่องทดสอบแชต

---

## 5. Page Designs — Current State

### 5.1 AuthPage

```
┌──────────────────────────────────────┐
│           ┌─────────────┐            │
│           │  🏪 Logo    │            │
│           │  GenieAI    │            │
│           │  Assistant  │            │
│           ├─────────────┤            │
│           │ [เข้าสู่ระบบ│สมัคร]     │
│           ├─────────────┤            │
│           │ Email       │            │
│           │ [________]  │            │
│           │ Phone       │            │
│           │ [________]  │            │
│           │             │            │
│           │ [เข้าสู่ระบบ →]         │
│           │─────────────│            │
│           │ หรือเชื่อมต่อผ่าน       │
│           │ [G Google]  │            │
│           └─────────────┘            │
└──────────────────────────────────────┘
```

**Features:**
- Login/Signup toggle tabs
- Email + Phone authentication (mock, no password)
- Google mock OAuth button
- New user → Questionnaire (ชื่อร้าน + ประเภทธุรกิจ)
- Glass card centered on page

---

### 5.2 OnboardingUpload

```
Step Indicator: ──●──────────●──────────●──
                Upload     Parsing     Verify

┌──────────────────────────────────────┐
│  Step 1: Upload                      │
│  ┌──────────────────────────────┐    │
│  │     📄 ลากไฟล์มาวางที่นี่      │    │
│  │     PDF, TXT, MD             │    │
│  │     [เลือกไฟล์]              │    │
│  └──────────────────────────────┘    │
│                                      │
│  Step 2: AI Parsing (animated logs)  │
│  > กำลังอ่านเอกสาร...               │
│  > วิเคราะห์บริการและราคา...          │
│  > สร้างโครงสร้างข้อมูล...           │
│                                      │
│  Step 3: Verify & Edit              │
│  ชื่อร้าน: [เสน่ห์เกศา________]     │
│  เวลาทำการ: [09:00-20:00_____]     │
│  Services:                          │
│  ┌────────┬───────┬─────────┐       │
│  │ ตัดผม  │ 500   │ 45 นาที │ 🗑    │
│  │ ทำสี   │ 1500  │ 120 นาที│ 🗑    │
│  └────────┴───────┴─────────┘       │
│  [+ เพิ่มบริการ]                     │
│                                      │
│  [ยืนยันและเข้าสู่ Dashboard →]     │
└──────────────────────────────────────┘
```

**Features:**
- 3-step progress indicator
- Drag & drop file upload (PDF/TXT/MD)
- Animated AI processing logs (simulated)
- Editable extracted data (company, hours, services)
- Service CRUD (add/edit/remove with validation)

---

### 5.3 Dashboard — Overview

```
┌───────┬─────────────────────────────────────┐
│       │  หน้าภาพรวม                          │
│  S    │                                     │
│  I    │  ┌─────────┐┌─────────┐┌─────────┐  │
│  D    │  │📅 12    ││📄 2     ││⚡ Active │  │
│  E    │  │Bookings ││Documents││Webhook  │  │
│  B    │  └─────────┘└─────────┘└─────────┘  │
│  A    │                                     │
│  R    │  LINE Webhook URL                   │
│       │  ┌──────────────────────────┐       │
│  ──── │  │ https://xxx.ngrok.dev/..│ [📋]  │
│  🏪   │  └──────────────────────────┘       │
│  ร้าน │                                     │
│       │  นัดหมายล่าสุด                       │
│  ──── │  ┌──────┬──────┬──────┬──────┐      │
│  ภาพรวม│  │ชื่อ   │บริการ │โทร   │วันเวลา│      │
│  คู่มือ │  ├──────┼──────┼──────┼──────┤      │
│  นัดหมาย│  │สมศักดิ์│สระไดร์│089..  │5 มิ.ย.│      │
│  แชต   │  │ปลิ้ม  │ตัดผม │080..  │3 มิ.ย.│      │
│       │  └──────┴──────┴──────┴──────┘      │
│  ──── │                                     │
│  🌙/☀️│                                     │
│  user │                                     │
│ [ออก] │                                     │
└───────┴─────────────────────────────────────┘
```

**Features:**
- 3 Stat cards with gradient icons + glow effects
- Webhook URL panel with copy-to-clipboard
- Recent bookings table (last 5)
- Thai date locale formatting

---

### 5.4 Dashboard — คู่มือ & บริการ (DocumentManager)

```
┌──────────────────────────────────────┐
│  [แก้ไขโปรไฟล์ | จัดการไฟล์]  ← tabs │
│                                      │
│  ── แก้ไขโปรไฟล์ ──                  │
│  ชื่อร้าน: [______________]          │
│  เวลาทำการ: [______________]         │
│  เบอร์ติดต่อ: [______________]        │
│                                      │
│  รายการบริการ:                        │
│  ┌──────────┬──────┬────────┐        │
│  │ ตัดผม    │ 500  │ 45 นาที│ 🗑     │
│  │ ทำสี     │ 1500 │ 120นาที│ 🗑     │
│  │ สระไดร์   │ 300  │ 30 นาที│ 🗑     │
│  └──────────┴──────┴────────┘        │
│  [+ เพิ่มบริการ]  [💾 บันทึก]         │
│                                      │
│  ── จัดการไฟล์ ──                     │
│  📄 business_rules.txt    (2 หน้า) 🗑 │
│  📄 sample_shop_rules.md  (1 หน้า) 🗑 │
│  [📤 อัปโหลดเอกสารใหม่]              │
└──────────────────────────────────────┘
```

---

### 5.5 Dashboard — นัดหมายลูกค้า (BookingsManager)

```
┌──────────────────────────────────────────┐
│  นัดหมายลูกค้า                            │
│                                          │
│  ┌──────────────────┬───────────────────┐│
│  │   มิถุนายน 2026   │  วันจันทร์ 9 มิ.ย. ││
│  │  [<]  [>]        │                   ││
│  │  จ อ พ พ ศ ส อา   │  [ทั้งหมด│กำลังมา]  ││
│  │  1  2  3  4  5    │  🔍 [___________] ││
│  │  6  7  8 ⑨ 10   │                   ││
│  │  11 12 13 14 15   │  ┌─────────────┐  ││
│  │  16 17 18 19 20   │  │ สมศักดิ์      │  ││
│  │  21 22 23 24 25   │  │ 📞 089-123.. │  ││
│  │  26 27 28 29 30   │  │ ✂️ สระไดร์    │  ││
│  │                   │  │ 🕐 14:00     │  ││
│  │  ● = มีนัด        │  │ [ยกเลิก]     │  ││
│  │                   │  └─────────────┘  ││
│  └──────────────────┴───────────────────┘│
└──────────────────────────────────────────┘
```

**Features:**
- Interactive calendar with booked-day indicators
- Prev/Next month navigation
- Daily booking list panel (right side)
- Filter: upcoming / past / all
- Search by name, phone, service
- Cancel booking (future only)

---

### 5.6 Dashboard — กล่องทดสอบแชต (ChatSandbox)

```
┌──────────────────────────────────────────┐
│  กล่องทดสอบแชต                            │
│                                          │
│  ┌──────────────────┬───────────────────┐│
│  │   Chat           │   AI Diagnostics  ││
│  │                  │                   ││
│  │  🤖 สวัสดีค่ะ     │  Mode: CAG ✅     ││
│  │     ยินดีต้อนรับ   │  (Full Context)   ││
│  │                  │                   ││
│  │        สวัสดีครับ 👤│  Citations:       ││
│  │                  │  📄 rules.txt p1  ││
│  │  🤖 ร้านเรามี...  │  📄 shop.md p1    ││
│  │     ตัดผม 500    │                   ││
│  │     ทำสี 1500    │  Images:          ││
│  │                  │  [🖼] [🖼]         ││
│  │                  │                   ││
│  │  ┌────────────┐  │                   ││
│  │  │ พิมพ์ข้อความ│▶│                   ││
│  │  └────────────┘  │                   ││
│  └──────────────────┴───────────────────┘│
└──────────────────────────────────────────┘
```

**Features:**
- Split view: Chat (left) + Diagnostics (right)
- Message bubbles (user/assistant)
- Auto-scroll on new messages
- Diagnostics: RAG/CAG mode, citations, images
- Initial welcome message

---

## 6. Planned UI Improvements

### 6.1 Priority 1 — Quick Wins

| Item | Description | Effort |
|------|------------|--------|
| Styled Confirm Modal | แทน `window.confirm()` ด้วย glass modal + animation | S |
| Loading Skeletons | แทน spinner ด้วย skeleton shimmer per-component | S |
| Toast Notifications | ระบบ toast สำหรับ success/error/info ทั่วทั้ง app | S |
| Error Boundary | Catch component crashes แสดง fallback UI | S |
| Search Debounce | BookingsManager search debounce 300ms | XS |

### 6.2 Priority 2 — Feature Enhancements

| Item | Description | Effort |
|------|------------|--------|
| Promotion Manager | หน้าจัดการโปรโมชัน + อัปโหลดรูปโปรโมชัน ใน DocumentManager | M |
| Staff Manager | หน้าจัดการเจ้าหน้าที่/ช่าง + ตาราง schedule | M |
| FAQ Manager | หน้าจัดการ FAQ (เพิ่ม/ลบ/แก้ไข) | M |
| Document Preview | เปิดดูเนื้อหาเอกสารที่อัปโหลดได้ (modal with text) | S |
| Booking Creation | Admin สร้างนัดหมายเองได้จาก Dashboard | M |
| Chat History Persist | เก็บ chat history ข้าม session (ไม่หายเมื่อ refresh) | S |
| Multi-channel Stats | แสดง stats แยก LINE / Facebook / Web | M |

### 6.3 Priority 3 — Architecture

| Item | Description | Effort |
|------|------------|--------|
| React Router | เปลี่ยนจาก tab state เป็น URL-based routing | M |
| State Management | Context API หรือ Zustand สำหรับ shared state | M |
| Custom Hook: useServices | Extract service CRUD logic ที่ซ้ำ ออกเป็น hook | S |
| Lazy Loading | React.lazy + Suspense สำหรับแต่ละหน้า | S |
| API Caching | SWR หรือ React Query สำหรับ data fetching + cache | M |
| i18n | รองรับ English + Thai | L |
| Session Expiry | Auto logout หลัง idle timeout | S |

---

## 7. Component Library

### 7.1 Shared Components (Current)

```
components/
  Sidebar.jsx          # Persistent navigation sidebar
```

### 7.2 Proposed Shared Components

```
components/
  Sidebar.jsx          # ✅ Existing
  ConfirmModal.jsx     # Styled glass modal (replace window.confirm)
  Toast.jsx            # Notification toast system
  LoadingSkeleton.jsx  # Shimmer skeleton for cards/tables
  ErrorBoundary.jsx    # Catch + fallback UI
  ServiceEditor.jsx    # Reusable service CRUD (extract from Onboarding + DocManager)
  PromoEditor.jsx      # Promotion CRUD + image upload
  StaffEditor.jsx      # Staff CRUD
  FAQEditor.jsx        # FAQ CRUD
  StatCard.jsx         # Gradient stat card (extract from DashboardOverview)
  DataTable.jsx        # Reusable table with sort/filter/pagination
  FileDropzone.jsx     # Drag-drop file upload (extract from OnboardingUpload)
  ChatBubble.jsx       # Single chat message bubble
  CalendarWidget.jsx   # Thai calendar (extract from BookingsManager)
```

---

## 8. Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 768px | Sidebar collapses to hamburger menu, single column |
| Tablet | 768px - 1024px | Sidebar overlay, 1-2 column content |
| Desktop | > 1024px | Full sidebar + multi-column content |

**Current state:** Desktop-first layout. ยังไม่มี mobile hamburger menu — Sidebar จะ overflow บน mobile.

**Planned:** Add responsive sidebar with hamburger toggle + mobile-optimized cards.

---

## 9. LINE Chat UI ↔ Admin Dashboard Connection

```
ลูกค้า (LINE App)              Admin (Dashboard)
─────────────────              ─────────────────
  "มีโปรอะไรบ้าง"        →     Webhook receives
       │                             │
       │                      AI processes + RAG/CAG
       │                             │
  ← Text bubbles              ChatSandbox mirrors
    (AIS-style pacing:         same AI logic
     "typing…" + per-         (sandbox is instant,
      bubble delay,            no pacing)
      humanize_mode)
       │
  ← Flex Carousel              (Flex not shown
    (promo images)              in sandbox yet)
       │
  "สนใจโปรนี้" (button)  →     Booking flow starts
       │
  ← "ขอชื่อ, เบอร์, อีเมล"     AI collects info
       │
  ← "จองสำเร็จ!"               BookingsManager shows
                               new booking
```

---

## 10. File Structure

```
frontend/src/
├── App.jsx                    # Root: auth flow + tab routing + theme
├── main.jsx                   # React DOM entry point
├── index.css                  # Global styles + design tokens + animations
├── components/
│   └── Sidebar.jsx            # Navigation sidebar
└── pages/
    ├── AuthPage.jsx           # Login + Signup + Questionnaire
    ├── OnboardingUpload.jsx   # File upload + AI parsing + verify
    ├── DashboardOverview.jsx  # Stats + webhook URL + recent bookings
    ├── DocumentManager.jsx    # Profile editor + document management
    ├── BookingsManager.jsx    # Calendar + booking list + filters
    └── ChatSandbox.jsx        # AI chat testing + diagnostics panel
```

---

## 11. Design Principles

1. **Glass & Glow** — ทุก surface ใช้ glassmorphism + gradient glow เพื่อ premium feel
2. **Progressive Disclosure** — ไม่แสดงทุกอย่างพร้อมกัน ค่อยๆ reveal ตาม flow
3. **Thai-First** — UI text เป็นภาษาไทยทั้งหมด ตรงกับ target audience
4. **AI-Powered Simplicity** — ซ่อน complexity ไว้เบื้องหลัง AI (ลูกค้าแค่แชท, admin แค่อัปโหลด)
5. **Real-Time Feel** — Animations, delays, typing effects ทำให้ระบบรู้สึก alive
6. **Mobile-Aware** — แม้เป็น admin dashboard (desktop-first) แต่ลูกค้าใช้มือถือ 100% (LINE)
