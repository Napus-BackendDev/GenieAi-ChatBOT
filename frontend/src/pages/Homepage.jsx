import { useState } from 'react';
import { 
  Store, Sparkles, ArrowRight, ShieldCheck, AlertCircle, Zap, Clock,
  ChevronDown, ChevronUp, Star, Check, Sun, Moon, Globe, MessageSquare, TrendingUp
} from 'lucide-react';
import { Button } from '@heroui/react';
import Mascot3D from '../components/Mascot3D';

const translations = {
  th: {
    // Header
    login: "เข้าสู่ระบบ",
    signup: "สมัครใช้งาน",
    features: "ฟีเจอร์",
    pricing: "ราคา",
    faq: "คำถามพบบ่อย",
    
    // Hero
    heroTitle: "เปลี่ยนคู่มือร้านค้า ให้เป็นเลขา AI สุดอัจฉริยะใน 1 นาที",
    heroSubtitle: "เพียงแค่อัปโหลดไฟล์คู่มือบริการ (PDF/TXT/MD) ระบบจะสร้างแชตบอตตอบคำถามลูกค้าและทำนัดจองคิวให้อัตโนมัติทาง LINE และเว็บไซต์อย่างแม่นยำ ไร้ข้อขัดแย้งเรื่องเวลา",
    heroCta: "เริ่มต้นสร้างเลขา AI ฟรี",
    heroSubCta: "ไม่ต้องใช้บัตรเครดิต • ตั้งค่าเสร็จใน 1 นาที",
    heroBadge: "ผู้ช่วย AI ร้านค้ายุคใหม่",
    dashboardCalendar: "แดชบอร์ด GenieAI - ปฏิทินนัดหมาย",
    liveSync: "ซิงก์เรียลไทม์",
    weekdays: ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."],
    calendarEvents: ["10:30 ฟอกสีฟัน", "14:00 ขูดหินปูน", "16:00 อุดฟัน"],
    dentalAssistant: "ผู้ช่วยทันตกรรม GenieAI",
    lineOfficialAccount: "บัญชี LINE Official",
    exampleChat: "ตัวอย่างบทสนทนาภาษาไทย",
    
    // Trust Badges
    trustedBy: "ได้รับความไว้วางใจจากธุรกิจชั้นนำกว่า 500+ แห่ง",
    
    // Problem & Solution
    problemTitle: "ปัญหาการจัดการร้านค้าแบบเดิมๆ",
    solutionTitle: "แก้ไขด้วยระบบอัตโนมัติจาก GenieAI",
    problem1: "แอดมินตอบแชทช้า ลูกค้าเปลี่ยนใจไปร้านอื่น",
    solution1: "ตอบกลับทันทีตลอด 24 ชั่วโมงด้วยความแม่นยำสูง",
    problem2: "จองคิวซ้ำซ้อน จัดตารางเวลาผิดพลาดบ่อยครั้ง",
    solution2: "ระบบตรวจสอบความพร้อมของคิวและทำนัดแบบไม่มีวันชนกัน",
    problem3: "ข้อมูลบริการอัปเดตยาก คู่มือร้านค้ากระจัดกระจาย",
    solution3: "แค่อัปโหลดเอกสารใหม่ ระบบ RAG/CAG จะซิงก์ข้อมูลตอบลูกค้าทันที",
    problem4: "เสียเวลาตอบคำถามเดิมๆ 4-6 ชม./วัน",
    solution4: "ย้ายงานแชตซ้ำให้ AI เพื่อให้ทีมมีเวลาดูแลลูกค้าหน้าร้านเต็มที่",
    problemAndSolutionHeader: "ทำไมต้องเปลี่ยนมาใช้ GenieAI?",
    problemAndSolutionSub: "เปรียบเทียบการทำงานเพื่อช่วยให้คุณเห็นความแตกต่างได้อย่างชัดเจน",
    comparisonBadge: "ก่อน vs หลัง",
    comparisonLabel: "เปรียบเทียบผลลัพธ์จริง",
    problemKicker: "งานยุ่งเหยิงและยอดขายที่หายไป",
    problemBadge: "เสียลูกค้าเฉลี่ย 35%",
    problem1Detail: "ลูกค้ารอเกิน 15 นาที แล้วเปลี่ยนใจทักหาคลินิกหรือร้านคู่แข่งทันที",
    problem2Detail: "การสื่อสารผิดพลาดทำให้รับคิวซ้อน เสียความน่าเชื่อถือและเวลาขอโทษลูกค้า",
    problem3Detail: "แอดมินใหม่ตอบราคาผิด จำเงื่อนไขโปรไม่ได้ และต้องคอยถามเจ้าของร้าน",
    problem4Detail: "แอดมินไม่มีเวลาโฟกัสการดูแลลูกค้าหน้าร้านหรือพัฒนาบริการอื่น",
    solutionKicker: "เติบโตอัตโนมัติด้วย AI",
    solutionBadge: "ตอบใน 1 วินาที • คิวไม่ชน 100%",
    solution1Title: "ตอบทันทีตลอด 24/7 ปิดการขายอัตโนมัติ",
    solution2Title: "ล็อกคิวอัจฉริยะ ไร้คิวชน 100%",
    solution3Title: "สกัดคู่มือด้วย RAG & CAG อัจฉริยะ",
    solution4Title: "ประหยัดเวลาแอดมิน 80% เพิ่มรายได้ทันที",

    // Features
    featuresHeader: "ฟีเจอร์เด่นเพื่อการเติบโตของธุรกิจคุณ",
    featuresSub: "รวมความสามารถอัจฉริยะที่ออกแบบมาเพื่อร้านค้าบริการโดยเฉพาะ",
    feat1Title: "วิเคราะห์ข้อมูลแบบ RAG & CAG อัจฉริยะ",
    feat1Desc: "ระบบจะปรับโหมดดึงข้อมูลตามขนาดคู่มือของคุณโดยอัตโนมัติ เพื่อการตอบคำถามที่แม่นยำ รวดเร็ว และประหยัดพลังงานที่สุด",
    feat2Title: "ทำนัดหมายอัตโนมัติ ไร้รอยต่อ",
    feat2Desc: "AI สามารถตรวจสอบคิวงาน ช่าง หรือห้องบริการที่ว่าง แล้วจองให้ลูกค้าได้ทันทีผ่านคำสั่ง AI Function Calling ป้องกันคิวชน 100%",
    feat3Title: "เชื่อมต่อ LINE Webhook ได้ในคลิกเดียว",
    feat3Desc: "เชื่อมระบบเข้ากับ LINE Official Account ของร้านคุณได้อย่างสะดวกรวดเร็ว ตอบกลับลูกค้าด้วยการแบ่ง Bubble แบบมนุษย์จริง",
    lineConnection: "การเชื่อมต่อ LINE OA",
    connected: "เชื่อมต่อแล้ว",
    active: "ใช้งานอยู่",
    ragAutopilot: "RAG และ CAG อัตโนมัติ",
    fullyAutomatic: "อัตโนมัติ 100%",
    conflictFreeLocking: "ระบบล็อกคิวไม่ให้ชน",
    syncChecked: "ตรวจสอบการซิงก์แล้ว",
    analyticsTitle: "วิเคราะห์สถิติและการจองแบบเรียลไทม์",
    analyticsDesc: "ติดตามอัตราการจองสำเร็จ การใช้งานแชตบอต และพฤติกรรมลูกค้าผ่านแดชบอร์ดที่เรียบง่ายและเข้าใจได้ทันที",
    accuracyRate: "ความแม่นยำของแชตบอต",
    totalBookings: "การจองทั้งหมด",
    avgResponseTime: "เวลาตอบเฉลี่ย",

    // Social Proof
    socialHeader: "เสียงตอบรับจากผู้ใช้งานจริง",
    socialSub: "ร่วมฟังประสบการณ์จากเจ้าของธุรกิจที่นำ GenieAI ไปยกระดับการบริการ",
    review1Name: "คุณมลธิรา เอี่ยมสะอาด",
    review1Role: "เจ้าของร้านเสน่ห์เกศา ซาลอน",
    review1Text: "ก่อนหน้านี้แอดมินตอบแชทจองคิวทำผมช้ามาก พอเปลี่ยนมาใช้ GenieAI ช่วยตอบและจองคิวผ่าน LINE ลูกค้าชมว่าตอบเร็วและจองง่ายขึ้นเยอะมากค่ะ ประหยัดเวลาไปได้วันละหลายชั่วโมงเลย",
    review2Name: "หมอเจมส์ (ทันตแพทย์)",
    review2Role: "ผู้อำนวยการคลินิกทันตกรรมสไมล์ไลฟ์",
    review2Text: "เราอัปโหลดคู่มือบริการและขั้นตอนฟอกสีฟันเข้าระบบ AI สามารถแนะนำคนไข้ได้อย่างละเอียดและกดทำนัดหมายลงตารางแพทย์ได้อย่างแม่นยำ ไม่เคยเจอเคสคิวซ้อนเลยครับ คุ้มค่ามากๆ",
    review3Name: "คุณกิตติศักดิ์ พูนศิลป์",
    review3Role: "ผู้จัดการร้านสเต็กเฮ้าส์เดอะการ์เดน",
    review3Text: "ระบบใช้งานง่ายมากครับ แค่อัปโหลดเมนูอาหารและกติกาการจองโต๊ะ เจ้าบอตก็ช่วยรับจองโต๊ะและแนะนำโปรโมชั่นได้อย่างคล่องแคล่ว แนะนำสำหรับร้านบริการทุกประเภทเลยครับ",

    // Pricing
    priceHeader: "เลือกแผนการใช้งานที่เหมาะกับคุณ",
    priceSub: "เริ่มต้นใช้งานฟรี และอัปเกรดเพื่อฟีเจอร์ที่เหนือกว่าเมื่อธุรกิจเติบโต",
    tierStart: "Start",
    tierPro: "Pro (แนะนำ)",
    tierPremium: "Premium",
    priceStart: "ฟรี",
    pricePro: "฿1,490 / เดือน",
    pricePremium: "฿3,890 / เดือน",
    startDesc: "เหมาะสำหรับร้านค้าเริ่มต้นที่ต้องการระบบเลขา AI เบื้องต้น",
    proDesc: "เหมาะสำหรับธุรกิจบริการที่ต้องการทำนัดหมายแบบไร้รอยต่อทาง LINE",
    premiumDesc: "เหมาะสำหรับธุรกิจที่มีหลายสาขาและต้องการการเชื่อมต่อขั้นสูง",
    priceFeature1: "รองรับ 1 เลขา AI ประจำร้าน",
    priceFeature2: "อัปโหลดคู่มือได้สูงสุด 2 ไฟล์",
    priceFeature3: "วิเคราะห์ข้อมูล RAG (จำกัด Token)",
    priceFeature4: "ระบบตอบคำถามเบื้องต้น (ไม่มีจองคิว)",
    priceFeature5: "เชื่อมต่อ LINE Webhook อัตโนมัติ",
    priceFeature6: "ทำนัดหมายคิวผ่าน AI Function Calling",
    priceFeature7: "รองรับคลังเอกสารขนาดใหญ่ (CAG & RAG)",
    priceFeature8: "ระบบบริหารจัดการคิวและเจ้าหน้าที่",
    priceFeature9: "ซิงก์ข้อมูลข้ามสาขา (Multi-location)",
    priceFeature10: "แดชบอร์ดสถิติวิเคราะห์เชิงลึก",
    priceFeature11: "เจ้าหน้าที่ดูแลส่วนตัวและอัปเดตระบบฟรี",
    buyBtn: "เริ่มต้นใช้งาน",
    popular: "ยอดนิยม",

    // FAQ
    faqHeader: "คำถามที่พบบ่อย (FAQ)",
    faqSub: "ข้อสงสัยที่พบบ่อยเกี่ยวกับระบบและการติดตั้ง",
    faqQ1: "ต้องมีความรู้เรื่องโค้ดดิ้งในการตั้งค่าหรือไม่?",
    faqA1: "ไม่จำเป็นเลยครับ! คุณเพียงแค่ลงทะเบียน อัปโหลดคู่มือร้านค้าที่เป็นไฟล์เอกสาร PDF, TXT หรือ Markdown จากนั้นระบบจะสร้างเลขา AI และเตรียมลิงก์ Webhook ให้คุณนำไปวางใน LINE Developers Console ได้ทันที",
    faqQ2: "ระบบป้องกันปัญหาจองคิวซ้ำซ้อนอย่างไร?",
    faqA2: "ระบบของเราขับเคลื่อนด้วยเทคโนโลยี AI Function Calling ซึ่งก่อนจองคิว AI จะบังคับเรียกฟังก์ชันตรวจสอบสถานะความว่างในปฏิทินจริงก่อนเสมอ หากเวลานั้นไม่ว่าง AI จะแนะนำเวลาที่ว่างใกล้เคียงให้ลูกค้า และจะไม่ทำการบันทึกข้อมูลเด็ดขาดหากเวลาซ้ำซ้อน",
    faqQ3: "ระบบ RAG และ CAG แตกต่างกันอย่างไร?",
    faqA3: "ระบบจะคำนวณขนาดเนื้อหาคู่มือของคุณโดยอัตโนมัติ หากคู่มือของคุณมีขนาดกะทัดรัด (ไม่เกิน 15,000 ทอนเคน) ระบบจะใช้โหมด CAG โหลดคู่มือทั้งหมดเข้าสู่ AI เพื่อให้ตอบได้ละเอียดครบถ้วน 100% แต่ถ้าเอกสารมีขนาดใหญ่ขึ้น ระบบจะสลับไปใช้ RAG ค้นหาข้อมูลเฉพาะจุดจากเวกเตอร์ฐานข้อมูลเพื่อประหยัด Token และตอบสนองได้อย่างรวดเร็ว",
    faqQ4: "สามารถเชื่อมต่อกับแพลตฟอร์มอื่นนอกจาก LINE ได้ไหม?",
    faqA4: "ในปัจจุบันระบบเวอร์ชันโปรโตไทป์รองรับการเชื่อมต่อกับ LINE อย่างเป็นทางการ และเรากำลังพัฒนาการเชื่อมต่อเพิ่มเติมกับ Facebook Messenger และหน้าแชตบอตบนหน้าเว็บไซต์ของคุณในเวอร์ชันถัดไป",

    // Footer
    footerDesc: "GenieAI คือแพลตฟอร์ม SaaS จัดตั้งผู้ช่วย AI อัจฉริยะเพื่อช่วยจัดการธุรกิจ บริการ และคิวการนัดหมายผ่านแชตแบบครบวงจรสำหรับร้านค้ายุคใหม่",
    rightsReserved: "สงวนลิขสิทธิ์ทั้งหมด",
    footerProduct: "ผลิตภัณฑ์",
    footerCompany: "บริษัท",
    footerAbout: "เกี่ยวกับเรา",
    footerBlog: "บทความ",
    footerContact: "ติดต่อเรา",
    footerLegal: "กฎหมาย",
    footerTerms: "ข้อกำหนดการใช้งาน",
    footerPrivacy: "นโยบายความเป็นส่วนตัว",
    footerTagline: "ออกแบบเพื่อคลินิกความงาม ซาลอน และธุรกิจบริการ",

    // CTA
    ctaHeading: "พร้อมยกระดับระบบบริการร้านค้าของคุณแล้วหรือยัง?",
    ctaSub: "เข้าร่วมกับธุรกิจกว่า 500+ แห่งที่ใช้ GenieAI เพิ่มประสิทธิภาพการทำงาน ลดคิวซ้อน และตอบลูกค้าอัตโนมัติได้แบบเรียลไทม์",
    ctaButton: "เริ่มต้นสร้างเลขา AI ของคุณวันนี้",
    ctaBadge: "เติบโตด้วยระบบอัตโนมัติ"
  },
  en: {
    // Header
    login: "Log In",
    signup: "Sign Up",
    features: "Features",
    pricing: "Pricing",
    faq: "FAQ",
    
    // Hero
    heroTitle: "Turn Your Shop Manual into a Smart AI Assistant in 1 Minute",
    heroSubtitle: "Upload your service manuals (PDF/TXT/MD), and our system automatically builds a chatbot to answer questions and manage bookings via LINE & Web, conflict-free.",
    heroCta: "Create Your AI Assistant Free",
    heroSubCta: "No credit card required • Setup in 1 minute",
    heroBadge: "Next-Gen AI Shop Assistant",
    dashboardCalendar: "GenieAI Dashboard - Calendar View",
    liveSync: "Live Sync",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    calendarEvents: ["10:30 Teeth Whitening", "14:00 Scaling", "16:00 Filling"],
    dentalAssistant: "GenieAI Dental Assistant",
    lineOfficialAccount: "LINE Official Account",
    exampleChat: "Example conversation in Thai",
    
    // Trust Badges
    trustedBy: "Trusted by over 500+ leading service businesses",
    
    // Problem & Solution
    problemTitle: "Legacy Shop Management Issues",
    solutionTitle: "GenieAI Automated Solution",
    problem1: "Slow chat responses lead to clients changing their minds.",
    solution1: "Instant 24/7 replies with state-of-the-art accuracy.",
    problem2: "Double bookings and manual scheduling errors.",
    solution2: "Real-time calendar availability check ensures zero schedule conflicts.",
    problem3: "Scattered knowledge and outdated price lists.",
    solution3: "Simply upload a new document; RAG/CAG syncs answers instantly.",
    problem4: "4-6 hours lost answering the same questions each day.",
    solution4: "Let AI handle repetitive chats so your team can focus on in-store customers.",
    problemAndSolutionHeader: "Why Choose GenieAI?",
    problemAndSolutionSub: "Compare how we reshape business operations and customer satisfaction.",
    comparisonBadge: "Before vs After",
    comparisonLabel: "Real Results Compared",
    problemKicker: "Manual Chaos & Lost Sales",
    problemBadge: "35% average customer loss",
    problem1Detail: "Customers waiting over 15 minutes quickly switch to a competing clinic or shop.",
    problem2Detail: "Miscommunication creates overlapping appointments, lost trust, and time spent apologizing.",
    problem3Detail: "New admins quote the wrong prices, forget promotions, and repeatedly ask the owner.",
    problem4Detail: "Admins lose time they could spend serving in-store customers or improving services.",
    solutionKicker: "AI-Powered Automatic Growth",
    solutionBadge: "1-second replies • Zero conflicts",
    solution1Title: "Instant 24/7 Replies That Convert",
    solution2Title: "Smart Scheduling with Zero Conflicts",
    solution3Title: "Smart RAG & CAG Knowledge Extraction",
    solution4Title: "Save 80% of Admin Time and Grow Revenue",

    // Features
    featuresHeader: "Key Features to Scale Your Business",
    featuresSub: "Intelligent capabilities tailored for modern service operations.",
    feat1Title: "Smart RAG & CAG Context Engine",
    feat1Desc: "Dynamically routes prompts between full-context CAG or vector-search RAG depending on corpus size for absolute precision.",
    feat2Title: "Seamless Appointment Bookings",
    feat2Desc: "AI checks availability and records calendar reservations on-the-fly using secure AI function calling to prevent scheduling collisions.",
    feat3Title: "1-Click LINE Webhook Integration",
    feat3Desc: "Link your LINE Official Account easily. Deliver answers in natural, human-like message bubbles with typing delays.",
    lineConnection: "LINE OA Connection",
    connected: "Connected",
    active: "Active",
    ragAutopilot: "RAG vs CAG Autopilot",
    fullyAutomatic: "100% Automatic",
    conflictFreeLocking: "Conflict-Free Locking",
    syncChecked: "Sync Checked",
    analyticsTitle: "Real-Time Analytics and Bookings",
    analyticsDesc: "Track booking conversion, chatbot activity, and customer behavior through a clear, easy-to-read analytics dashboard.",
    accuracyRate: "Chatbot Accuracy Rate",
    totalBookings: "Total Bookings",
    avgResponseTime: "Avg. Response Time",

    // Social Proof
    socialHeader: "What Business Owners Say",
    socialSub: "Read success stories from merchants who integrated GenieAI into their daily flows.",
    review1Name: "Monthira Eamsa-ard",
    review1Role: "Owner, Saneh Kesa Hair Salon",
    review1Text: "We used to miss bookings because admins responded late. Since integrating GenieAI on LINE, our response rate is instant, bookings are automated, and clients are extremely pleased!",
    review2Name: "Dr. Danai Thepvijit",
    review2Role: "Director, Smile Life Dental Clinic",
    review2Text: "Uploading our clinical guidelines took less than a minute. The AI answers patient queries on treatments and books slots seamlessly. Zero scheduling conflicts so far.",
    review3Name: "Kittisak Poonsilp",
    review3Role: "Manager, The Garden Steakhouse",
    review3Text: "Extremely simple to use. Uploading our menu and table booking rules was enough for the AI to handle reservations and promotions smoothly. Highly recommended.",

    // Pricing
    priceHeader: "Simple, Transparent Pricing",
    priceSub: "Start free and upgrade as your shop scales up.",
    tierStart: "Start",
    tierPro: "Pro (Recommended)",
    tierPremium: "Premium",
    priceStart: "Free",
    pricePro: "$49 / month",
    pricePremium: "$129 / month",
    startDesc: "Perfect for new shops setting up their first basic AI assistant.",
    proDesc: "Best for growing businesses automating bookings through LINE.",
    premiumDesc: "Designed for multi-location enterprises needing dedicated scale.",
    priceFeature1: "1 Store AI Assistant",
    priceFeature2: "Upload up to 2 knowledge docs",
    priceFeature3: "Basic RAG Retrieval (Token limited)",
    priceFeature4: "Q&A support (No appointments)",
    priceFeature5: "LINE Webhook Integration",
    priceFeature6: "Conflict-free AI Function Booking",
    priceFeature7: "Large corpus support (CAG & RAG)",
    priceFeature8: "Staff & Schedule Management Panel",
    priceFeature9: "Multi-branch / Multi-tenant sync",
    priceFeature10: "Advanced Analytics Dashboard",
    priceFeature11: "Dedicated account manager & free updates",
    buyBtn: "Get Started Now",
    popular: "Popular",

    // FAQ
    faqHeader: "Frequently Asked Questions",
    faqSub: "Everything you need to know about setting up and running GenieAI.",
    faqQ1: "Do I need coding skills to set this up?",
    faqA1: "Absolutely not! Just create an account, upload your documents (PDF, TXT, MD), and copy the generated Webhook URL directly into your LINE Developers console. It takes under a minute.",
    faqQ2: "How does the system prevent double-bookings?",
    faqA2: "Our AI model relies on AI function calling. When a client requests a booking, the AI first runs a check against real-time slot availability. If taken, it offers alternative slots and will never record overlapping bookings.",
    faqQ3: "What is the difference between RAG and CAG?",
    faqA3: "Our system measures your file sizes. If your store manuals are compact (under 15k tokens), CAG loads them entirely into context for perfect accuracy. For larger catalogs, RAG dynamically queries the top 5 relevant snippets from ChromaDB.",
    faqQ4: "Can I connect other channels besides LINE?",
    faqA4: "Currently, our single-tenant prototype supports LINE webhooks. Facebook Messenger, Web chat embeds, and deeper integrations are scheduled for release in our next product roadmap phase.",

    // Footer
    footerDesc: "GenieAI is an all-in-one SaaS AI Business Assistant designed to streamline customer support, service catalogs, and calendar bookings via messaging platforms.",
    rightsReserved: "All rights reserved.",
    footerProduct: "Product",
    footerCompany: "Company",
    footerAbout: "About Us",
    footerBlog: "Blog",
    footerContact: "Contact",
    footerLegal: "Legal",
    footerTerms: "Terms of Service",
    footerPrivacy: "Privacy Policy",
    footerTagline: "Designed for beauty clinics, salons & service merchants",

    // CTA
    ctaHeading: "Ready to Scale Your Store Operations?",
    ctaSub: "Join over 500+ service merchants using GenieAI to streamline bookings, eliminate double-bookings, and respond to clients instantly.",
    ctaButton: "Create Your AI Assistant Now",
    ctaBadge: "Scale with Automation"
  }
};

const Homepage = ({ lang, setLang, theme, setTheme, onNavigateToAuth }) => {
  const t = translations[lang || 'th'];
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const toggleTheme = () => {
    if (setTheme) {
      setTheme(theme === 'light' ? 'dark' : 'light');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090E] text-slate-800 dark:text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden transition-colors duration-300">
      
      {/* SECTION 1: HEADER (Fixed Floating Navbar) */}
      <header className="fixed top-4 inset-x-0 z-50 px-4 md:px-6 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between rounded-full bg-white/85 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-300 dark:border-slate-700/60 shadow-lg shadow-slate-200/50 dark:shadow-cyan-950/20">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="bg-gradient-to-br from-[#2B6CB0] to-cyan-500 rounded-2xl w-9.5 h-9.5 flex items-center justify-center border border-cyan-400/30 text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Store size={18} className="group-hover:rotate-6 transition-transform" />
            </div>
            <span className="font-extrabold text-lg text-[#1A365D] dark:text-white tracking-tight">GenieAI</span>
          </div>


          {/* Auth & Theme & Lang Switcher */}
          <div className="flex items-center gap-3">
            {/* Theme Switcher Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="p-2 rounded-xl border border-slate-300 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
              className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-extrabold border border-slate-300 dark:border-slate-700/60 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              <Globe size={11} />
              <span>{lang === 'th' ? 'EN' : 'TH'}</span>
            </button>

            <button 
              onClick={() => onNavigateToAuth('login')}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              {t.login}
            </button>
            <Button
              onClick={() => onNavigateToAuth('signup')}
              className="text-xs font-bold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:opacity-90 px-5 py-2.5 h-9.5 rounded-xl shadow-lg shadow-cyan-500/25 cursor-pointer"
            >
              {t.signup}
            </Button>
          </div>
        </div>
      </header>

      {/* SECTION 2: HERO SECTION */}
      <section className="relative pt-24 pb-28 md:pt-32 md:pb-40 overflow-hidden z-10 bg-gradient-to-b from-slate-100 via-cyan-50/30 to-white dark:from-[#07090E] dark:via-[#0F172A] dark:to-[#07090E]">
        {/* Glowing Neon Lights */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-cyan-400/20 via-blue-400/15 to-purple-400/20 dark:from-cyan-500/20 dark:via-blue-600/15 dark:to-purple-600/20 blur-[130px] pointer-events-none -z-10 animate-pulse duration-5000" />
        <div className="absolute top-1/4 left-1/4 w-[450px] h-[450px] rounded-full bg-cyan-400/10 blur-[100px] pointer-events-none -z-10" />

        {/* Futuristic Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_80%,transparent_100%)] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center relative z-10">
          {/* Centered Text */}
          <div className="flex flex-col items-center text-center max-w-4xl mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/30 dark:border-cyan-400/30 backdrop-blur-xl text-[#2B6CB0] dark:text-cyan-300 text-[11px] font-extrabold shadow-sm tracking-wide mb-8 animate-slide-up hover:scale-105 transition-all">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <Sparkles size={13} className="text-cyan-600 dark:text-cyan-400" />
              <span>{t.heroBadge}</span>
            </div>
            
            <h1 className="text-4xl md:text-6.5xl font-extrabold tracking-tight leading-[1.12] mb-6 text-slate-900 dark:text-white animate-slide-up" style={{ animationDelay: '100ms' }}>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-[#1A365D] to-cyan-600 dark:from-white dark:via-cyan-200 dark:to-blue-400 filter drop-shadow-sm">
                {t.heroTitle}
              </span>
            </h1>
            
            <p className="text-sm md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-10 max-w-2xl font-medium animate-slide-up" style={{ animationDelay: '200ms' }}>
              {t.heroSubtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto animate-slide-up" style={{ animationDelay: '300ms' }}>
              <Button
                onClick={() => onNavigateToAuth('signup')}
                className="font-extrabold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-cyan-500/30 px-10 py-4 h-13 rounded-2xl shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 hover-scale cursor-pointer animate-glow-pulse"
              >
                <span className="text-sm">{t.heroCta}</span>
                <ArrowRight size={16} />
              </Button>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                {t.heroSubCta}
              </span>
            </div>
          </div>

          {/* 3D Overlapping Glass Mockups (Dashboard + LINE Chat) */}
          <div className="relative w-full max-w-5xl h-[340px] sm:h-[450px] md:h-[550px] mt-8 flex justify-center items-end select-none">
            {/* Dashboard Mockup (Back Layer - 3D Floating) */}
            <div className="absolute left-0 bottom-4 w-[85%] h-[85%] rounded-3xl bg-white/95 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/60 shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl hover:translate-y-[-8px] transition-all duration-500 p-4 sm:p-6 flex flex-col text-left overflow-hidden animate-float-slow">
              {/* Fake Dashboard Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 ml-2">{t.dashboardCalendar}</span>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  {t.liveSync}
                </div>
              </div>

              {/* Fake Calendar Content */}
              <div className="flex-1 grid grid-cols-12 gap-4 h-full">
                {/* Fake mini-sidebar */}
                <div className="col-span-2 hidden sm:flex flex-col gap-3.5 border-r border-slate-200 dark:border-slate-800 pr-4">
                  <div className="h-6.5 w-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center px-2.5 gap-2">
                    <div className="w-3 h-3 rounded bg-cyan-500 dark:bg-cyan-400" />
                    <div className="h-2 w-10 bg-slate-400 rounded" />
                  </div>
                  <div className="h-6.5 w-full rounded flex items-center px-2.5 gap-2 opacity-60">
                    <div className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-700" />
                    <div className="h-2 w-12 bg-slate-300 dark:bg-slate-700 rounded" />
                  </div>
                  <div className="h-6.5 w-full rounded flex items-center px-2.5 gap-2 opacity-60">
                    <div className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-700" />
                    <div className="h-2 w-8 bg-slate-300 dark:bg-slate-700 rounded" />
                  </div>
                </div>

                {/* Fake calendar grid */}
                <div className="col-span-12 sm:col-span-10 flex flex-col h-full gap-4">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-28 bg-slate-300 dark:bg-slate-700 rounded" />
                    <div className="flex gap-2">
                      <div className="h-5 w-12 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                      <div className="h-5 w-12 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                    </div>
                  </div>

                  {/* Grid cells */}
                  <div className="flex-1 grid grid-cols-7 gap-1.5 sm:gap-2.5 overflow-hidden">
                    {/* Header days */}
                    {t.weekdays.map(day => (
                      <div key={day} className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 dark:text-slate-400 text-center uppercase tracking-wider py-1">{day}</div>
                    ))}
                    {/* Month cells */}
                    {[...Array(14)].map((_, idx) => {
                      const hasBooking = idx === 3 || idx === 8 || idx === 11;
                      return (
                        <div key={idx} className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-1.5 sm:p-2 flex flex-col justify-between relative overflow-hidden transition-all ${hasBooking ? 'ring-1 ring-cyan-500/60 bg-cyan-50/80 dark:bg-cyan-500/15' : ''}`}>
                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-none">{idx + 1}</span>
                          {hasBooking && (
                            <div className="mt-auto bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-md px-1.5 py-0.5 text-[8px] sm:text-[9px] font-extrabold truncate shadow-sm flex items-center justify-center leading-none">
                              {idx === 3 ? t.calendarEvents[0] : idx === 8 ? t.calendarEvents[1] : t.calendarEvents[2]}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Smartphone LINE Chat Mockup (Front Layer - Authentic iPhone + LINE Theme - 3D Floating) */}
            <div className="absolute right-2 sm:right-8 bottom-0 w-[245px] sm:w-[295px] h-[94%] rounded-[44px] bg-slate-900 border-[8px] sm:border-[10px] border-[#1C1C1E] ring-1 ring-slate-400/30 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden hover:translate-y-[-12px] transition-all duration-500 z-20 flex flex-col text-left animate-float-reverse">
              {/* iPhone Dynamic Island Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-2xl z-30 flex items-center justify-center gap-2 px-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#111] border border-[#222]" />
                <div className="w-2 h-2 rounded-full bg-[#080808]" />
              </div>

              {/* Hardware Side Button Decorations */}
              <div className="absolute -left-[10px] top-20 w-[2px] h-8 bg-slate-700 rounded-l-md" />
              <div className="absolute -left-[10px] top-32 w-[2px] h-10 bg-slate-700 rounded-l-md" />
              <div className="absolute -left-[10px] top-46 w-[2px] h-10 bg-slate-700 rounded-l-md" />
              <div className="absolute -right-[10px] top-28 w-[2px] h-14 bg-slate-700 rounded-r-md" />

              {/* LINE Header */}
              <div className="bg-[#06c755] text-white pt-8 pb-3 px-3.5 flex items-center justify-between z-20 shrink-0 shadow-md">
                <div className="flex items-center gap-2.5">
                  <img src="/genie_mascot_3d_clean.png" alt="GenieAI Mascot" className="w-8 h-8 rounded-full object-contain border border-white/40 shadow-sm" />
                  <div className="flex flex-col">
                    <span className="text-xs font-black tracking-wide flex items-center gap-1">
                      {t.dentalAssistant}
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    </span>
                    <span className="text-[8px] text-white/90 font-bold uppercase tracking-wider">{t.lineOfficialAccount} • {t.exampleChat}</span>
                  </div>
                </div>
              </div>

              {/* LINE Standard Chat Area (Iconic Blue-Gray Wallpaper #849FC3) */}
              <div className="flex-1 bg-[#849fc3] p-3 overflow-y-auto flex flex-col gap-3 font-sans">
                {/* Time Indicator */}
                <div className="text-[8px] text-white/70 bg-black/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full w-fit mx-auto my-0.5 font-bold">14:02</div>

                {/* Customer Bubble (Authentic LINE Light Green #8ef870) */}
                <div className="self-end max-w-[82%] flex flex-col gap-1 items-end">
                  <div className="bg-[#8ef870] text-slate-900 text-[10px] sm:text-xs font-semibold px-3 py-2 rounded-2xl rounded-tr-none shadow-sm leading-relaxed">
                    อยากจองคิวขูดหินปูนและฟอกสีฟันวันศุกร์นี้ บ่าย 2 ค่ะ
                  </div>
                  <span className="text-[8px] text-white/70 mr-1.5 font-bold">อ่านแล้ว 14:02</span>
                </div>

                {/* AI Bubbles (Authentic LINE White Bubbles) */}
                <div className="self-start max-w-[85%] flex gap-2">
                  <img src="/genie_mascot_3d_clean.png" alt="GenieAI Mascot" className="w-6.5 h-6.5 rounded-full object-contain border border-emerald-400 shadow-sm mt-1 shrink-0" />
                  <div className="flex flex-col gap-2">
                    <span className="text-[8px] text-white/80 font-bold">GenieAI • 14:02</span>

                    {/* Bot bubble 1 */}
                    <div className="bg-white text-slate-800 text-[10px] sm:text-xs font-semibold px-3 py-2 rounded-2xl rounded-tl-none shadow-sm border border-slate-200/60 leading-relaxed">
                      ตรวจสอบตารางคุณหมอให้แล้วนะคะ... วันศุกร์นี้ ช่วงเวลา 14:00 น. หมอเจมส์ว่างพอดีค่ะ!
                    </div>

                    {/* Bot bubble 2 (Interactive booking preview card) */}
                    <div className="bg-white text-slate-800 text-[10px] sm:text-xs rounded-2xl rounded-tl-none shadow-md border border-slate-200/80 overflow-hidden flex flex-col">
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-2.5 border-b border-slate-200 flex flex-col text-left">
                        <span className="text-[8px] font-bold text-cyan-700 uppercase tracking-wider">ข้อมูลการนัดหมายทันตกรรม</span>
                        <span className="text-[10px] font-extrabold text-[#1A365D] mt-0.5">บริการฟอกสีฟัน & ขูดหินปูน (Dental Care)</span>
                        <span className="text-[9px] font-bold text-[#2B6CB0] mt-0.5">วันศุกร์ 31 ก.ค. • 14:00 - 15:00 น.</span>
                        <span className="text-[9px] font-bold text-slate-600">ทันตแพทย์: หมอเจมส์ (ทันตแพทย์ผู้เชี่ยวชาญ)</span>
                      </div>
                      <div className="p-2 bg-white">
                        <button className="w-full py-1.5 bg-[#06c755] hover:bg-[#05b34c] text-white text-[9px] font-extrabold rounded-lg shadow-sm shadow-[#06c755]/30 flex items-center justify-center gap-1 cursor-pointer">
                          <Check size={11} strokeWidth={3} />
                          กดเพื่อยืนยันการจองคิว
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: PROBLEM AND SOLUTION (High-Impact Pain Points vs AI Solutions) */}
      <section className="py-28 bg-slate-100/70 dark:bg-[#0B0F17] relative overflow-hidden">
        {/* Ambient Neon Glow */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[350px] bg-rose-500/5 blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[500px] h-[350px] bg-cyan-500/10 blur-[140px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 backdrop-blur-xl text-slate-700 dark:text-slate-300 text-[11px] font-bold shadow-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-rose-500 to-cyan-500 animate-pulse" />
              <span className="font-extrabold text-slate-900 dark:text-white">{t.comparisonBadge}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="text-slate-500 dark:text-slate-400 font-semibold">{t.comparisonLabel}</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-cyan-600 to-blue-600 dark:from-rose-400 dark:via-cyan-300 dark:to-blue-400">
                {t.problemAndSolutionHeader}
              </span>
            </h2>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-semibold max-w-xl mx-auto leading-relaxed">
              {t.problemAndSolutionSub}
            </p>
          </div>

          <div className="relative max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

            {/* VS Badge Floating Center */}
            <div className="hidden lg:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-13 h-13 rounded-full bg-gradient-to-br from-slate-900 to-slate-800 border-4 border-slate-100 dark:border-[#0B0F17] shadow-xl text-white font-black text-xs items-center justify-center z-30 tracking-widest text-cyan-300">
              VS
            </div>

            {/* PROBLEM CARD (The Old Manual Way) */}
            <div className="bg-white dark:bg-slate-900/90 border-2 border-rose-200 dark:border-rose-500/30 rounded-3xl p-8 md:p-10 shadow-xl shadow-rose-100/50 dark:shadow-rose-950/20 flex flex-col justify-between text-left hover-scale transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-bl-full pointer-events-none" />

              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between pb-6 mb-8 border-b border-rose-100 dark:border-rose-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-rose-600 dark:text-rose-400">❌ {t.problemTitle}</h3>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{t.problemKicker}</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-full border border-rose-300/50 dark:border-rose-800/50 shrink-0">
                    {t.problemBadge}
                  </span>
                </div>

                {/* Real Pain Points List */}
                <div className="flex flex-col gap-6">
                  {/* Pain Point 1 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 flex items-center justify-center font-bold text-xs mt-0.5">✕</div>
                    <div>
                      <h4 className="text-xs md:text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1">{t.problem1}</h4>
                      <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        {t.problem1Detail}
                      </p>
                    </div>
                  </div>

                  {/* Pain Point 2 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 flex items-center justify-center font-bold text-xs mt-0.5">✕</div>
                    <div>
                      <h4 className="text-xs md:text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1">{t.problem2}</h4>
                      <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        {t.problem2Detail}
                      </p>
                    </div>
                  </div>

                  {/* Pain Point 3 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 flex items-center justify-center font-bold text-xs mt-0.5">✕</div>
                    <div>
                      <h4 className="text-xs md:text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1">{t.problem3}</h4>
                      <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        {t.problem3Detail}
                      </p>
                    </div>
                  </div>

                  {/* Pain Point 4 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 flex items-center justify-center font-bold text-xs mt-0.5">✕</div>
                    <div>
                      <h4 className="text-xs md:text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1">{t.problem4}</h4>
                      <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        {t.problem4Detail}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SOLUTION CARD (The GenieAI AI Way) */}
            <div className="bg-gradient-to-br from-cyan-50/90 via-sky-50/80 to-indigo-50/90 dark:bg-gradient-to-br dark:from-slate-900 dark:via-[#0F172A] dark:to-indigo-950/60 border-2 border-cyan-400 dark:border-cyan-400/70 rounded-3xl p-8 md:p-10 shadow-2xl shadow-cyan-500/20 flex flex-col justify-between text-left hover-scale transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-bl-full pointer-events-none" />

              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between pb-6 mb-8 border-b border-cyan-200 dark:border-cyan-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/30">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-cyan-700 dark:text-cyan-300">⚡ {t.solutionTitle}</h3>
                      <span className="text-[10px] text-cyan-800 dark:text-cyan-400 font-bold">{t.solutionKicker}</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-extrabold bg-cyan-500/20 text-cyan-900 dark:text-cyan-200 px-3 py-1 rounded-full border border-cyan-400/50 shrink-0 shadow-sm animate-pulse">
                    {t.solutionBadge}
                  </span>
                </div>

                {/* AI Solutions List */}
                <div className="flex flex-col gap-6">
                  {/* Solution 1 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-cyan-500 text-white shrink-0 flex items-center justify-center font-bold text-xs shadow-md shadow-cyan-500/30 mt-0.5">✓</div>
                    <div>
                      <h4 className="text-xs md:text-sm font-extrabold text-slate-900 dark:text-white mb-1">{t.solution1Title}</h4>
                      <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                        {t.solution1}
                      </p>
                    </div>
                  </div>

                  {/* Solution 2 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-cyan-500 text-white shrink-0 flex items-center justify-center font-bold text-xs shadow-md shadow-cyan-500/30 mt-0.5">✓</div>
                    <div>
                      <h4 className="text-xs md:text-sm font-extrabold text-slate-900 dark:text-white mb-1">{t.solution2Title}</h4>
                      <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                        {t.solution2}
                      </p>
                    </div>
                  </div>

                  {/* Solution 3 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-cyan-500 text-white shrink-0 flex items-center justify-center font-bold text-xs shadow-md shadow-cyan-500/30 mt-0.5">✓</div>
                    <div>
                      <h4 className="text-xs md:text-sm font-extrabold text-slate-900 dark:text-white mb-1">{t.solution3Title}</h4>
                      <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                        {t.solution3}
                      </p>
                    </div>
                  </div>

                  {/* Solution 4 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-cyan-500 text-white shrink-0 flex items-center justify-center font-bold text-xs shadow-md shadow-cyan-500/30 mt-0.5">✓</div>
                    <div>
                      <h4 className="text-xs md:text-sm font-extrabold text-slate-900 dark:text-white mb-1">{t.solution4Title}</h4>
                      <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                        {t.solution4}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 5: FEATURES (BENTO GRID) */}
      <section id="features" className="py-28 bg-white dark:bg-[#07090E] relative overflow-hidden">
        {/* Ambient decorative glow */}
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              {t.featuresHeader}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold max-w-md mx-auto">
              {t.featuresSub}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {/* Card 1: LINE Webhook (Large - md:col-span-2) */}
            <div className="bg-white dark:bg-slate-900/90 md:col-span-2 p-8 md:p-10 border-2 border-slate-200 dark:border-slate-800 hover:border-cyan-500/60 dark:hover:border-cyan-500/50 rounded-3xl hover-scale transition-all duration-500 flex flex-col md:flex-row justify-between gap-8 items-center overflow-hidden text-left shadow-lg shadow-slate-200/50 dark:shadow-cyan-950/20">
              <div className="flex-1 flex flex-col justify-center">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-6 shadow-sm">
                  <MessageSquare size={22} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t.feat3Title}</h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {t.feat3Desc}
                </p>
              </div>
              {/* LINE integration mockup visual */}
              <div className="w-full md:w-64 bg-slate-900 dark:bg-slate-950 border border-slate-700 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3.5 relative shrink-0 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-700 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#06c755] shrink-0" />
                    <span className="text-[9px] font-bold text-slate-300 dark:text-slate-400">{t.lineConnection}</span>
                  </div>
                  <div className="text-[8px] font-bold text-[#06c755] bg-[#06c755]/10 px-2 py-0.5 rounded-full border border-[#06c755]/20">{t.connected}</div>
                </div>
                <div className="h-6.5 w-[85%] bg-[#06c755]/10 border border-[#06c755]/30 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[8px] font-bold text-slate-200">
                  <span className="truncate">https://ground-relieve-...</span>
                  <span className="text-[#06c755] text-[7px] uppercase font-black tracking-wider">{t.active}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-1.5 w-[50%] bg-slate-700 dark:bg-slate-800 rounded" />
                  <div className="h-1.5 w-[80%] bg-slate-700 dark:bg-slate-800 rounded" />
                </div>
              </div>
            </div>

            {/* Card 2: RAG & CAG Engine (Medium - md:col-span-1) */}
            <div className="bg-white dark:bg-slate-900/90 md:col-span-1 p-8 md:p-10 border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500/60 dark:hover:border-indigo-500/50 rounded-3xl hover-scale transition-all duration-500 flex flex-col justify-between text-left shadow-lg">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 shadow-sm">
                  <Zap size={22} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t.feat1Title}</h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {t.feat1Desc}
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span>{t.ragAutopilot}</span>
                <span className="text-cyan-600 dark:text-cyan-400">{t.fullyAutomatic}</span>
              </div>
            </div>

            {/* Card 3: Booking Automation (Medium - md:col-span-1) */}
            <div className="bg-white dark:bg-slate-900/90 md:col-span-1 p-8 md:p-10 border-2 border-slate-200 dark:border-slate-800 hover:border-purple-500/60 dark:hover:border-purple-500/50 rounded-3xl hover-scale transition-all duration-500 flex flex-col justify-between text-left shadow-lg">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-6 shadow-sm">
                  <Clock size={22} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t.feat2Title}</h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {t.feat2Desc}
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span>{t.conflictFreeLocking}</span>
                <span className="text-purple-600 dark:text-purple-400">{t.syncChecked}</span>
              </div>
            </div>

            {/* Card 4: Omnichannel & Analytics (Large - md:col-span-2) */}
            <div className="bg-white dark:bg-slate-900/90 md:col-span-2 p-8 md:p-10 border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/50 rounded-3xl hover-scale transition-all duration-500 flex flex-col md:flex-row justify-between gap-8 items-center overflow-hidden text-left shadow-lg">
              <div className="flex-1 flex flex-col justify-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 shadow-sm">
                  <TrendingUp size={22} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t.analyticsTitle}</h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {t.analyticsDesc}
                </p>
              </div>
              {/* Analytics visual bar mockup */}
              <div className="w-full md:w-64 bg-slate-900 dark:bg-slate-950 border border-slate-700 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-4 relative shrink-0 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-300 dark:text-slate-400">{t.accuracyRate}</span>
                  <span className="text-xs font-black text-cyan-400">99.2%</span>
                </div>
                {/* Visual mini-bar */}
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: '99%' }} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="bg-slate-800 dark:bg-slate-900 p-2 rounded-xl border border-slate-700 dark:border-slate-800">
                    <span className="block text-[8px] font-bold text-slate-400">{t.totalBookings}</span>
                    <span className="text-sm font-black text-white">1,248</span>
                  </div>
                  <div className="bg-slate-800 dark:bg-slate-900 p-2 rounded-xl border border-slate-700 dark:border-slate-800">
                    <span className="block text-[8px] font-bold text-slate-400">{t.avgResponseTime}</span>
                    <span className="text-sm font-black text-emerald-400">1.8s</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: SOCIAL PROOF */}
      <section className="py-28 bg-slate-100/60 dark:bg-[#0B0F17] relative">
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <div className="mb-20">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              {t.socialHeader}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold max-w-md mx-auto">
              {t.socialSub}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Review 1 */}
            <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-lg flex flex-col justify-between text-left hover-scale transition-all duration-300">
              <div>
                <div className="flex gap-1 text-amber-500 mb-5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} fill="currentColor" />)}
                </div>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic mb-8 font-medium">
                  "{t.review1Text}"
                </p>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 font-bold text-sm flex items-center justify-center text-white border border-cyan-400/30">M</div>
                <div>
                  <h4 className="text-xs md:text-sm font-bold text-slate-900 dark:text-white">{t.review1Name}</h4>
                  <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-semibold">{t.review1Role}</span>
                </div>
              </div>
            </div>

            {/* Review 2 */}
            <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-lg flex flex-col justify-between text-left hover-scale transition-all duration-300">
              <div>
                <div className="flex gap-1 text-amber-500 mb-5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} fill="currentColor" />)}
                </div>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic mb-8 font-medium">
                  "{t.review2Text}"
                </p>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-sm flex items-center justify-center text-white border border-indigo-400/30">D</div>
                <div>
                  <h4 className="text-xs md:text-sm font-bold text-slate-900 dark:text-white">{t.review2Name}</h4>
                  <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-semibold">{t.review2Role}</span>
                </div>
              </div>
            </div>

            {/* Review 3 */}
            <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-lg flex flex-col justify-between text-left hover-scale transition-all duration-300">
              <div>
                <div className="flex gap-1 text-amber-500 mb-5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} fill="currentColor" />)}
                </div>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic mb-8 font-medium">
                  "{t.review3Text}"
                </p>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-sm flex items-center justify-center text-white border border-emerald-400/30">K</div>
                <div>
                  <h4 className="text-xs md:text-sm font-bold text-slate-900 dark:text-white">{t.review3Name}</h4>
                  <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-semibold">{t.review3Role}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: PRICING */}
      <section id="pricing" className="py-28 bg-white dark:bg-[#07090E] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="mb-20">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              {t.priceHeader}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold max-w-md mx-auto">
              {t.priceSub}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch py-4">
            {/* Start Tier */}
            <div className="bg-white dark:bg-slate-900/80 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-9 flex flex-col justify-between text-left hover-scale transition-all duration-300 shadow-lg">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{t.tierStart}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-8">{t.startDesc}</p>
                <div className="mb-8">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{t.priceStart}</span>
                </div>
                
                <ul className="flex flex-col gap-4 text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium mb-8">
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature1}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature2}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature3}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature4}</span>
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => onNavigateToAuth('signup')}
                className="w-full text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 h-11 rounded-xl cursor-pointer"
              >
                {t.buyBtn}
              </Button>
            </div>

            {/* Pro Tier (Popular) */}
            <div className="bg-gradient-to-b from-cyan-50/80 to-indigo-50/80 dark:from-[#0F172A] dark:to-[#1E1B4B] border-2 border-cyan-500 dark:border-cyan-400 rounded-3xl p-9 flex flex-col justify-between text-left shadow-xl shadow-cyan-500/10 dark:shadow-[0_0_40px_rgba(6,182,212,0.2)] relative scale-105 z-10 hover-scale transition-all duration-300">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white text-[10px] font-extrabold uppercase px-4 py-1.5 rounded-full tracking-wider shadow-md">
                {t.popular}
              </span>
              <div>
                <h3 className="text-base font-extrabold text-cyan-700 dark:text-cyan-300 mb-2">{t.tierPro}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-8">{t.proDesc}</p>
                <div className="mb-8">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{t.pricePro}</span>
                </div>
                
                <ul className="flex flex-col gap-4 text-xs md:text-sm text-slate-800 dark:text-slate-200 font-semibold mb-8">
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature1}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature5}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature6}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature7}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature8}</span>
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => onNavigateToAuth('signup')}
                className="w-full text-xs font-extrabold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:opacity-95 shadow-lg shadow-cyan-500/25 h-11 rounded-xl cursor-pointer"
              >
                {t.buyBtn}
              </Button>
            </div>

            {/* Premium Tier */}
            <div className="bg-white dark:bg-slate-900/80 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-9 flex flex-col justify-between text-left hover-scale transition-all duration-300 shadow-lg">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{t.tierPremium}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-8">{t.premiumDesc}</p>
                <div className="mb-8">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{t.pricePremium}</span>
                </div>
                
                <ul className="flex flex-col gap-4 text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium mb-8">
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature5}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature6}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature9}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature10}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{t.priceFeature11}</span>
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => onNavigateToAuth('signup')}
                className="w-full text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 h-11 rounded-xl cursor-pointer"
              >
                {t.buyBtn}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: FAQ */}
      <section id="faq" className="py-28 bg-slate-100/60 dark:bg-[#0B0F17] relative">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              {t.faqHeader}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold max-w-md mx-auto">
              {t.faqSub}
            </p>
          </div>

          <div className="flex flex-col gap-5">
            {/* FAQ 1 */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md hover-scale transition-all duration-300">
              <button
                onClick={() => toggleFaq(1)}
                className="w-full px-7 py-5.5 flex justify-between items-center text-left text-xs md:text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                <span>{t.faqQ1}</span>
                {openFaq === 1 ? <ChevronUp size={18} className="text-cyan-600 dark:text-cyan-400" /> : <ChevronDown size={18} className="text-slate-400 dark:text-slate-500" />}
              </button>
              {openFaq === 1 && (
                <div className="px-7 pb-6 text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-left border-t border-slate-100 dark:border-slate-800 pt-4 font-medium">
                  {t.faqA1}
                </div>
              )}
            </div>

            {/* FAQ 2 */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md hover-scale transition-all duration-300">
              <button
                onClick={() => toggleFaq(2)}
                className="w-full px-7 py-5.5 flex justify-between items-center text-left text-xs md:text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                <span>{t.faqQ2}</span>
                {openFaq === 2 ? <ChevronUp size={18} className="text-cyan-600 dark:text-cyan-400" /> : <ChevronDown size={18} className="text-slate-400 dark:text-slate-500" />}
              </button>
              {openFaq === 2 && (
                <div className="px-7 pb-6 text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-left border-t border-slate-100 dark:border-slate-800 pt-4 font-medium">
                  {t.faqA2}
                </div>
              )}
            </div>

            {/* FAQ 3 */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md hover-scale transition-all duration-300">
              <button
                onClick={() => toggleFaq(3)}
                className="w-full px-7 py-5.5 flex justify-between items-center text-left text-xs md:text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                <span>{t.faqQ3}</span>
                {openFaq === 3 ? <ChevronUp size={18} className="text-cyan-600 dark:text-cyan-400" /> : <ChevronDown size={18} className="text-slate-400 dark:text-slate-500" />}
              </button>
              {openFaq === 3 && (
                <div className="px-7 pb-6 text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-left border-t border-slate-100 dark:border-slate-800 pt-4 font-medium">
                  {t.faqA3}
                </div>
              )}
            </div>

            {/* FAQ 4 */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md hover-scale transition-all duration-300">
              <button
                onClick={() => toggleFaq(4)}
                className="w-full px-7 py-5.5 flex justify-between items-center text-left text-xs md:text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                <span>{t.faqQ4}</span>
                {openFaq === 4 ? <ChevronUp size={18} className="text-cyan-600 dark:text-cyan-400" /> : <ChevronDown size={18} className="text-slate-400 dark:text-slate-500" />}
              </button>
              {openFaq === 4 && (
                <div className="px-7 pb-6 text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-left border-t border-slate-100 dark:border-slate-800 pt-4 font-medium">
                  {t.faqA4}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 9: CALL TO ACTION */}
      <section className="py-24 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#020617] text-white relative overflow-hidden border-t border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,#06b6d420,transparent)] pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/20 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 flex flex-col items-center">
          <div className="flex items-center gap-4 mb-8">
            <Mascot3D size="md" showBadge={false} />
            <div className="inline-flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-extrabold px-4 py-1.5 rounded-full w-fit uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Sparkles size={12} className="animate-pulse text-cyan-400" />
              <span>{t.ctaBadge}</span>
            </div>
          </div>
          
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight max-w-2xl bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-blue-300">
            {t.ctaHeading}
          </h2>
          
          <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed mb-10 font-medium">
            {t.ctaSub}
          </p>

          <Button
            onClick={() => onNavigateToAuth('signup')}
            className="font-extrabold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:shadow-[0_0_35px_rgba(6,182,212,0.4)] px-10 py-4 h-13 rounded-2xl shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2.5 hover-scale cursor-pointer"
          >
            <span className="text-sm">{t.ctaButton}</span>
            <ArrowRight size={16} />
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 dark:bg-[#030712] text-white py-20 border-t border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-12 relative z-10">
          <div className="md:col-span-5 text-left flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-[#2B6CB0] to-cyan-500 rounded-2xl w-10 h-10 flex items-center justify-center border border-cyan-400/30 text-white shadow-md shadow-cyan-500/20">
                <Store size={20} />
              </div>
              <span className="font-extrabold text-xl tracking-tight">GenieAI</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm font-medium">
              {t.footerDesc}
            </p>
          </div>

          <div className="md:col-span-7 grid grid-cols-3 gap-8 text-left text-xs text-slate-400 font-semibold">
            <div className="flex flex-col gap-4">
              <h4 className="text-white text-xs font-extrabold uppercase tracking-wider mb-2">{t.footerProduct}</h4>
              <a href="#features" className="hover:text-cyan-400 transition-colors">{t.features}</a>
              <a href="#pricing" className="hover:text-cyan-400 transition-colors">{t.pricing}</a>
              <a href="#faq" className="hover:text-cyan-400 transition-colors">{t.faq}</a>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="text-white text-xs font-extrabold uppercase tracking-wider mb-2">{t.footerCompany}</h4>
              <span className="hover:text-cyan-400 cursor-pointer transition-colors">{t.footerAbout}</span>
              <span className="hover:text-cyan-400 cursor-pointer transition-colors">{t.footerBlog}</span>
              <span className="hover:text-cyan-400 cursor-pointer transition-colors">{t.footerContact}</span>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="text-white text-xs font-extrabold uppercase tracking-wider mb-2">{t.footerLegal}</h4>
              <span className="hover:text-cyan-400 cursor-pointer transition-colors">{t.footerTerms}</span>
              <span className="hover:text-cyan-400 cursor-pointer transition-colors">{t.footerPrivacy}</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 mt-16 pt-10 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-slate-400 font-bold">
          <span>&copy; {new Date().getFullYear()} GenieAI. {t.rightsReserved}</span>
          <span className="tracking-widest uppercase text-cyan-400/80">{t.footerTagline}</span>
        </div>
      </footer>

    </div>
  );
};

export default Homepage;
