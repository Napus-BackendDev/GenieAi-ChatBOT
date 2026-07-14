import { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, CheckCircle, AlertCircle, Plus, Trash2, ArrowRight, ArrowLeft,
  RefreshCw, Store, Phone, HelpCircle, Clock, ChevronDown, Sparkles, PartyPopper, Loader2
} from 'lucide-react';
import { Button } from '@heroui/react';
import ChannelConnectCard from '../components/ChannelConnectCard';

const MAX_FILE_MB = 15;
const ALLOWED_EXT = ['pdf', 'txt', 'md'];

const TR = {
  th: {
    brand: 'ตั้งค่าร้านค้า',
    heroTitle: 'สร้างผู้ช่วย AI ประจำร้าน',
    heroSub: 'ทำตามขั้นตอนง่าย ๆ เพื่อให้ AI ตอบลูกค้าและรับจองแทนคุณ',
    stepOf: (n, total) => `ขั้นตอน ${n} จาก ${total}`,
    pctDone: 'เสร็จแล้ว',
    support: 'มีคำถาม? ติดต่อเรา',
    // step names (timeline)
    s1: 'อัปโหลดคู่มือ',
    s1sub: 'ไฟล์รายละเอียดบริการของร้าน',
    s2: 'เชื่อมต่อ LINE / Facebook',
    s2sub: 'ให้ AI ตอบผ่านแชท',
    s3: 'ข้อมูลธุรกิจ',
    s3sub: 'ชื่อร้าน เวลาทำการ เบอร์ติดต่อ',
    s4: 'บริการ',
    s4sub: 'รายการบริการและราคา',
    s5: 'ทีมงาน',
    s5sub: 'รายชื่อผู้ให้บริการ',
    s6: 'โปรโมชัน',
    s6sub: 'ข้อเสนอและส่วนลดพิเศษ',
    s7: 'คำถามที่พบบ่อย',
    s7sub: 'คำถามพบบ่อยสำหรับ AI',
    s8: 'กฎและนโยบายเพิ่มเติม',
    s8sub: 'กฎเกณฑ์การบริการของร้าน',
    s9: 'เสร็จสิ้น',
    s9sub: 'เริ่มใช้งานได้เลย',
    // step 1 info
    infoTitle: 'ข้อมูลร้านของคุณ',
    infoSub: 'บอกเราสักนิดเกี่ยวกับร้านของคุณ เพื่อให้ AI แนะนำตัวกับลูกค้าได้ถูกต้อง',
    companyLabel: 'ชื่อร้าน / ธุรกิจ',
    companyPh: 'เช่น ร้านเสน่ห์เกศา',
    typeLabel: 'ประเภทธุรกิจ',
    typePh: 'เช่น ร้านทำผม, คลินิกความงาม, ร้านอาหาร',
    contactLabel: 'เบอร์ติดต่อร้าน',
    contactPh: 'เช่น 081-234-5678',
    phoneLabel: 'เบอร์โทรของคุณ (สำหรับเข้าสู่ระบบ)',
    phonePh: 'เบอร์โทรของเจ้าของร้าน',
    infoNeedName: 'กรุณากรอกชื่อร้านของคุณ',
    // step 2 upload
    uploadTitle: 'อัปโหลดคู่มือหรือรายการบริการ',
    uploadSub: 'อัปโหลดไฟล์ที่มีรายการบริการ ราคา เวลาทำการ หรือคำถามที่ลูกค้าถามบ่อย แล้ว AI จะอ่านให้เอง',
    dropHere: 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์',
    dropHint: 'รองรับไฟล์ PDF, TXT หรือ MD (ไม่เกิน 15MB)',
    tipTitle: 'เคล็ดลับการเตรียมไฟล์',
    tipBody: 'ไฟล์ที่ดีควรมี รายการบริการและราคา เวลาทำการ เงื่อนไขการนัด และคำถามที่ลูกค้าถามบ่อย เพื่อให้ AI ตอบได้ครบถ้วน',
    processingBg: 'กำลังประมวลผลเบื้องหลัง',
    fileTooBig: 'ไฟล์ใหญ่เกินไป (เกิน 15MB) กรุณาเลือกไฟล์ที่เล็กกว่านี้',
    fileWrongType: 'รองรับเฉพาะไฟล์ PDF, TXT หรือ MD เท่านั้น',
    uploadFailed: 'อัปโหลดไม่สำเร็จ',
    retry: 'ลองอีกครั้ง',
    // step 3 connect
    connectSkip: 'ข้ามไปก่อน',
    connectNote: 'ขั้นตอนนี้ข้ามไปก่อนได้ แล้วค่อยกลับมาเชื่อมต่อภายหลังในหน้าตั้งค่า',
    // step 4 review
    reviewReading: 'กำลังอ่านคู่มือของคุณ...',
    reviewReadingSub: 'AI กำลังสรุปข้อมูลร้านของคุณ ใช้เวลาสักครู่',
    reviewFound: (n) => `เราอ่านคู่มือของคุณแล้ว เจอ ${n} บริการ`,
    reviewFoundZero: 'เราอ่านคู่มือของคุณแล้ว กรุณาตรวจสอบข้อมูลด้านล่าง',
    reviewSub: 'ตรวจสอบว่าข้อมูลถูกต้องไหม แก้ไขได้ตามต้องการ แล้วกดยืนยัน',
    fName: 'ชื่อร้าน',
    fHours: 'เวลาทำการ',
    fHoursPh: 'เช่น เปิดทุกวัน 09:00 - 20:00 น.',
    fPhone: 'เบอร์ติดต่อ',
    servicesTitle: 'บริการและราคา',
    addService: 'เพิ่มบริการ',
    noServices: 'ยังไม่มีรายการบริการ กดเพิ่มบริการได้เลย',
    svcNamePh: 'เช่น ตัดผมชาย',
    svcPricePh: 'บาท',
    svcDurPh: 'นาที',
    seeMore: 'ดูเพิ่มเติม',
    seeLess: 'ย่อลง',
    moreTitle: 'ข้อมูลเพิ่มเติม (โปรโมชัน, ทีมงาน, คำถามที่พบบ่อย)',
    promosTitle: 'โปรโมชัน',
    addPromo: 'เพิ่มโปรโมชัน',
    noPromos: 'ไม่มีโปรโมชัน',
    promoNamePh: 'ชื่อโปรโมชัน',
    promoDiscPh: 'ส่วนลด',
    promoDescPh: 'รายละเอียดเงื่อนไข',
    staffTitle: 'ทีมงาน',
    addStaff: 'เพิ่มทีมงาน',
    noStaff: 'ไม่มีรายชื่อทีมงาน',
    staffNamePh: 'ชื่อทีมงาน',
    staffRolePh: 'ตำแหน่ง',
    staffSpecPh: 'ความเชี่ยวชาญ (คั่นด้วย ,)',
    faqTitle: 'คำถามที่พบบ่อย',
    addFaq: 'เพิ่มคำถาม',
    noFaq: 'ไม่มีคำถามที่พบบ่อย',
    faqQPh: 'คำถาม',
    faqAPh: 'คำตอบ',
    rulesTitle: 'กฎและนโยบายเพิ่มเติม',
    addRule: 'เพิ่มกฎ',
    noRules: 'ไม่มีกฎเพิ่มเติม',
    ruleCatPh: 'หมวดหมู่ (เช่น นโยบายการยกเลิกนัด)',
    ruleTextPh: 'รายละเอียดกฎ',
    advanced: 'ขั้นสูง: ดูข้อความต้นฉบับ',
    rawText: 'ข้อความต้นฉบับจากไฟล์',
    invalidService: 'กรุณากรอกชื่อบริการให้ครบ และระบุราคา (ไม่ต่ำกว่า 0) กับเวลา (มากกว่า 0 นาที) ให้ถูกต้อง',
    saveFailed: 'บันทึกข้อมูลไม่สำเร็จ',
    parseFailed: 'อ่านคู่มือไม่สำเร็จ กรุณาลองอัปโหลดใหม่',
    // step 5 done
    doneTitle: 'เสร็จเรียบร้อย! 🎉',
    doneSub: 'ผู้ช่วย AI ของคุณพร้อมทำงานแล้ว ลูกค้าสามารถเริ่มแชทและจองนัดได้ทันที',
    goDashboard: 'เข้าสู่หน้าแดชบอร์ด',
    // nav buttons
    next: 'ถัดไป',
    back: 'ย้อนกลับ',
    confirm: 'ยืนยันข้อมูล',
    netErr: 'เชื่อมต่อระบบไม่ได้ — กรุณาตรวจสอบว่าโปรแกรม GenieAI กำลังเปิดอยู่ (หน้าต่างสีดำ 2 อัน) แล้วลองใหม่อีกครั้ง'
  },
  en: {
    brand: 'Partner Setup',
    heroTitle: 'Build your shop’s AI assistant',
    heroSub: 'Follow simple steps so the AI can answer customers and take bookings for you.',
    stepOf: (n, total) => `Step ${n} of ${total}`,
    pctDone: 'done',
    support: 'Questions? Contact us',
    s1: 'Upload manual',
    s1sub: 'Your service details file',
    s2: 'Connect LINE / Facebook',
    s2sub: 'Let AI reply on chat',
    s3: 'Business info',
    s3sub: 'Name, hours & phone',
    s4: 'Services',
    s4sub: 'Services & pricing list',
    s5: 'Staff',
    s5sub: 'Service providers & roles',
    s6: 'Promotions',
    s6sub: 'Deals & special offers',
    s7: 'FAQ',
    s7sub: 'Frequently asked questions',
    s8: 'Extra rules & policies',
    s8sub: 'Custom AI behavioral rules',
    s9: 'Done',
    s9sub: 'Ready to go',
    infoTitle: 'Your shop information',
    infoSub: 'Tell us a bit about your shop so the AI can introduce itself correctly to customers.',
    companyLabel: 'Shop / business name',
    companyPh: 'e.g. Sane Kesa Salon',
    typeLabel: 'Business type',
    typePh: 'e.g. Hair salon, beauty clinic, restaurant',
    contactLabel: 'Shop contact number',
    contactPh: 'e.g. 081-234-5678',
    phoneLabel: 'Your phone (for login)',
    phonePh: 'Owner’s phone number',
    infoNeedName: 'Please enter your shop name.',
    uploadTitle: 'Upload a manual or service list',
    uploadSub: 'Upload a file with your services, prices, hours, or common questions — the AI will read it for you.',
    dropHere: 'Drag a file here, or click to choose',
    dropHint: 'Supports PDF, TXT or MD (max 15MB)',
    tipTitle: 'Tips for preparing your file',
    tipBody: 'A good file includes services and prices, opening hours, booking conditions, and common customer questions so the AI can answer fully.',
    processingBg: 'Processing in the background',
    fileTooBig: 'File is too large (over 15MB). Please choose a smaller file.',
    fileWrongType: 'Only PDF, TXT or MD files are supported.',
    uploadFailed: 'Upload failed',
    retry: 'Try again',
    connectSkip: 'Skip for now',
    connectNote: 'You can skip this and connect later from the Settings page.',
    reviewReading: 'Reading your manual...',
    reviewReadingSub: 'The AI is summarizing your shop info. This takes a moment.',
    reviewFound: (n) => `We read your manual and found ${n} services.`,
    reviewFoundZero: 'We read your manual. Please review the details below.',
    reviewSub: 'Check that everything looks right, edit as needed, then confirm.',
    fName: 'Shop name',
    fHours: 'Opening hours',
    fHoursPh: 'e.g. Open daily 09:00 - 20:00',
    fPhone: 'Contact number',
    servicesTitle: 'Services & prices',
    addService: 'Add service',
    noServices: 'No services yet. Tap add service to start.',
    svcNamePh: 'e.g. Men’s haircut',
    svcPricePh: 'THB',
    svcDurPh: 'min',
    seeMore: 'See more',
    seeLess: 'See less',
    moreTitle: 'More details (promotions, team, FAQ)',
    promosTitle: 'Promotions',
    addPromo: 'Add promotion',
    noPromos: 'No promotions',
    promoNamePh: 'Promotion name',
    promoDiscPh: 'Discount',
    promoDescPh: 'Conditions / details',
    staffTitle: 'Team',
    addStaff: 'Add member',
    noStaff: 'No team members',
    staffNamePh: 'Member name',
    staffRolePh: 'Role',
    staffSpecPh: 'Specialties (comma separated)',
    faqTitle: 'FAQ',
    addFaq: 'Add question',
    noFaq: 'No FAQ',
    faqQPh: 'Question',
    faqAPh: 'Answer',
    rulesTitle: 'Extra rules & policies',
    addRule: 'Add rule',
    noRules: 'No extra rules',
    ruleCatPh: 'Category (e.g. cancellation policy)',
    ruleTextPh: 'Rule details',
    advanced: 'Advanced: view original text',
    rawText: 'Original text from your file',
    invalidService: 'Please fill every service name, and set a valid price (≥ 0) and time (> 0 min).',
    saveFailed: 'Could not save your data.',
    parseFailed: 'Could not read the manual. Please try uploading again.',
    doneTitle: 'All set! 🎉',
    doneSub: 'Your AI assistant is ready. Customers can start chatting and booking right away.',
    goDashboard: 'Go to dashboard',
    next: 'Next',
    back: 'Back',
    confirm: 'Confirm',
    netErr: 'Cannot reach the system — please make sure GenieAI is running (the two black windows), then try again.'
  }
};

const OnboardingUpload = ({ tenantId, user = {}, lang = 'th', onOnboardingComplete }) => {
  const t = TR[lang] || TR.th;
  const [step, setStep] = useState(1); // 1..5

  // Step 1 — shop info
  const [companyName, setCompanyName] = useState(user.company_name || '');
  const [businessType, setBusinessType] = useState(user.business_type || '');
  const [contactNumber, setContactNumber] = useState('');
  const [ownerPhone, setOwnerPhone] = useState(user.phone || '');

  // Step 2 — upload
  const [fileName, setFileName] = useState('');
  const [jobId, setJobId] = useState('');

  // Step 4 — extracted / editable
  const [rawText, setRawText] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [services, setServices] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [staff, setStaff] = useState([]);
  const [faq, setFaq] = useState([]);
  const [customRules, setCustomRules] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [showAutoFillBanner, setShowAutoFillBanner] = useState(false);

  const [lineConfigured, setLineConfigured] = useState(false);
  const [facebookConfigured, setFacebookConfigured] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  // Prefill from saved profile (company/contact/hours) when returning.
  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const res = await fetch(`/api/tenant/profile/${tenantId}`);
        if (!res.ok) return;
        const p = await res.json();
        if (p.company_name && !companyName) setCompanyName(p.company_name);
        if (p.contact_number && !contactNumber) setContactNumber(p.contact_number);
        if (p.business_hours) setBusinessHours(p.business_hours);
        setLineConfigured(!!p.line_configured);
        setFacebookConfigured(!!p.facebook_configured);
      } catch {
        // backend down -> just proceed with empty prefill (no crash)
      }
    })();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // ---- Step 1: save shop info ----
  const handleInfoNext = async () => {
    setError('');
    if (!companyName.trim()) {
      setError(t.infoNeedName);
      return;
    }
    // Persist questionnaire (info step is self-contained, not dependent on AuthPage).
    // Fire-and-forget so navigation is instant and never blocked by a slow/down
    // backend; the same fields are re-saved in the final profile POST at step 4.
    fetch('/api/auth/questionnaire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantId,
        email: user.email || '',
        phone: (ownerPhone || user.phone || '').trim(),
        company_name: companyName.trim(),
        business_type: businessType.trim()
      })
    }).catch(() => {});
    setStep(2);
  };

  // ---- Step 2: file validation + async upload ----
  const validateFile = (file) => {
    if (!file) return t.fileWrongType;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) return t.fileWrongType;
    if (file.size > MAX_FILE_MB * 1024 * 1024) return t.fileTooBig;
    return '';
  };

  const startUpload = async (file) => {
    setError('');
    const msg = validateFile(file);
    if (msg) {
      setError(msg);
      return;
    }
    setFileName(file.name);
    setParseError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/documents/upload?tenant_id=${tenantId}`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.job_id) {
        throw new Error(data.detail || t.uploadFailed);
      }
      setJobId(data.job_id);
      setStep(2); // auto-advance instantly; parsing continues in background
    } catch (err) {
      setError(err.message === t.uploadFailed ? t.uploadFailed : t.netErr);
    }
  };

  const onFileDrop = (e) => {
    e.preventDefault();
    startUpload(e.dataTransfer.files[0]);
  };

  // ---- Step 4: poll upload status ----
  const beginPolling = () => {
    if (!jobId) return;
    setParsing(true);
    setParseError('');
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const res = await fetch(`/api/documents/upload/status/${jobId}`);
        const data = await res.json().catch(() => ({ status: 'error' }));
        if (data.status === 'done') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          const ext = data.extracted_json || {};
          setRawText(data.raw_text || '');
          setExtractedData(ext);
          setShowAutoFillBanner(true);
          setParsing(false);
          setJobId(null);
        } else if (data.status === 'error') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setParsing(false);
          setParseError(t.parseFailed);
        }
      } catch {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setParsing(false);
        setParseError(t.netErr);
      }
    };
    poll();
    pollRef.current = setInterval(poll, 2500);
  };

  useEffect(() => {
    if (jobId) beginPolling();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const applyAutoFill = () => {
    if (!extractedData) return;
    const ext = extractedData;
    if (ext.company_name) setCompanyName(ext.company_name);
    if (ext.business_hours) setBusinessHours(ext.business_hours);
    if (ext.contact_number) setContactNumber(ext.contact_number);
    if (ext.services && ext.services.length) setServices(ext.services);
    if (ext.promotions && ext.promotions.length) setPromotions(ext.promotions);
    if (ext.staff && ext.staff.length) setStaff(ext.staff);
    if (ext.faq && ext.faq.length) setFaq(ext.faq);
    if (ext.custom_rules && ext.custom_rules.length) setCustomRules(ext.custom_rules);
    setShowAutoFillBanner(false);
  };

  // ---- generic list helpers ----
  const addService = () => setServices([...services, { name: '', price: 0, duration: 30 }]);
  const removeService = (i) => setServices(services.filter((_, x) => x !== i));
  const changeService = (i, f, v) => {
    const u = [...services];
    u[i][f] = f === 'price' || f === 'duration' ? Number(v) : v;
    setServices(u);
  };
  const addPromo = () => setPromotions([...promotions, { name: '', description: '', discount: '', valid_until: '', conditions: '' }]);
  const removePromo = (i) => setPromotions(promotions.filter((_, x) => x !== i));
  const changePromo = (i, f, v) => { const u = [...promotions]; u[i][f] = v; setPromotions(u); };
  const addStaff = () => setStaff([...staff, { name: '', role: '', specialties: [], experience: '' }]);
  const removeStaff = (i) => setStaff(staff.filter((_, x) => x !== i));
  const changeStaff = (i, f, v) => {
    const u = [...staff];
    u[i][f] = f === 'specialties' ? v.split(',').map(s => s.trim()).filter(Boolean) : v;
    setStaff(u);
  };
  const addFaq = () => setFaq([...faq, { question: '', answer: '' }]);
  const removeFaq = (i) => setFaq(faq.filter((_, x) => x !== i));
  const changeFaq = (i, f, v) => { const u = [...faq]; u[i][f] = v; setFaq(u); };
  const addRule = () => setCustomRules([...customRules, { category: '', rule: '' }]);
  const removeRule = (i) => setCustomRules(customRules.filter((_, x) => x !== i));
  const changeRule = (i, f, v) => { const u = [...customRules]; u[i][f] = v; setCustomRules(u); };

  // ---- Step 4: confirm + save profile ----
  const handleConfirm = async () => {
    setError('');
    const bad = services.find(s => !s.name.trim() || s.price < 0 || s.duration <= 0);
    if (bad) {
      setError(t.invalidService);
      return;
    }
    setSaving(true);
    try {
      let existing = {};
      try {
        const pr = await fetch(`/api/tenant/profile/${tenantId}`);
        if (pr.ok) existing = await pr.json();
      } catch { /* proceed with what we have */ }

      const res = await fetch(`/api/tenant/profile/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          business_hours: businessHours,
          contact_number: contactNumber,
          services,
          promotions: promotions.length ? promotions : (existing.promotions || []),
          staff: staff.length ? staff : (existing.staff || []),
          faq: faq.length ? faq : (existing.faq || []),
          custom_rules: customRules.length ? customRules : (existing.custom_rules || [])
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || t.saveFailed);
      }
      setStep(9);
    } catch (err) {
      setError(err.message === t.saveFailed ? t.saveFailed : t.netErr);
    } finally {
      setSaving(false);
    }
  };

  // ---- step timeline data ----
  const steps = [
    { n: 1, title: t.s1, sub: t.s1sub },
    { n: 2, title: t.s2, sub: t.s2sub },
    { n: 3, title: t.s3, sub: t.s3sub },
    { n: 4, title: t.s4, sub: t.s4sub },
    { n: 5, title: t.s5, sub: t.s5sub },
    { n: 6, title: t.s6, sub: t.s6sub },
    { n: 7, title: t.s7, sub: t.s7sub },
    { n: 8, title: t.s8, sub: t.s8sub },
    { n: 9, title: t.s9, sub: t.s9sub }
  ];
  const pct = Math.round((step / steps.length) * 100);
  const cur = steps[step - 1];

  const sectionBtn = 'text-[10px] font-bold text-[#2B6CB0] border border-[#2B6CB0]/25 px-2 py-0.5 rounded hover:bg-[#2B6CB0]/5 transition-colors cursor-pointer flex items-center gap-1';
  const inputCls = 'w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]';
  const rowInput = 'h-9 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]';
  const delBtn = 'w-8 h-8 rounded-lg bg-[#E53E3E]/10 hover:bg-[#E53E3E]/20 text-[#E53E3E] flex items-center justify-center border border-[#E53E3E]/20 transition-colors cursor-pointer shrink-0';
  const emptyCls = 'py-5 text-center text-slate-400 text-xs';

  return (
    <div className="min-h-screen w-full flex bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300">

      {/* Left step timeline */}
      <aside className="hidden lg:flex w-[320px] h-screen sticky top-0 flex-col p-8 bg-white dark:bg-slate-950 border-r border-[#A2D9E8]/35 dark:border-white/5 text-left justify-between shrink-0 z-20">
        <div className="flex flex-col gap-10">
          <div className="flex items-center gap-3">
            <div className="bg-[#E6F4F8] dark:bg-[#2B6CB0]/20 rounded-xl w-10 h-10 flex items-center justify-center border border-[#A2D9E8]/35 text-[#1A365D] dark:text-cyan-300 shadow-sm">
              <Store size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight text-[#1A365D] dark:text-white">GenieAI</h2>
              <span className="text-[10px] font-bold text-[#2B6CB0] tracking-wider uppercase">{t.brand}</span>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-bold text-[#1A365D] dark:text-white leading-snug">{t.heroTitle}</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">{t.heroSub}</p>
          </div>

          <nav className="flex flex-col gap-6 relative pl-3">
            <div className="absolute left-[25px] top-3 bottom-3 w-[1.5px] bg-[#E6F4F8] dark:bg-white/10 -z-10"></div>
            {steps.map((it) => {
              const isActive = step === it.n;
              const isDone = step > it.n;
              return (
                <div key={it.n} className="flex gap-4 items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${
                    isActive
                      ? 'bg-[#2B6CB0] border-[#2B6CB0] text-white scale-110 shadow-md shadow-[#2B6CB0]/20'
                      : isDone
                      ? 'bg-[#38A169] border-[#38A169] text-white'
                      : 'bg-white dark:bg-slate-900 border-[#A2D9E8]/30 dark:border-white/10 text-slate-400'
                  }`}>
                    {isDone ? '✓' : it.n}
                  </div>
                  <div className="text-left">
                    <p className={`text-xs font-bold ${isActive || isDone ? 'text-[#1A365D] dark:text-white' : 'text-slate-400'}`}>{it.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{it.sub}</p>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="text-[10px] text-slate-400 font-medium leading-relaxed">
          {t.support}<br />
          <span className="text-[#2B6CB0] font-bold">support@genieai.co</span>
        </div>
      </aside>

      {/* Main workspace */}
      <main className="flex-1 bg-[#E6F4F8]/15 dark:bg-slate-900/40 p-6 md:p-12 overflow-y-auto flex flex-col">

        {/* Progress header */}
        <div className="w-full flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span className="text-[#1A365D] dark:text-white">{t.stepOf(step, steps.length)}: {cur.title}</span>
            <span className="text-[#2B6CB0]">{pct}% {t.pctDone}</span>
          </div>
          <div className="w-full bg-[#E6F4F8] dark:bg-white/10 h-2 rounded-full overflow-hidden shadow-inner">
            <div className="bg-gradient-to-r from-[#2B6CB0] to-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
          </div>
        </div>

        {/* Background parsing / Auto-fill alerts */}
        {jobId && parsing && (
          <div className="mt-5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-left animate-pulse">
            <div className="flex items-center gap-3">
              <RefreshCw size={18} className="text-[#2B6CB0] animate-spin shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">🤖 AI กำลังอ่านคู่มือของคุณในหลังบ้าน...</h4>
                <p className="text-[10px] text-blue-500/80 mt-0.5">คุณสามารถตั้งค่าขั้นตอนอื่นต่อได้ทันที ข้อมูลจะถูกวิเคราะห์อัตโนมัติในแถบถัดไป</p>
              </div>
            </div>
          </div>
        )}

        {showAutoFillBanner && extractedData && (
          <div className="mt-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/30 rounded-2xl p-4 flex items-center justify-between gap-4 text-left animate-fade-in shadow-sm">
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-emerald-500 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">✨ AI อ่านคู่มือเสร็จเรียบร้อยแล้ว!</h4>
                <p className="text-[10px] text-emerald-500/80 mt-0.5">
                  เราวิเคราะห์พบบริการ {extractedData.services?.length || 0} รายการ และข้อมูลพนักงาน {extractedData.staff?.length || 0} คน...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button onClick={applyAutoFill} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-[10px] h-8 px-3.5 cursor-pointer">
                กรอกข้อมูลอัตโนมัติ
              </Button>
              <button onClick={() => setShowAutoFillBanner(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-1.5 py-1 cursor-pointer">
                ❌
              </button>
            </div>
          </div>
        )}

        {parseError && (
          <div className="mt-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-left animate-fade-in">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="text-rose-500 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">⚠️ AI ไม่สามารถวิเคราะห์คู่มือได้</h4>
                <p className="text-[10px] text-rose-500/80 mt-0.5">{parseError}</p>
              </div>
            </div>
            <Button onClick={() => { setStep(1); setParseError(''); }} size="sm" className="bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg text-[10px] h-8 px-3.5 cursor-pointer shrink-0">
              อัปโหลดใหม่
            </Button>
          </div>
        )}

        {/* Panel container */}
        <div className="my-auto py-8 w-full max-w-[880px] mx-auto">

          {error && (
            <div className="mb-5 bg-[#E53E3E]/10 border border-[#E53E3E]/20 text-[#E53E3E] rounded-xl p-3 text-sm flex items-center gap-2 font-medium">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 1 && (
            <div className="animate-fade-in flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-extrabold text-[#1A365D] dark:text-white">{t.uploadTitle}</h1>
                <p className="text-xs text-[#2B6CB0] font-semibold mt-1">{t.uploadSub}</p>
              </div>
              <div className="bg-white dark:bg-slate-900/60 border border-[#A2D9E8]/35 dark:border-white/5 rounded-3xl p-8 shadow-sm flex flex-col gap-6">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#A2D9E8] dark:border-white/15 hover:border-[#2B6CB0] bg-[#E6F4F8]/10 dark:bg-white/5 hover:bg-[#E6F4F8]/25 rounded-2xl p-14 cursor-pointer transition-all flex flex-col items-center gap-4 group"
                >
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.txt,.md"
                    onChange={(e) => startUpload(e.target.files[0])} />
                  <div className="bg-[#E6F4F8] dark:bg-[#2B6CB0]/20 rounded-full w-14 h-14 flex items-center justify-center text-[#2B6CB0] dark:text-cyan-300 border border-[#A2D9E8]/30 group-hover:scale-105 transition-transform duration-300">
                    <Upload size={24} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-[#1A365D] dark:text-white text-base">{t.dropHere}</h3>
                    <p className="text-[11px] text-slate-400 mt-1.5 font-medium leading-relaxed">{t.dropHint}</p>
                  </div>
                </div>
                <div className="bg-[#E6F4F8]/40 dark:bg-white/5 border border-[#A2D9E8]/20 dark:border-white/5 p-4 rounded-2xl flex gap-3 text-left">
                  <HelpCircle size={18} className="text-[#2B6CB0] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-[#1A365D] dark:text-white">{t.tipTitle}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{t.tipBody}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Connect channels */}
          {step === 2 && (
            <div className="animate-fade-in flex flex-col gap-6">
              {jobId && (
                <div className="inline-flex self-start items-center gap-2 text-[11px] font-bold text-[#2B6CB0] bg-[#2B6CB0]/8 border border-[#2B6CB0]/20 px-3 py-1.5 rounded-full">
                  <Loader2 size={13} className="animate-spin" /> {t.processingBg}
                </div>
              )}
              <div className="bg-white dark:bg-slate-900/60 border border-[#A2D9E8]/35 dark:border-white/5 rounded-3xl p-6 md:p-8 shadow-sm">
                <ChannelConnectCard
                  tenantId={tenantId}
                  lang={lang}
                  lineConfigured={lineConfigured}
                  facebookConfigured={facebookConfigured}
                  onConnected={() => setLineConfigured(true)}
                />
              </div>
              <p className="text-[11px] text-slate-400 font-medium">{t.connectNote}</p>
            </div>
          )}

          {/* STEPS 3-8: Review Flow */}
          {step >= 3 && step <= 8 && (
            <div className="animate-fade-in flex flex-col gap-6">
              <>
                  <div className="flex items-start gap-3">
                    <div className="bg-[#38A169]/10 rounded-full w-11 h-11 flex items-center justify-center text-[#38A169] shrink-0 mt-0.5">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h1 className="text-xl font-extrabold text-[#1A365D] dark:text-white">
                        {step === 3 && "ตรวจสอบข้อมูลธุรกิจ"}
                        {step === 4 && (services.length > 0 ? t.reviewFound(services.length) : t.reviewFoundZero)}
                        {step === 5 && "ตรวจสอบรายชื่อทีมงาน"}
                        {step === 6 && "ตรวจสอบโปรโมชัน"}
                        {step === 7 && "ตรวจสอบคำถามที่พบบ่อย (FAQ)"}
                        {step === 8 && "ตรวจสอบกฎและนโยบายเพิ่มเติม"}
                      </h1>
                      <p className="text-xs text-[#2B6CB0] font-semibold mt-1">
                        {step === 3 && "ตรวจสอบชื่อร้าน เวลาทำการ และเบอร์โทรของร้านคุณ"}
                        {step === 4 && t.reviewSub}
                        {step === 5 && "ตรวจสอบรายชื่อพนักงานและเวลาเข้างานเพื่อความสะดวกในการจองคิว"}
                        {step === 6 && "ตรวจสอบโปรโมชันที่กำลังจัดรายการเพื่อดึงดูดลูกค้า"}
                        {step === 7 && "ตรวจสอบคำถามและคำตอบที่ลูกค้าชอบถามบ่อย ๆ เพื่อเป็นฐานความรู้ให้บอต"}
                        {step === 8 && "ตรวจสอบกฎพิเศษและนโยบายการบริการเฉพาะทาง"}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900/60 border border-[#A2D9E8]/35 dark:border-white/5 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col gap-5">
                    {/* STEP 3: Basic fields */}
                    {step === 3 && (
                      <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-[#1A365D] dark:text-white flex items-center gap-1.5"><Store size={13} /> {t.fName}</label>
                            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-[#1A365D] dark:text-white flex items-center gap-1.5"><Clock size={13} /> {t.fHours}</label>
                            <input value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} placeholder={t.fHoursPh} className={inputCls} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-[#1A365D] dark:text-white flex items-center gap-1.5"><Phone size={13} /> {t.fPhone}</label>
                            <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder={t.contactPh} className={inputCls} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 4: Services */}
                    {step === 4 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center pb-1 border-b border-slate-100 dark:border-white/5">
                          <h4 className="text-xs font-bold text-[#1A365D] dark:text-white uppercase tracking-wider">{t.servicesTitle}</h4>
                          <button type="button" onClick={addService} className={sectionBtn}><Plus size={10} /> {t.addService}</button>
                        </div>
                        <div className="flex flex-col gap-2.5">
                          {services.length === 0 ? (
                            <div className={emptyCls}>{t.noServices}</div>
                          ) : services.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 w-full">
                              <input placeholder={t.svcNamePh} value={s.name} onChange={(e) => changeService(i, 'name', e.target.value)} className={`flex-1 ${rowInput}`} />
                              <input type="number" placeholder={t.svcPricePh} value={s.price} onChange={(e) => changeService(i, 'price', e.target.value)} className={`w-16 ${rowInput}`} />
                              <input type="number" placeholder={t.svcDurPh} value={s.duration} onChange={(e) => changeService(i, 'duration', e.target.value)} className={`w-16 ${rowInput}`} />
                              <button type="button" onClick={() => removeService(i)} className={delBtn}><Trash2 size={13} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* STEP 5: Staff */}
                    {step === 5 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center pb-1 border-b border-slate-100 dark:border-white/5">
                          <h4 className="text-xs font-bold text-[#1A365D] dark:text-white uppercase tracking-wider">{t.staffTitle}</h4>
                          <button type="button" onClick={addStaff} className={sectionBtn}><Plus size={10} /> {t.addStaff}</button>
                        </div>
                        {staff.length === 0 ? <div className={emptyCls}>{t.noStaff}</div> : staff.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 w-full">
                            <input placeholder={t.staffNamePh} value={m.name} onChange={(e) => changeStaff(i, 'name', e.target.value)} className={`flex-1 ${rowInput}`} />
                            <input placeholder={t.staffRolePh} value={m.role} onChange={(e) => changeStaff(i, 'role', e.target.value)} className={`w-28 ${rowInput}`} />
                            <input placeholder={t.staffSpecPh} value={m.specialties ? m.specialties.join(', ') : ''} onChange={(e) => changeStaff(i, 'specialties', e.target.value)} className={`w-40 ${rowInput}`} />
                            <button type="button" onClick={() => removeStaff(i)} className={delBtn}><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* STEP 6: Promotions */}
                    {step === 6 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center pb-1 border-b border-slate-100 dark:border-white/5">
                          <h4 className="text-xs font-bold text-[#1A365D] dark:text-white uppercase tracking-wider">{t.promosTitle}</h4>
                          <button type="button" onClick={addPromo} className={sectionBtn}><Plus size={10} /> {t.addPromo}</button>
                        </div>
                        {promotions.length === 0 ? <div className={emptyCls}>{t.noPromos}</div> : promotions.map((p, i) => (
                          <div key={i} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/40 dark:border-white/10 rounded-xl">
                            <div className="flex items-center gap-2">
                              <input placeholder={t.promoNamePh} value={p.name} onChange={(e) => changePromo(i, 'name', e.target.value)} className={`flex-1 ${rowInput}`} />
                              <input placeholder={t.promoDiscPh} value={p.discount} onChange={(e) => changePromo(i, 'discount', e.target.value)} className={`w-24 ${rowInput}`} />
                              <button type="button" onClick={() => removePromo(i)} className={delBtn}><Trash2 size={13} /></button>
                            </div>
                            <input placeholder={t.promoDescPh} value={p.description} onChange={(e) => changePromo(i, 'description', e.target.value)} className={`w-full ${rowInput}`} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* STEP 7: FAQ */}
                    {step === 7 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center pb-1 border-b border-slate-100 dark:border-white/5">
                          <h4 className="text-xs font-bold text-[#1A365D] dark:text-white uppercase tracking-wider">{t.faqTitle}</h4>
                          <button type="button" onClick={addFaq} className={sectionBtn}><Plus size={10} /> {t.addFaq}</button>
                        </div>
                        {faq.length === 0 ? <div className={emptyCls}>{t.noFaq}</div> : faq.map((it, i) => (
                          <div key={i} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/40 dark:border-white/10 rounded-xl">
                            <input placeholder={t.faqQPh} value={it.question} onChange={(e) => changeFaq(i, 'question', e.target.value)} className={`w-full ${rowInput}`} />
                            <div className="flex items-center gap-2">
                              <input placeholder={t.faqAPh} value={it.answer} onChange={(e) => changeFaq(i, 'answer', e.target.value)} className={`flex-1 ${rowInput}`} />
                              <button type="button" onClick={() => removeFaq(i)} className={delBtn}><Trash2 size={13} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* STEP 8: Custom Rules */}
                    {step === 8 && (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-center pb-1 border-b border-slate-100 dark:border-white/5">
                            <h4 className="text-xs font-bold text-[#1A365D] dark:text-white uppercase tracking-wider">{t.rulesTitle}</h4>
                            <button type="button" onClick={addRule} className={sectionBtn}><Plus size={10} /> {t.addRule}</button>
                          </div>
                          {customRules.length === 0 ? <div className={emptyCls}>{t.noRules}</div> : customRules.map((it, i) => (
                            <div key={i} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/40 dark:border-white/10 rounded-xl">
                              <input placeholder={t.ruleCatPh} value={it.category} onChange={(e) => changeRule(i, 'category', e.target.value)} className={`w-full ${rowInput}`} />
                              <div className="flex items-center gap-2">
                                <input placeholder={t.ruleTextPh} value={it.rule} onChange={(e) => changeRule(i, 'rule', e.target.value)} className={`flex-1 ${rowInput}`} />
                                <button type="button" onClick={() => removeRule(i)} className={delBtn}><Trash2 size={13} /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Advanced: raw text (hidden) */}
                        {rawText && (
                          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                            <button type="button" onClick={() => setShowRaw(!showRaw)}
                              className="self-start flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-[#2B6CB0] cursor-pointer">
                              <FileText size={12} />
                              <ChevronDown size={12} className={`transition-transform ${showRaw ? 'rotate-180' : ''}`} />
                              {t.advanced}
                            </button>
                            {showRaw && (
                              <div className="flex flex-col gap-1.5 animate-fade-in">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.rawText}</span>
                                <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={6}
                                  className="w-full p-3 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0] resize-none" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
              </>
            </div>
          )}

          {/* STEP 9: Done */}
          {step === 9 && (
            <div className="animate-fade-in flex flex-col items-center gap-6 text-center py-8">
              <div className="bg-[#38A169]/10 rounded-full w-20 h-20 flex items-center justify-center text-[#38A169] pulse-ring-success">
                <PartyPopper size={36} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[#1A365D] dark:text-white">{t.doneTitle}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-[420px] leading-relaxed">{t.doneSub}</p>
              </div>
              <Button onClick={() => onOnboardingComplete && onOnboardingComplete()}
                className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-12 px-8 shadow-md shadow-cyan-500/20 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-2">
                <span>{t.goDashboard}</span> <ArrowRight size={18} />
              </Button>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step < 9 && (
          <div className="w-full flex items-center justify-between border-t border-slate-200/60 dark:border-white/5 pt-6 shrink-0 mt-4">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#2B6CB0] transition-colors cursor-pointer">
                <ArrowLeft size={14} /> {t.back}
              </button>
            ) : <span />}

            {/* Right-side primary action per step */}
            {step === 2 && (
              <Button onClick={() => setStep(3)}
                className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-11 px-6 shadow-md shadow-cyan-500/20 hover:scale-[1.01] transition-all cursor-pointer flex items-center gap-2">
                <span>{lineConfigured ? t.next : t.connectSkip}</span> <ArrowRight size={16} />
              </Button>
            )}
            {step >= 3 && step < 8 && !parsing && !parseError && (
              <Button onClick={() => setStep(step + 1)}
                className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-11 px-6 shadow-md shadow-cyan-500/20 hover:scale-[1.01] transition-all cursor-pointer flex items-center gap-2">
                <span>{t.next}</span> <ArrowRight size={16} />
              </Button>
            )}
            {step === 8 && !parsing && !parseError && (
              <Button onClick={handleConfirm} isLoading={saving}
                className="bg-gradient-to-r from-[#38A169] to-emerald-500 hover:from-[#2F855A] hover:to-emerald-400 text-white font-semibold rounded-xl h-11 px-6 shadow-md shadow-[#38A169]/20 hover:scale-[1.01] transition-all cursor-pointer flex items-center gap-2">
                <CheckCircle size={16} /> <span>{t.confirm}</span>
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default OnboardingUpload;
