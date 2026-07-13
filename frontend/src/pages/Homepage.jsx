import { useState } from 'react';
import { 
  Store, Sparkles, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, 
  Zap, Clock, Settings, ChevronDown, ChevronUp, Star, Check, Sun, Moon, Globe 
} from 'lucide-react';
import { Button } from '@heroui/react';

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
    problemAndSolutionHeader: "ทำไมต้องเปลี่ยนมาใช้ GenieAI?",
    problemAndSolutionSub: "เปรียบเทียบการทำงานเพื่อช่วยให้คุณเห็นความแตกต่างได้อย่างชัดเจน",

    // Features
    featuresHeader: "ฟีเจอร์เด่นเพื่อการเติบโตของธุรกิจคุณ",
    featuresSub: "รวมความสามารถอัจฉริยะที่ออกแบบมาเพื่อร้านค้าบริการโดยเฉพาะ",
    feat1Title: "วิเคราะห์ข้อมูลแบบ RAG & CAG อัจฉริยะ",
    feat1Desc: "ระบบจะปรับโหมดดึงข้อมูลตามขนาดคู่มือของคุณโดยอัตโนมัติ เพื่อการตอบคำถามที่แม่นยำ รวดเร็ว และประหยัดพลังงานที่สุด",
    feat2Title: "ทำนัดหมายอัตโนมัติ ไร้รอยต่อ",
    feat2Desc: "AI สามารถตรวจสอบคิวงาน ช่าง หรือห้องบริการที่ว่าง แล้วจองให้ลูกค้าได้ทันทีผ่านคำสั่ง AI Function Calling ป้องกันคิวชน 100%",
    feat3Title: "เชื่อมต่อ LINE Webhook ได้ในคลิกเดียว",
    feat3Desc: "เชื่อมระบบเข้ากับ LINE Official Account ของร้านคุณได้อย่างสะดวกรวดเร็ว ตอบกลับลูกค้าด้วยการแบ่ง Bubble แบบมนุษย์จริง",

    // Social Proof
    socialHeader: "เสียงตอบรับจากผู้ใช้งานจริง",
    socialSub: "ร่วมฟังประสบการณ์จากเจ้าของธุรกิจที่นำ GenieAI ไปยกระดับการบริการ",
    review1Name: "คุณมลธิรา เอี่ยมสะอาด",
    review1Role: "เจ้าของร้านเสน่ห์เกศา ซาลอน",
    review1Text: "ก่อนหน้านี้แอดมินตอบแชทจองคิวทำผมช้ามาก พอเปลี่ยนมาใช้ GenieAI ช่วยตอบและจองคิวผ่าน LINE ลูกค้าชมว่าตอบเร็วและจองง่ายขึ้นเยอะมากค่ะ ประหยัดเวลาไปได้วันละหลายชั่วโมงเลย",
    review2Name: "นพ. ดนัย เทพวิจิตร",
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

    // CTA
    ctaHeading: "พร้อมยกระดับระบบบริการร้านค้าของคุณแล้วหรือยัง?",
    ctaSub: "เข้าร่วมกับธุรกิจกว่า 500+ แห่งที่ใช้ GenieAI เพิ่มประสิทธิภาพการทำงาน ลดคิวซ้อน และตอบลูกค้าอัตโนมัติได้แบบเรียลไทม์",
    ctaButton: "เริ่มต้นสร้างเลขา AI ของคุณวันนี้"
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
    problemAndSolutionHeader: "Why Choose GenieAI?",
    problemAndSolutionSub: "Compare how we reshape business operations and customer satisfaction.",

    // Features
    featuresHeader: "Key Features to Scale Your Business",
    featuresSub: "Intelligent capabilities tailored for modern service operations.",
    feat1Title: "Smart RAG & CAG Context Engine",
    feat1Desc: "Dynamically routes prompts between full-context CAG or vector-search RAG depending on corpus size for absolute precision.",
    feat2Title: "Seamless Appointment Bookings",
    feat2Desc: "AI checks availability and records calendar reservations on-the-fly using secure AI function calling to prevent scheduling collisions.",
    feat3Title: "1-Click LINE Webhook Integration",
    feat3Desc: "Link your LINE Official Account easily. Deliver answers in natural, human-like message bubbles with typing delays.",

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

    // CTA
    ctaHeading: "Ready to Scale Your Store Operations?",
    ctaSub: "Join over 500+ service merchants using GenieAI to streamline bookings, eliminate double-bookings, and respond to clients instantly.",
    ctaButton: "Create Your AI Assistant Now"
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans selection:bg-[#A2D9E8]/30 selection:text-[#1A365D] overflow-x-hidden transition-colors duration-300">
      
      {/* SECTION 1: HEADER */}
      <header className="sticky top-0 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-slate-200/40 dark:border-white/5 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="bg-gradient-to-br from-[#E6F4F8] to-[#A2D9E8] dark:from-[#1A365D] dark:to-[#2B6CB0] rounded-2xl w-11 h-11 flex items-center justify-center border border-[#A2D9E8]/30 dark:border-white/10 text-[#1A365D] dark:text-cyan-300 shadow-md group-hover:scale-105 transition-transform">
              <Store size={22} className="group-hover:rotate-6 transition-transform" />
            </div>
            <span className="font-extrabold text-xl text-[#1A365D] dark:text-white tracking-tight bg-clip-text">GenieAI</span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-[#2B6CB0] dark:hover:text-cyan-400 transition-colors">{t.features}</a>
            <a href="#pricing" className="hover:text-[#2B6CB0] dark:hover:text-cyan-400 transition-colors">{t.pricing}</a>
            <a href="#faq" className="hover:text-[#2B6CB0] dark:hover:text-cyan-400 transition-colors">{t.faq}</a>
          </nav>

          {/* Auth & Theme & Lang Switcher */}
          <div className="flex items-center gap-3">
            {/* Theme Switcher Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="p-2.5 rounded-xl border border-slate-200/50 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-slate-200/50 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
            >
              <Globe size={13} />
              <span>{lang === 'th' ? 'EN' : 'TH'}</span>
            </button>

            <button 
              onClick={() => onNavigateToAuth('login')}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#2B6CB0] dark:hover:text-cyan-400 px-4 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              {t.login}
            </button>
            <Button
              onClick={() => onNavigateToAuth('signup')}
              className="text-xs font-bold text-white bg-gradient-to-r from-[#2B6CB0] to-cyan-500 hover:opacity-90 px-5 py-2.5 h-10 rounded-xl shadow-lg shadow-[#2B6CB0]/20 dark:shadow-cyan-950/20 cursor-pointer"
            >
              {t.signup}
            </Button>
          </div>
        </div>
      </header>

      {/* SECTION 2: HERO SECTION */}
      <section className="relative pt-24 pb-28 md:py-36 overflow-hidden z-10">
        {/* Glow decoration */}
        <div className="absolute top-1/2 left-2/3 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full bg-[#A2D9E8]/20 dark:bg-cyan-500/10 blur-[120px] pointer-events-none -z-10 animate-pulse duration-5000" />
        <div className="absolute top-1/4 left-1/4 w-[450px] h-[450px] rounded-full bg-[#E6F4F8]/30 dark:bg-[#1A365D]/20 blur-[100px] pointer-events-none -z-10" />
        
        {/* Futuristic background grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10">
          {/* Left Text */}
          <div className="lg:col-span-7 flex flex-col text-left">
            <div className="inline-flex items-center gap-1.5 bg-[#E6F4F8] dark:bg-[#1A365D]/30 border border-[#A2D9E8]/40 dark:border-[#2B6CB0]/30 text-[#2B6CB0] dark:text-cyan-300 text-[10px] font-extrabold px-3.5 py-1.5 rounded-full w-fit mb-8 shadow-sm uppercase tracking-wider">
              <Sparkles size={12} className="animate-spin-slow" />
              <span>Next-Gen AI Shop Assistant</span>
            </div>
            
            <h1 className="text-4xl md:text-5.5xl font-extrabold tracking-tight leading-[1.12] mb-6 text-[#1A365D] dark:text-white">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#1A365D] via-[#2B6CB0] to-cyan-500 dark:from-white dark:via-slate-100 dark:to-cyan-400">
                {t.heroTitle}
              </span>
            </h1>
            
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-10 max-w-xl">
              {t.heroSubtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-5">
              <Button
                onClick={() => onNavigateToAuth('signup')}
                className="font-bold text-white bg-gradient-to-r from-[#2B6CB0] to-cyan-500 hover:opacity-95 px-8 py-4 h-13 rounded-2xl shadow-xl shadow-[#2B6CB0]/25 dark:shadow-cyan-900/10 flex items-center justify-center gap-2 hover-scale cursor-pointer"
              >
                <span className="text-sm">{t.heroCta}</span>
                <ArrowRight size={16} />
              </Button>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold sm:pl-2">
                {t.heroSubCta}
              </span>
            </div>
          </div>

          {/* Right Product Image Mockup */}
          <div className="lg:col-span-5 relative flex justify-center hover-scale duration-500">
            {/* Ambient card glow behind container */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-[#2B6CB0] rounded-3xl opacity-10 blur-xl dark:opacity-20" />
            <div className="relative w-full max-w-[480px] aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border border-slate-200/60 dark:border-white/10 bg-slate-900 group">
              <img
                src="/hero_preview.png"
                alt="GenieAI Dashboard Preview"
                className="w-full h-full object-cover select-none pointer-events-none group-hover:scale-103 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-[#1A365D]/20 to-transparent mix-blend-overlay pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: TRUST BADGES */}
      <section className="py-20 bg-white dark:bg-slate-950/40 border-y border-slate-200/40 dark:border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center">
          <p className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-12 text-center">
            {t.trustedBy}
          </p>
          
          {/* Marquee viewport container with edge fading gradients */}
          <div className="w-full overflow-hidden relative py-2">
            <div className="absolute left-0 top-0 bottom-0 w-20 md:w-40 bg-gradient-to-r from-white dark:from-slate-950 via-white/80 dark:via-slate-950/80 to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-20 md:w-40 bg-gradient-to-l from-white dark:from-slate-950 via-white/80 dark:via-slate-950/80 to-transparent pointer-events-none z-10" />
            
            {/* Moving track */}
            <div className="animate-marquee flex gap-20 md:gap-28 items-center">
              
              {/* Set 1 */}
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_1.png" alt="Partner 1" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Apex Dental Group</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_2.png" alt="Partner 2" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Saneh Hair Group</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_3.png" alt="Partner 3" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">The Garden Group</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_4.png" alt="Partner 4" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Zen Wellness Spa</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_5.png" alt="Partner 5" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Glow Beauty Lounge</span>
              </div>

              {/* Set 2 (Duplicate for seamless loop) */}
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_1.png" alt="Partner 1" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Apex Dental Group</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_2.png" alt="Partner 2" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Saneh Hair Group</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_3.png" alt="Partner 3" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">The Garden Group</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_4.png" alt="Partner 4" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Zen Wellness Spa</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_5.png" alt="Partner 5" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Glow Beauty Lounge</span>
              </div>

              {/* Set 3 (Extra safety duplicate) */}
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_1.png" alt="Partner 1" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Apex Dental Group</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_2.png" alt="Partner 2" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Saneh Hair Group</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_3.png" alt="Partner 3" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">The Garden Group</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_4.png" alt="Partner 4" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Zen Wellness Spa</span>
              </div>
              <div className="flex items-center gap-4 grayscale opacity-40 dark:opacity-30 hover:opacity-100 hover:grayscale-0 dark:hover:opacity-100 transition-all duration-300 select-none cursor-pointer scale-100 md:scale-105">
                <img src="/trust_badge_5.png" alt="Partner 5" className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-1 shadow-sm" />
                <span className="font-bold text-sm md:text-base text-[#1A365D] dark:text-slate-300 tracking-tight">Glow Beauty Lounge</span>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: PROBLEM AND SOLUTION */}
      <section className="py-28 bg-slate-100/30 dark:bg-slate-950/20 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#A2D9E8]/5 dark:bg-cyan-500/5 blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <div className="mb-20">
            <h2 className="text-3xl font-extrabold text-[#1A365D] dark:text-white tracking-tight mb-4">
              {t.problemAndSolutionHeader}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-bold max-w-md mx-auto">
              {t.problemAndSolutionSub}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto items-stretch">
            {/* Problems Card */}
            <div className="glass-panel bg-red-50/10 dark:bg-red-950/5 border border-red-500/10 dark:border-red-500/10 rounded-3xl p-10 shadow-sm flex flex-col text-left hover-scale transition-all duration-300">
              <h3 className="text-lg font-bold text-[#E53E3E] flex items-center gap-3 mb-8 pb-4 border-b border-red-500/10">
                <AlertCircle size={20} />
                <span>{t.problemTitle}</span>
              </h3>
              <ul className="flex flex-col gap-6 text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium">
                <li className="flex items-start gap-4">
                  <span className="w-2 h-2 rounded-full bg-[#E53E3E] mt-2 shrink-0" />
                  <p className="leading-relaxed">{t.problem1}</p>
                </li>
                <li className="flex items-start gap-4">
                  <span className="w-2 h-2 rounded-full bg-[#E53E3E] mt-2 shrink-0" />
                  <p className="leading-relaxed">{t.problem2}</p>
                </li>
                <li className="flex items-start gap-4">
                  <span className="w-2 h-2 rounded-full bg-[#E53E3E] mt-2 shrink-0" />
                  <p className="leading-relaxed">{t.problem3}</p>
                </li>
              </ul>
            </div>

            {/* Solutions Card */}
            <div className="glass-panel bg-gradient-to-br from-[#E6F4F8]/40 to-[#A2D9E8]/20 dark:from-[#1A365D]/20 dark:to-slate-900/40 border border-[#A2D9E8]/30 dark:border-[#2B6CB0]/25 rounded-3xl p-10 shadow-lg shadow-[#2B6CB0]/5 flex flex-col text-left hover-scale glow-brand-blue transition-all duration-300">
              <h3 className="text-lg font-bold text-[#2B6CB0] dark:text-cyan-400 flex items-center gap-3 mb-8 pb-4 border-b border-[#A2D9E8]/20 dark:border-white/5">
                <ShieldCheck size={20} className="text-[#2B6CB0] dark:text-cyan-400" />
                <span>{t.solutionTitle}</span>
              </h3>
              <ul className="flex flex-col gap-6 text-xs md:text-sm text-slate-700 dark:text-slate-300 font-semibold">
                <li className="flex items-start gap-4">
                  <CheckCircle2 size={18} className="text-[#2B6CB0] dark:text-cyan-400 shrink-0 mt-1" />
                  <p className="leading-relaxed">{t.solution1}</p>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle2 size={18} className="text-[#2B6CB0] dark:text-cyan-400 shrink-0 mt-1" />
                  <p className="leading-relaxed">{t.solution2}</p>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle2 size={18} className="text-[#2B6CB0] dark:text-cyan-400 shrink-0 mt-1" />
                  <p className="leading-relaxed">{t.solution3}</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: FEATURES */}
      <section id="features" className="py-28 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="mb-20">
            <h2 className="text-3xl font-extrabold text-[#1A365D] dark:text-white tracking-tight mb-4">
              {t.featuresHeader}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-bold max-w-md mx-auto">
              {t.featuresSub}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="glass-panel p-9 border border-slate-200/30 dark:border-white/5 rounded-3xl hover-scale glow-indigo-cyan transition-all duration-300 flex flex-col text-left bg-slate-50/20 dark:bg-white/2">
              <div className="w-12 h-12 rounded-2xl bg-[#E6F4F8] dark:bg-[#1A365D]/50 flex items-center justify-center text-[#2B6CB0] dark:text-cyan-400 mb-8 border border-[#A2D9E8]/35 dark:border-cyan-500/10 shadow-sm">
                <Zap size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#1A365D] dark:text-white mb-4">{t.feat1Title}</h3>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{t.feat1Desc}</p>
            </div>

            {/* Feature 2 */}
            <div className="glass-panel p-9 border border-slate-200/30 dark:border-white/5 rounded-3xl hover-scale glow-brand-blue transition-all duration-300 flex flex-col text-left bg-slate-50/20 dark:bg-white/2">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-8 border border-purple-100 dark:border-purple-500/10 shadow-sm">
                <Clock size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#1A365D] dark:text-white mb-4">{t.feat2Title}</h3>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{t.feat2Desc}</p>
            </div>

            {/* Feature 3 */}
            <div className="glass-panel p-9 border border-slate-200/30 dark:border-white/5 rounded-3xl hover-scale glow-emerald transition-all duration-300 flex flex-col text-left bg-slate-50/20 dark:bg-white/2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-8 border border-emerald-100 dark:border-emerald-500/10 shadow-sm">
                <Settings size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#1A365D] dark:text-white mb-4">{t.feat3Title}</h3>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{t.feat3Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: SOCIAL PROOF */}
      <section className="py-28 bg-slate-100/30 dark:bg-slate-950/20 relative">
        <div className="absolute top-0 bottom-0 left-0 right-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,#06b6d408,transparent)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <div className="mb-20">
            <h2 className="text-3xl font-extrabold text-[#1A365D] dark:text-white tracking-tight mb-4">
              {t.socialHeader}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-bold max-w-md mx-auto">
              {t.socialSub}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Review 1 */}
            <div className="glass-panel bg-white/70 dark:bg-slate-900/40 p-8 rounded-3xl shadow-sm border border-slate-200/40 dark:border-white/5 flex flex-col justify-between text-left hover-scale transition-all duration-300">
              <div>
                <div className="flex gap-1 text-amber-400 dark:text-amber-500 mb-5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} fill="currentColor" />)}
                </div>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed italic mb-8 font-medium">
                  "{t.review1Text}"
                </p>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-200/30 dark:border-white/5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E6F4F8] to-[#A2D9E8] dark:from-[#1A365D] dark:to-[#2B6CB0] font-bold text-sm flex items-center justify-center text-[#1A365D] dark:text-cyan-300 border border-[#A2D9E8]/30">M</div>
                <div>
                  <h4 className="text-xs md:text-sm font-bold text-[#1A365D] dark:text-white">{t.review1Name}</h4>
                  <span className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-semibold">{t.review1Role}</span>
                </div>
              </div>
            </div>

            {/* Review 2 */}
            <div className="glass-panel bg-white/70 dark:bg-slate-900/40 p-8 rounded-3xl shadow-sm border border-slate-200/40 dark:border-white/5 flex flex-col justify-between text-left hover-scale transition-all duration-300">
              <div>
                <div className="flex gap-1 text-amber-400 dark:text-amber-500 mb-5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} fill="currentColor" />)}
                </div>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed italic mb-8 font-medium">
                  "{t.review2Text}"
                </p>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-200/30 dark:border-white/5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E6F4F8] to-[#A2D9E8] dark:from-[#1A365D] dark:to-[#2B6CB0] font-bold text-sm flex items-center justify-center text-[#1A365D] dark:text-cyan-300 border border-[#A2D9E8]/30">D</div>
                <div>
                  <h4 className="text-xs md:text-sm font-bold text-[#1A365D] dark:text-white">{t.review2Name}</h4>
                  <span className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-semibold">{t.review2Role}</span>
                </div>
              </div>
            </div>

            {/* Review 3 */}
            <div className="glass-panel bg-white/70 dark:bg-slate-900/40 p-8 rounded-3xl shadow-sm border border-slate-200/40 dark:border-white/5 flex flex-col justify-between text-left hover-scale transition-all duration-300">
              <div>
                <div className="flex gap-1 text-amber-400 dark:text-amber-500 mb-5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={15} fill="currentColor" />)}
                </div>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed italic mb-8 font-medium">
                  "{t.review3Text}"
                </p>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-200/30 dark:border-white/5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E6F4F8] to-[#A2D9E8] dark:from-[#1A365D] dark:to-[#2B6CB0] font-bold text-sm flex items-center justify-center text-[#1A365D] dark:text-cyan-300 border border-[#A2D9E8]/30">K</div>
                <div>
                  <h4 className="text-xs md:text-sm font-bold text-[#1A365D] dark:text-white">{t.review3Name}</h4>
                  <span className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-semibold">{t.review3Role}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: PRICING */}
      <section id="pricing" className="py-28 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="mb-20">
            <h2 className="text-3xl font-extrabold text-[#1A365D] dark:text-white tracking-tight mb-4">
              {t.priceHeader}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-bold max-w-md mx-auto">
              {t.priceSub}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
            {/* Start Tier */}
            <div className="glass-panel border border-slate-200/40 dark:border-white/5 rounded-3xl p-9 flex flex-col justify-between text-left bg-slate-50/20 dark:bg-white/2 hover-scale transition-all duration-300">
              <div>
                <h3 className="text-base font-extrabold text-[#1A365D] dark:text-white mb-2">{t.tierStart}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-400 mb-8">{t.startDesc}</p>
                <div className="mb-8">
                  <span className="text-3xl font-extrabold text-[#1A365D] dark:text-white">{t.priceStart}</span>
                </div>
                
                <ul className="flex flex-col gap-4 text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mb-8">
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-[#2B6CB0] dark:text-cyan-400" />
                    <span>{t.priceFeature1}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-[#2B6CB0] dark:text-cyan-400" />
                    <span>{t.priceFeature2}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-[#2B6CB0] dark:text-cyan-400" />
                    <span>{t.priceFeature3}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-[#2B6CB0] dark:text-cyan-400" />
                    <span>{t.priceFeature4}</span>
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => onNavigateToAuth('signup')}
                className="w-full text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 h-11 rounded-xl cursor-pointer"
              >
                {t.buyBtn}
              </Button>
            </div>

            {/* Pro Tier (Popular) */}
            <div className="bg-gradient-to-b from-[#1A365D] to-[#2B6CB0] dark:from-[#112240] dark:to-[#1A365D] text-white border-none rounded-3xl p-9 flex flex-col justify-between text-left shadow-2xl relative scale-105 z-10 hover-scale transition-all duration-300">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-400 to-[#2B6CB0] text-[#1A365D] dark:text-white text-[10px] font-extrabold uppercase px-4 py-1.5 rounded-full tracking-wider shadow-md">
                {t.popular}
              </span>
              <div>
                <h3 className="text-base font-extrabold text-cyan-300 mb-2">{t.tierPro}</h3>
                <p className="text-xs text-slate-200 dark:text-slate-300 mb-8">{t.proDesc}</p>
                <div className="mb-8">
                  <span className="text-3xl font-extrabold text-white">{t.pricePro}</span>
                </div>
                
                <ul className="flex flex-col gap-4 text-xs md:text-sm text-slate-100 font-semibold mb-8">
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-300" />
                    <span>{t.priceFeature1}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-300" />
                    <span>{t.priceFeature5}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-300" />
                    <span>{t.priceFeature6}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-300" />
                    <span>{t.priceFeature7}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-cyan-300" />
                    <span>{t.priceFeature8}</span>
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => onNavigateToAuth('signup')}
                className="w-full text-xs font-extrabold text-[#1A365D] bg-white hover:bg-slate-100 shadow-xl h-11 rounded-xl cursor-pointer"
              >
                {t.buyBtn}
              </Button>
            </div>

            {/* Premium Tier */}
            <div className="glass-panel border border-slate-200/40 dark:border-white/5 rounded-3xl p-9 flex flex-col justify-between text-left bg-slate-50/20 dark:bg-white/2 hover-scale transition-all duration-300">
              <div>
                <h3 className="text-base font-extrabold text-[#1A365D] dark:text-white mb-2">{t.tierPremium}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-400 mb-8">{t.premiumDesc}</p>
                <div className="mb-8">
                  <span className="text-3xl font-extrabold text-[#1A365D] dark:text-white">{t.pricePremium}</span>
                </div>
                
                <ul className="flex flex-col gap-4 text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mb-8">
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-[#2B6CB0] dark:text-cyan-400" />
                    <span>{t.priceFeature5}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-[#2B6CB0] dark:text-cyan-400" />
                    <span>{t.priceFeature6}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-[#2B6CB0] dark:text-cyan-400" />
                    <span>{t.priceFeature9}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-[#2B6CB0] dark:text-cyan-400" />
                    <span>{t.priceFeature10}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check size={16} className="text-[#2B6CB0] dark:text-cyan-400" />
                    <span>{t.priceFeature11}</span>
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => onNavigateToAuth('signup')}
                className="w-full text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 h-11 rounded-xl cursor-pointer"
              >
                {t.buyBtn}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: FAQ */}
      <section id="faq" className="py-28 bg-slate-100/30 dark:bg-slate-950/20 relative">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl font-extrabold text-[#1A365D] dark:text-white tracking-tight mb-4">
              {t.faqHeader}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-bold max-w-md mx-auto">
              {t.faqSub}
            </p>
          </div>

          <div className="flex flex-col gap-5">
            {/* FAQ 1 */}
            <div className="glass-panel bg-white dark:bg-slate-900/50 border border-slate-200/40 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm hover-scale transition-all duration-300">
              <button
                onClick={() => toggleFaq(1)}
                className="w-full px-7 py-5.5 flex justify-between items-center text-left text-xs md:text-sm font-bold text-[#1A365D] dark:text-white hover:bg-slate-50/50 dark:hover:bg-white/2 cursor-pointer transition-colors"
              >
                <span>{t.faqQ1}</span>
                {openFaq === 1 ? <ChevronUp size={18} className="text-[#2B6CB0] dark:text-cyan-400" /> : <ChevronDown size={18} className="text-slate-400 dark:text-slate-500" />}
              </button>
              {openFaq === 1 && (
                <div className="px-7 pb-6 text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-left border-t border-slate-100 dark:border-white/5 pt-4 font-medium">
                  {t.faqA1}
                </div>
              )}
            </div>

            {/* FAQ 2 */}
            <div className="glass-panel bg-white dark:bg-slate-900/50 border border-slate-200/40 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm hover-scale transition-all duration-300">
              <button
                onClick={() => toggleFaq(2)}
                className="w-full px-7 py-5.5 flex justify-between items-center text-left text-xs md:text-sm font-bold text-[#1A365D] dark:text-white hover:bg-slate-50/50 dark:hover:bg-white/2 cursor-pointer transition-colors"
              >
                <span>{t.faqQ2}</span>
                {openFaq === 2 ? <ChevronUp size={18} className="text-[#2B6CB0] dark:text-cyan-400" /> : <ChevronDown size={18} className="text-slate-400 dark:text-slate-500" />}
              </button>
              {openFaq === 2 && (
                <div className="px-7 pb-6 text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-left border-t border-slate-100 dark:border-white/5 pt-4 font-medium">
                  {t.faqA2}
                </div>
              )}
            </div>

            {/* FAQ 3 */}
            <div className="glass-panel bg-white dark:bg-slate-900/50 border border-slate-200/40 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm hover-scale transition-all duration-300">
              <button
                onClick={() => toggleFaq(3)}
                className="w-full px-7 py-5.5 flex justify-between items-center text-left text-xs md:text-sm font-bold text-[#1A365D] dark:text-white hover:bg-slate-50/50 dark:hover:bg-white/2 cursor-pointer transition-colors"
              >
                <span>{t.faqQ3}</span>
                {openFaq === 3 ? <ChevronUp size={18} className="text-[#2B6CB0] dark:text-cyan-400" /> : <ChevronDown size={18} className="text-slate-400 dark:text-slate-500" />}
              </button>
              {openFaq === 3 && (
                <div className="px-7 pb-6 text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-left border-t border-slate-100 dark:border-white/5 pt-4 font-medium">
                  {t.faqA3}
                </div>
              )}
            </div>

            {/* FAQ 4 */}
            <div className="glass-panel bg-white dark:bg-slate-900/50 border border-slate-200/40 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm hover-scale transition-all duration-300">
              <button
                onClick={() => toggleFaq(4)}
                className="w-full px-7 py-5.5 flex justify-between items-center text-left text-xs md:text-sm font-bold text-[#1A365D] dark:text-white hover:bg-slate-50/50 dark:hover:bg-white/2 cursor-pointer transition-colors"
              >
                <span>{t.faqQ4}</span>
                {openFaq === 4 ? <ChevronUp size={18} className="text-[#2B6CB0] dark:text-cyan-400" /> : <ChevronDown size={18} className="text-slate-400 dark:text-slate-500" />}
              </button>
              {openFaq === 4 && (
                <div className="px-7 pb-6 text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-left border-t border-slate-100 dark:border-white/5 pt-4 font-medium">
                  {t.faqA4}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 9: CALL TO ACTION */}
      <section className="py-24 bg-gradient-to-br from-[#1A365D] via-[#112240] to-slate-950 text-white relative overflow-hidden border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,#06b6d415,transparent)] pointer-events-none" />
        {/* Decorative subtle background bubbles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#2B6CB0]/15 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 bg-white/10 text-cyan-300 text-[10px] font-extrabold px-4 py-1.5 rounded-full w-fit mb-8 border border-white/10 uppercase tracking-wider">
            <Sparkles size={12} className="animate-pulse" />
            <span>Scale with Automation</span>
          </div>
          
          <h2 className="text-3xl md:text-4.5xl font-extrabold tracking-tight mb-6 leading-tight max-w-2xl bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-cyan-200">
            {t.ctaHeading}
          </h2>
          
          <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed mb-10 font-medium">
            {t.ctaSub}
          </p>

          <Button
            onClick={() => onNavigateToAuth('signup')}
            className="font-bold text-[#1A365D] bg-white hover:bg-slate-100 px-8 py-4 h-13 rounded-2xl shadow-xl shadow-black/25 flex items-center justify-center gap-2.5 hover-scale cursor-pointer"
          >
            <span className="text-sm">{t.ctaButton}</span>
            <ArrowRight size={16} />
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-white py-20 border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-12 relative z-10">
          <div className="md:col-span-5 text-left flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-2xl w-10 h-10 flex items-center justify-center border border-white/15 text-white shadow-md">
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
              <h4 className="text-white text-xs font-extrabold uppercase tracking-wider mb-2">Product</h4>
              <a href="#features" className="hover:text-cyan-400 transition-colors">{t.features}</a>
              <a href="#pricing" className="hover:text-cyan-400 transition-colors">{t.pricing}</a>
              <a href="#faq" className="hover:text-cyan-400 transition-colors">{t.faq}</a>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="text-white text-xs font-extrabold uppercase tracking-wider mb-2">Company</h4>
              <span className="hover:text-cyan-400 cursor-pointer transition-colors">About Us</span>
              <span className="hover:text-cyan-400 cursor-pointer transition-colors">Blog</span>
              <span className="hover:text-cyan-400 cursor-pointer transition-colors">Contact</span>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="text-white text-xs font-extrabold uppercase tracking-wider mb-2">Legal</h4>
              <span className="hover:text-cyan-400 cursor-pointer transition-colors">Terms of Service</span>
              <span className="hover:text-cyan-400 cursor-pointer transition-colors">Privacy Policy</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 mt-16 pt-10 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-slate-500 font-bold">
          <span>&copy; {new Date().getFullYear()} GenieAI. {t.rightsReserved}</span>
          <span className="tracking-widest uppercase">DESIGNED FOR BEAUTY CLINICS, SALONS & SERVICE MERCHANTS</span>
        </div>
      </footer>

    </div>
  );
};

export default Homepage;
