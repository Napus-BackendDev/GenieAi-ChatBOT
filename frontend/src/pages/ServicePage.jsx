import React, { useCallback, useState, useEffect } from 'react';
import { FileText, Save, Trash2, Upload, Plus, AlertCircle, CheckCircle, Settings, Tag, HelpCircle, Grid, ChevronLeft, ChevronRight, Search, Filter, Calendar, Edit3, ChevronDown } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@heroui/react';
import { TableSkeleton } from '../components/SkeletonLoader';

const translations = {
  th: {
    loading: "กำลังโหลดข้อมูลคลังบริการความรู้...",
    saveSuccess: "บันทึกข้อมูลความรู้และบริการสำเร็จเรียบร้อยแล้ว!",
    saveError: "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
    deleteDocError: "เกิดข้อผิดพลาดในการลบเอกสาร",
    imageUploadError: "อัปโหลดรูปภาพล้มเหลว",
    confirmDeleteDoc: "คุณต้องการลบเอกสารคู่มือความรู้นี้ออกจากระบบ RAG/CAG จริงหรือไม่? ข้อมูลประมวลผลข้อความจะถูกเคลียร์ทั้งหมด.",
    deleteDocSuccess: "ลบเอกสารและเคลียร์คลังความรู้ AI สำเร็จแล้ว!",
    confirmDeletePromo: "คุณต้องการลบโปรโมชันนี้หรือไม่?",
    confirmDeleteFaq: "คุณต้องการลบคำถามที่พบบ่อยนี้หรือไม่?",
    
    servicesTitle: "รายการบริการและราคา (Service Fees List)",
    servicesSub: "รายการการให้บริการทั้งหมดของธุรกิจ เพื่อให้บอตนำไปค้นหาหรือทำนัดหมาย",
    addService: "เพิ่มบริการ",
    noServices: "ยังไม่มีรายการบริการลงทะเบียนไว้ กรุณากดเพิ่มบริการ",
    placeholderServiceName: "ชื่อบริการ (เช่น ขูดหินปูน)",
    placeholderPrice: "ราคา เช่น เริ่มต้น 600 หรือ ประมาณ 500-1000",
    saveServices: "บันทึกรายการบริการ",
    
    businessInfoTitle: "ข้อมูลร้านค้าและธุรกิจหลัก",
    officialName: "ชื่อธุรกิจอย่างเป็นทางการ",
    contactPhone: "เบอร์โทรศัพท์ติดต่อร้าน",
    businessHours: "เวลาทำการเปิด-ปิด",
    webhookDomain: "โดเมนหลักสำหรับ Webhook ( Nginx / Ngrok )",
    saveInfo: "บันทึกข้อมูลหลัก",
    
    ragDocsTitle: "คลังคู่มือความรู้ของระบบ (RAG/CAG Documents)",
    uploadMore: "อัปโหลดเพิ่ม",
    noDocs: "ยังไม่มีคู่มืออ้างอิงอัปโหลดเข้าระบบ RAG/CAG",
    docDetails: "หน้า • อัปโหลดเมื่อ",
    
    promosTitle: "การจัดการโปรโมชัน (Promotions Management)",
    promosSub: "โปรโมชันพิเศษของร้านค้าเพื่อให้บอตตอบคำถามหรือแนบเป็น Flex Message",
    addPromo: "เพิ่มโปรโมชัน",
    noPromos: "ยังไม่มีข้อเสนอโปรโมชันสำหรับบอต LINE",
    discountLabel: "ลด:",
    expiryLabel: "หมดเขต:",
    conditionsLabel: "เงื่อนไข:",
    campaignSettingsTitle: "ตั้งค่าแคมเปญหลัก",
    campaignNameLabel: "ชื่อแคมเปญหลัก",
    campaignExpiryLabel: "วันหมดเขตสำหรับทุกโปรโมชันย่อย",
    campaignConditionsLabel: "เงื่อนไขสำหรับทุกโปรโมชันย่อย",
    editCampaignBtn: "ตั้งค่าแคมเปญ",
    allCampaignsOption: "ทุกแคมเปญ",
    searchPromosPlaceholder: "ค้นหาชื่อ หรือรายละเอียดโปรโมชัน...",
    filterCampaignLabel: "แคมเปญหลัก:",
    addSubPromoBtn: "เพิ่มตัวเลือกย่อย",
    durationLabel: "ระยะเวลาแคมเปญ:",
    
    faqTitle: "คำถามที่พบบ่อย (Frequently Asked Questions)",
    faqSub: "คำถามที่ลูกค้ามักจะถามบ่อยๆ เพื่อป้อนเป็น CAG Knowledge ตอบคำถามลูกค้าทันที",
    addFaq: "เพิ่ม FAQ",
    noFaqs: "ยังไม่มีรายการคำถาม FAQ ระบุไว้",
    
    addPromoTitle: "เพิ่มโปรโมชันใหม่",
    editPromoTitle: "แก้ไขโปรโมชัน",
    promoNameLabel: "ชื่อโปรโมชัน *",
    discountInputLabel: "ส่วนลด (เช่น 15% หรือ 500 บาท)",
    expiryInputLabel: "วันหมดเขต (เช่น 2026-12-31)",
    descInputLabel: "รายละเอียดเงื่อนไข",
    conditionsInputLabel: "ข้อตกลงและเงื่อนไขย่อย",
    cancelBtn: "ยกเลิก",
    saveBtn: "บันทึก",
    
    addFaqTitle: "เพิ่มคำถามที่พบบ่อย (FAQ)",
    editFaqTitle: "แก้ไข FAQ",
    questionLabel: "คำถาม (Question) *",
    answerLabel: "คำตอบ (Answer) *",

    customRulesTitle: "กฎเกณฑ์และเงื่อนไขเพิ่มเติม (Custom Policies & Rules)",
    customRulesSub: "กฎนโยบายเพิ่มเติม เช่น การเคลมประกันตรง การส่งต่อเคส หรือเงื่อนไขเฉพาะของธุรกิจสำหรับ AI",
    addCustomRule: "เพิ่มกฎนโยบาย",
    noCustomRules: "ยังไม่มีกฎนโยบายเพิ่มเติม",
    placeholderRuleCategory: "หมวดหมู่ (เช่น ประกันภัย/การส่งต่อแอดมิน)",
    placeholderRuleDetail: "รายละเอียดกฎเกณฑ์นโยบาย",

    placeholderHours: "เช่น เปิดบริการทุกวัน 09:00 - 20:00 น.",
    placeholderWebhook: "เช่น https://your-nginx-domain.com",
    placeholderPromoName: "เช่น โปรสำหรับสมาชิกใหม่",
    placeholderPromoDesc: "รายละเอียดสำหรับแอดมินหรือบอต LINE",
    placeholderPromoCond: "เช่น สำหรับลูกค้าใหม่ครั้งแรกเท่านั้น",
    placeholderFaqQ: "เช่น ที่จอดรถมีไหม?",
    placeholderFaqA: "เช่น มีที่จอดรถหน้าร้านได้ 3 คันครับ..."
  },
  en: {
    loading: "Loading knowledge base data...",
    saveSuccess: "Knowledge and service settings saved successfully!",
    saveError: "Error saving data",
    deleteDocError: "Error deleting document",
    imageUploadError: "Image upload failed",
    confirmDeleteDoc: "Are you sure you want to delete this document from RAG/CAG? All text chunks will be cleared.",
    deleteDocSuccess: "Document deleted and AI knowledge base cleared!",
    confirmDeletePromo: "Are you sure you want to delete this promotion?",
    confirmDeleteFaq: "Are you sure you want to delete this FAQ?",
    
    servicesTitle: "Service Fees List",
    servicesSub: "All services registered for your business, searchable by AI or used for bookings.",
    addService: "Add Service",
    noServices: "No services registered yet. Click Add Service.",
    placeholderServiceName: "Service name (e.g. Haircut)",
    placeholderPrice: "Price e.g. Starts at 600 or ~500-1000",
    saveServices: "Save Service List",
    
    businessInfoTitle: "Business Identity",
    officialName: "Official Company Name",
    contactPhone: "Contact Number",
    businessHours: "Business Hours",
    webhookDomain: "Primary Webhook Domain (Nginx/Ngrok)",
    saveInfo: "Save Info",
    
    ragDocsTitle: "Knowledge Documents (RAG/CAG)",
    uploadMore: "Upload Document",
    noDocs: "No reference manuals uploaded yet.",
    docDetails: "pages • Uploaded at",
    
    promosTitle: "Promotions Management",
    promosSub: "Special deals for AI chatbot response or Flex Messages.",
    addPromo: "Add Promotion",
    noPromos: "No promotions added for LINE bot.",
    discountLabel: "Discount:",
    expiryLabel: "Valid until:",
    conditionsLabel: "Conditions:",
    campaignSettingsTitle: "Edit Main Campaign",
    campaignNameLabel: "Main Campaign Name",
    campaignExpiryLabel: "Expiration Date for all sub-options",
    campaignConditionsLabel: "Conditions for all sub-options",
    editCampaignBtn: "Campaign Settings",
    allCampaignsOption: "All Campaigns",
    searchPromosPlaceholder: "Search promotion name or details...",
    filterCampaignLabel: "Campaign:",
    addSubPromoBtn: "Add Sub-Option",
    durationLabel: "Campaign Duration:",
    
    faqTitle: "Frequently Asked Questions (FAQ)",
    faqSub: "Common customer queries compiled into CAG rules for instant response.",
    addFaq: "Add FAQ",
    noFaqs: "No FAQ items registered.",
    
    addPromoTitle: "Add New Promotion",
    editPromoTitle: "Edit Promotion",
    promoNameLabel: "Promotion Name *",
    discountInputLabel: "Discount (e.g. 15% or 500 THB)",
    expiryInputLabel: "Expiry Date (e.g. 2026-12-31)",
    descInputLabel: "Description & Terms",
    conditionsInputLabel: "Sub-conditions",
    cancelBtn: "Cancel",
    saveBtn: "Save",
    
    addFaqTitle: "Add Frequently Asked Question (FAQ)",
    editFaqTitle: "Edit FAQ",
    questionLabel: "Question *",
    answerLabel: "Answer *",

    customRulesTitle: "Custom Policies & Rules",
    customRulesSub: "Additional rules such as insurance direct billing, case escalation, or business-specific policies for AI",
    addCustomRule: "Add Policy Rule",
    noCustomRules: "No custom rules/policies registered.",
    placeholderRuleCategory: "Category (e.g., Insurance/Escalation)",
    placeholderRuleDetail: "Policy rule details",

    placeholderHours: "e.g. Daily 09:00 AM - 08:00 PM",
    placeholderWebhook: "e.g. https://your-nginx-domain.com",
    placeholderPromoName: "e.g. New Member Special",
    placeholderPromoDesc: "Details for admin or LINE bot",
    placeholderPromoCond: "e.g. For first-time customers only",
    placeholderFaqQ: "e.g. Is there parking available?",
    placeholderFaqA: "e.g. Yes, 3 parking spots in front of the shop..."
  }
};

const CustomSelect = ({ value, onChange, options, placeholder, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative w-full sm:w-64" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex bg-[#FFFFFF]/90 dark:bg-slate-900/90 backdrop-blur-md border border-[#A2D9E8]/20 dark:border-white/5 p-3 px-4 rounded-2xl shadow-sm items-center w-full justify-between gap-2 h-11 cursor-pointer hover:border-[#2B6CB0]/40 transition-all duration-300"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {Icon && <Icon size={15} className="text-[#2B6CB0] dark:text-cyan-400 shrink-0" />}
          <span className="text-xs text-[#1A365D] dark:text-white font-semibold truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown 
          size={14} 
          className={`text-slate-400 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Floating Options Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto no-scrollbar animate-fade-in p-1.5 flex flex-col gap-0.5">
          {/* Placeholder option */}
          <button
            type="button"
            onClick={() => {
              onChange("all");
              setIsOpen(false);
            }}
            className={`w-full text-left text-xs font-semibold px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
              !value || value === 'all'
                ? 'bg-[#E6F4F8] dark:bg-slate-800 text-[#2B6CB0] dark:text-cyan-400' 
                : 'text-[#1A365D] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            {placeholder}
          </button>
          
          {/* Options */}
          {options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left text-xs font-semibold px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                value === opt.value 
                  ? 'bg-[#E6F4F8] dark:bg-slate-800 text-[#2B6CB0] dark:text-cyan-400' 
                  : 'text-[#1A365D] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ServicePage = ({ activeTab, tenantId, triggerReupload, lang, onProfileUpdate }) => {
  const t = translations[lang || 'th'];
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Map activeTab from App.jsx to sub-view key
  const activeSubTab = activeTab === 'service' ? 'services' : activeTab;

  // Promotion modal / form state
  const [promoForm, setPromoForm] = useState({ name: '', description: '', discount: '', valid_until: '', conditions: '', image_url: '' });
  const [promoIdx, setPromoIdx] = useState(null);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [promoModalMode, setPromoModalMode] = useState('add'); // 'add' or 'edit'

  // Promotion Search and Filtering
  const [promoSearch, setPromoSearch] = useState('');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('all');

  // Campaign Settings modal / form state
  const [campaignSettingsModalOpen, setCampaignSettingsModalOpen] = useState(false);
  const [editingCampaignName, setEditingCampaignName] = useState('');
  const [campaignForm, setCampaignForm] = useState({ valid_until: '', conditions: '' });

  // FAQ modal / form state
  const [faqForm, setFaqForm] = useState({ question: '', answer: '' });
  const [faqIdx, setFaqIdx] = useState(null);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [faqModalMode, setFaqModalMode] = useState('add'); // 'add' or 'edit'

  const fetchProfileAndDocs = useCallback(async () => {
    try {
      setLoading(true);
      const profileRes = await fetch(`/api/tenant/profile/${tenantId}`);
      const profileData = await profileRes.json();
      setProfile(profileData);

      const docsRes = await fetch(`/api/documents?tenant_id=${tenantId}`);
      const docsData = await docsRes.json();
      setDocuments(docsData);
    } catch (e) {
      console.error("Failed to load service page data:", e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchProfileAndDocs();
  }, [fetchProfileAndDocs]);

  const saveProfileData = async (subpath, payload) => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch(`/api/tenant/profile/${tenantId}/${subpath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || t.saveError);
      }

      const updatedProfile = { ...profile, ...payload };
      setProfile(updatedProfile);
      setMessage({ type: 'success', text: t.saveSuccess });
      if (onProfileUpdate) {
        onProfileUpdate(updatedProfile);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleGeneralSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      // 1. Save general settings
      const settingsPayload = {
        company_name: profile.company_name,
        business_hours: profile.business_hours,
        contact_number: profile.contact_number,
        webhook_domain: profile.webhook_domain
      };
      const settingsRes = await fetch(`/api/tenant/profile/${tenantId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload)
      });
      if (!settingsRes.ok) {
        const errData = await settingsRes.json().catch(() => ({}));
        throw new Error(errData.detail || t.saveError);
      }

      // 2. Save custom rules
      const rulesPayload = {
        custom_rules: profile.custom_rules || []
      };
      const rulesRes = await fetch(`/api/tenant/profile/${tenantId}/custom-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rulesPayload)
      });
      if (!rulesRes.ok) {
        const errData = await rulesRes.json().catch(() => ({}));
        throw new Error(errData.detail || t.saveError);
      }

      setMessage({ type: 'success', text: t.saveSuccess });
      if (onProfileUpdate) {
        onProfileUpdate(profile);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleServicesSave = (e) => {
    e.preventDefault();
    saveProfileData('services', { services: profile.services || [] });
  };

  // SERVICES CRUD HANDLERS
  const handleServiceChange = (idx, field, val) => {
    const updatedServices = [...profile.services];
    if (field === 'duration') {
      updatedServices[idx][field] = Number(val);
    } else {
      updatedServices[idx][field] = val;
    }
    setProfile({ ...profile, services: updatedServices });
  };

  const addServiceRow = () => {
    const updatedServices = [...(profile.services || []), { name: '', price: '', duration: 30 }];
    setProfile({ ...profile, services: updatedServices });
  };

  const removeServiceRow = (idx) => {
    const updatedServices = profile.services.filter((_, i) => i !== idx);
    setProfile({ ...profile, services: updatedServices });
  };

  // DOCUMENTS HANDLERS
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm(t.confirmDeleteDoc)) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${docId}?tenant_id=${tenantId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || t.deleteDocError);
      }

      fetchProfileAndDocs();
      setMessage({ type: 'success', text: t.deleteDocSuccess });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // PROMOTIONS CRUD HANDLERS
  const openAddPromo = () => {
    setPromoModalMode('add');
    setPromoForm({ name: '', description: '', discount: '', valid_until: '', conditions: '', image_url: '' });
    setPromoModalOpen(true);
  };

  const openEditPromo = (idx, promo) => {
    setPromoModalMode('edit');
    setPromoIdx(idx);
    setPromoForm({ ...promo });
    setPromoModalOpen(true);
  };

  const deletePromo = (idx) => {
    if (!window.confirm(t.confirmDeletePromo)) return;
    const updatedPromos = (profile.promotions || []).filter((_, i) => i !== idx);
    saveProfileData('promotions', { promotions: updatedPromos });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setSaving(true);
      const response = await fetch(`/api/tenant/upload-image/${tenantId}`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || t.imageUploadError);
      }
      setPromoForm(prev => ({ ...prev, image_url: data.image_url }));
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitPromoForm = (e) => {
    e.preventDefault();
    if (!promoForm.name.trim()) return;

    let updatedPromos = [...(profile.promotions || [])];
    if (promoModalMode === 'add') {
      updatedPromos.push(promoForm);
    } else {
      updatedPromos[promoIdx] = promoForm;
    }

    setPromoModalOpen(false);
    saveProfileData('promotions', { promotions: updatedPromos });
  };

  // Grouping and Filtering Helpers for Promotions
  const getUniqueCampaigns = () => {
    const promos = (profile && profile.promotions) || [];
    const campaignNames = new Set();
    promos.forEach(promo => {
      let mainName;
      const nameMatch = promo.name.match(/^(.+?)\s*\((.+?)\)$/);
      if (nameMatch) {
        mainName = nameMatch[1].trim();
      } else {
        const condMatch = promo.conditions && promo.conditions.match(/แคมเปญหลัก\s+(.+)/);
        mainName = condMatch ? condMatch[1].trim() : promo.name.trim();
      }
      campaignNames.add(mainName);
    });
    return Array.from(campaignNames);
  };

  const getFilteredAndGroupedPromotions = () => {
    const promos = (profile && profile.promotions) || [];
    
    // 1. Filter flat items
    const filteredPromos = promos.map((promo, idx) => ({ ...promo, originalIndex: idx }))
      .filter(promo => {
        // Search term check
        const query = promoSearch.trim().toLowerCase();
        const matchesSearch = !query || 
          promo.name.toLowerCase().includes(query) || 
          (promo.description && promo.description.toLowerCase().includes(query)) ||
          (promo.conditions && promo.conditions.toLowerCase().includes(query));

        // Campaign selection check
        let mainName;
        const nameMatch = promo.name.match(/^(.+?)\s*\((.+?)\)$/);
        if (nameMatch) {
          mainName = nameMatch[1].trim();
        } else {
          const condMatch = promo.conditions && promo.conditions.match(/แคมเปญหลัก\s+(.+)/);
          mainName = condMatch ? condMatch[1].trim() : promo.name.trim();
        }

        const matchesCampaign = !selectedCampaignFilter || selectedCampaignFilter === 'all' || 
          mainName === selectedCampaignFilter;

        return matchesSearch && matchesCampaign;
      });

    // 2. Group the filtered items
    const groups = {};
    filteredPromos.forEach(promo => {
      let mainName;
      let subName;
      const nameMatch = promo.name.match(/^(.+?)\s*\((.+?)\)$/);
      if (nameMatch) {
        mainName = nameMatch[1].trim();
        subName = nameMatch[2].trim();
      } else {
        const condMatch = promo.conditions && promo.conditions.match(/แคมเปญหลัก\s+(.+)/);
        if (condMatch) {
          mainName = condMatch[1].trim();
          subName = promo.name.trim();
        } else {
          mainName = promo.name.trim();
          subName = '';
        }
      }

      if (!groups[mainName]) {
        groups[mainName] = {
          name: mainName,
          valid_until: promo.valid_until || '',
          conditions: promo.conditions || '',
          items: []
        };
      }
      groups[mainName].items.push({
        ...promo,
        subName: subName || promo.name
      });
    });

    return Object.values(groups);
  };

  const openEditCampaign = (campaign) => {
    setEditingCampaignName(campaign.name);
    setCampaignForm({
      valid_until: campaign.valid_until,
      conditions: campaign.conditions
    });
    setCampaignSettingsModalOpen(true);
  };

  const submitCampaignForm = (e) => {
    e.preventDefault();
    let updatedPromos = [...(profile.promotions || [])];
    
    updatedPromos = updatedPromos.map(promo => {
      let mainName;
      const nameMatch = promo.name.match(/^(.+?)\s*\((.+?)\)$/);
      if (nameMatch) {
        mainName = nameMatch[1].trim();
      } else {
        const condMatch = promo.conditions && promo.conditions.match(/แคมเปญหลัก\s+(.+)/);
        mainName = condMatch ? condMatch[1].trim() : promo.name.trim();
      }

      if (mainName === editingCampaignName) {
        return {
          ...promo,
          valid_until: campaignForm.valid_until,
          conditions: campaignForm.conditions
        };
      }
      return promo;
    });

    setCampaignSettingsModalOpen(false);
    saveProfileData('promotions', { promotions: updatedPromos });
  };

  const openAddSubPromo = (campaignName, campaign) => {
    setPromoModalMode('add');
    setPromoForm({
      name: `${campaignName} (ตัวเลือกย่อยใหม่)`,
      description: '',
      discount: '',
      valid_until: campaign.valid_until || '',
      conditions: campaign.conditions || `แคมเปญหลัก ${campaignName}`,
      image_url: ''
    });
    setPromoModalOpen(true);
  };

  // FAQ CRUD HANDLERS
  const openAddFaq = () => {
    setFaqModalMode('add');
    setFaqForm({ question: '', answer: '' });
    setFaqModalOpen(true);
  };

  const openEditFaq = (idx, faq) => {
    setFaqModalMode('edit');
    setFaqIdx(idx);
    setFaqForm({ ...faq });
    setFaqModalOpen(true);
  };

  const deleteFaq = (idx) => {
    if (!window.confirm(t.confirmDeleteFaq)) return;
    const updatedFaqs = (profile.faq || []).filter((_, i) => i !== idx);
    saveProfileData('faq', { faq: updatedFaqs });
  };

  const submitFaqForm = (e) => {
    e.preventDefault();
    if (!faqForm.question.trim() || !faqForm.answer.trim()) return;

    let updatedFaqs = [...(profile.faq || [])];
    if (faqModalMode === 'add') {
      updatedFaqs.push(faqForm);
    } else {
      updatedFaqs[faqIdx] = faqForm;
    }

    setFaqModalOpen(false);
    saveProfileData('faq', { faq: updatedFaqs });
  };
  const handleCustomRuleChange = (idx, field, val) => {
    const updatedRules = [...(profile.custom_rules || [])];
    updatedRules[idx][field] = val;
    setProfile({ ...profile, custom_rules: updatedRules });
  };

  const addCustomRuleRow = () => {
    const updatedRules = [...(profile.custom_rules || []), { category: '', rule: '' }];
    setProfile({ ...profile, custom_rules: updatedRules });
  };

  const removeCustomRuleRow = (idx) => {
    const updatedRules = (profile.custom_rules || []).filter((_, i) => i !== idx);
    setProfile({ ...profile, custom_rules: updatedRules });
  };
  const formatDate = (isoStr) => {
    try {
      const dt = new Date(isoStr);
      if (lang === 'en') {
        return dt.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return dt.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' น.';
    } catch {
      return isoStr;
    }
  };

  if (loading) {
    return <TableSkeleton />;
  }

  return (
    <div className="animate-fade-in text-left flex flex-col gap-8 p-6 md:p-8 w-full max-w-full">
      
      {message.text && (
          <div className={`p-4 rounded-xl text-sm border flex items-center gap-2 mb-6 ${
            message.type === 'success' 
              ? 'bg-success/10 border-success/20 text-success' 
              : 'bg-danger/10 border-danger/20 text-danger'
          }`}>
            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </div>
        )}

        {/* 1. SUB-TAB: SERVICE LIST */}
        {activeSubTab === 'services' && (
          <div className="flex flex-col gap-6 w-full">
            {/* Header controls section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2">
                  <Grid size={22} className="text-[#2B6CB0] dark:text-cyan-400" />
                  <span>{t.servicesTitle}</span>
                </h2>
                <p className="text-xs text-[#2B6CB0] font-semibold mt-1">
                  {t.servicesSub}
                </p>
              </div>

              <Button
                onClick={addServiceRow}
                className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-11 px-5 shadow-md shadow-cyan-500/20 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-2"
              >
                <Plus size={16} />
                <span>{t.addService}</span>
              </Button>
            </div>

            <Card className="glass-panel border-white/5 shadow-sm p-6 rounded-2xl">
              <CardContent className="p-0 flex flex-col gap-6">

              <form onSubmit={handleServicesSave} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
                  {(!profile.services || profile.services.length === 0) ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      {t.noServices}
                    </div>
                  ) : (
                    profile.services.map((service, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row items-center gap-3 w-full">
                        <Input
                          type="text"
                          placeholder={t.placeholderServiceName}
                          value={service.name}
                          onChange={(e) => handleServiceChange(idx, 'name', e.target.value)}
                          required
                          className="flex-1 text-foreground bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl h-11"
                        />
                        <Input
                          type="text"
                          placeholder={t.placeholderPrice}
                          value={service.price}
                          onChange={(e) => handleServiceChange(idx, 'price', e.target.value)}
                          required
                          className="flex-1 text-foreground bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl h-11"
                        />
                        <Button
                          onClick={() => removeServiceRow(idx)}
                          isIconOnly
                          variant="light"
                          aria-label={lang === 'th' ? 'ลบบริการ' : 'Remove service'}
                          title={lang === 'th' ? 'ลบบริการ' : 'Remove service'}
                          className="border border-[#E53E3E]/10 hover:bg-[#E53E3E]/10 rounded-xl cursor-pointer text-[#E53E3E] w-11 h-11 shrink-0"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="border-t border-slate-100 dark:border-white/5 pt-4">
                  <Button 
                    type="submit" 
                    isLoading={saving}
                    className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-11 px-6 shadow-md shadow-cyan-500/20 hover:scale-[1.01] transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Save size={14} /> <span>{t.saveServices}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
            </Card>
          </div>
        )}

        {/* 2. SUB-TAB: INFORMATION & MANUALS */}
        {activeSubTab === 'info' && (
          <div className="flex flex-col gap-6 w-full">
            {/* Header controls section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2">
                  <FileText size={22} className="text-[#2B6CB0] dark:text-cyan-400" />
                  <span>{t.businessInfoTitle}</span>
                </h2>
                <p className="text-xs text-[#2B6CB0] font-semibold mt-1">
                  {lang === 'th' ? 'จัดการข้อมูลตัวตนของร้าน เวลาเปิดปิด คลังเอกสารอ้างอิง และกฎนโยบายเพื่อฝึกสอน AI' : 'Manage your business identity, hours, manual references, and policies for AI training.'}
                </p>
              </div>
            </div>

            {/* General Info Form */}
            <Card className="glass-panel border-white/5 shadow-sm p-6 rounded-2xl">
              <CardContent className="p-0">
                
                <form onSubmit={handleGeneralSave} className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-xs font-bold text-foreground">{t.officialName}</label>
                      <Input
                        type="text"
                        value={profile.company_name}
                        onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                        required
                        className="w-full text-foreground bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl h-11"
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-xs font-bold text-foreground">{t.contactPhone}</label>
                      <Input
                        type="text"
                        value={profile.contact_number}
                        onChange={(e) => setProfile({ ...profile, contact_number: e.target.value })}
                        className="w-full text-foreground bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl h-11"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-xs font-bold text-foreground">{t.businessHours}</label>
                    <Input
                      type="text"
                      value={profile.business_hours}
                      onChange={(e) => setProfile({ ...profile, business_hours: e.target.value })}
                      placeholder={t.placeholderHours}
                      className="w-full text-foreground bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl h-11"
                    />
                  </div>

                  {/* Custom Rules Section */}
                  <div className="flex flex-col gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-bold text-[#1A365D] dark:text-white">{t.customRulesTitle}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">{t.customRulesSub}</p>
                      </div>
                      <Button 
                        type="button"
                        onClick={addCustomRuleRow}
                        variant="bordered"
                        size="sm"
                        className="border-[#2B6CB0]/25 text-[#2B6CB0] hover:bg-[#2B6CB0]/5 rounded-xl cursor-pointer font-bold h-8 animate-fade-in"
                      >
                        <Plus size={13} /> {t.addCustomRule}
                      </Button>
                    </div>

                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                      {(!profile.custom_rules || profile.custom_rules.length === 0) ? (
                        <div className="py-6 text-center text-slate-400 text-xs">
                          {t.noCustomRules}
                        </div>
                      ) : (
                        profile.custom_rules.map((ruleItem, idx) => (
                          <div key={idx} className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full animate-fade-in">
                            <Input
                              type="text"
                              placeholder={t.placeholderRuleCategory}
                              value={ruleItem.category || ''}
                              onChange={(e) => handleCustomRuleChange(idx, 'category', e.target.value)}
                              required
                              className="w-full md:w-64 text-foreground bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl h-11"
                            />
                            <Input
                              type="text"
                              placeholder={t.placeholderRuleDetail}
                              value={ruleItem.rule || ''}
                              onChange={(e) => handleCustomRuleChange(idx, 'rule', e.target.value)}
                              required
                              className="flex-1 w-full text-foreground bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl h-11"
                            />
                            <Button
                              type="button"
                              onClick={() => removeCustomRuleRow(idx)}
                              isIconOnly
                              variant="light"
                              aria-label={lang === 'th' ? 'ลบกฎ' : 'Remove rule'}
                              title={lang === 'th' ? 'ลบกฎ' : 'Remove rule'}
                              className="border border-[#E53E3E]/10 hover:bg-[#E53E3E]/10 rounded-xl cursor-pointer text-[#E53E3E] w-11 h-11 shrink-0"
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-white/5 pt-4">
                    <Button 
                      type="submit" 
                      isLoading={saving}
                      className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-11 px-6 shadow-md shadow-cyan-500/10 hover:scale-[1.01] transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Save size={14} /> <span>{t.saveInfo}</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Document Manuals reference List */}
            <Card className="glass-panel border-white/5 shadow-sm p-6 rounded-2xl">
              <CardContent className="p-0">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-white/5 mb-4">
                  <h3 className="text-base font-bold text-[#1A365D] dark:text-white">{t.ragDocsTitle}</h3>
                  <Button
                    onClick={triggerReupload}
                    size="sm"
                    className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-9 cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload size={13} /> {t.uploadMore}
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    {t.noDocs}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {documents.map((doc) => (
                      <div key={doc.document_id} className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="bg-[#E6F4F8] dark:bg-slate-800 text-[#2B6CB0] dark:text-cyan-400 rounded-xl w-10 h-10 flex items-center justify-center border border-[#A2D9E8]/20">
                            <FileText size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#1A365D] dark:text-white">{doc.document_name}</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {doc.page_count} {lang === 'th' ? 'หน้า • อัปโหลดเมื่อ' : 'pages • Uploaded at'} {formatDate(doc.uploaded_at)}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleDeleteDocument(doc.document_id)}
                          isIconOnly
                          variant="light"
                          aria-label={lang === 'th' ? `ลบเอกสาร ${doc.document_name}` : `Delete document ${doc.document_name}`}
                          title={lang === 'th' ? 'ลบเอกสาร' : 'Delete document'}
                          className="border border-[#E53E3E]/10 hover:bg-[#E53E3E]/10 rounded-xl text-[#E53E3E] w-9 h-9"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 3. SUB-TAB: PROMOTIONS */}
        {activeSubTab === 'promotions' && (
          <div className="flex flex-col gap-6 w-full">
            {/* Header controls section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2">
                  <Tag size={22} className="text-[#2B6CB0] dark:text-cyan-400" />
                  <span>{t.promosTitle}</span>
                </h2>
                <p className="text-xs text-[#2B6CB0] font-semibold mt-1">
                  {t.promosSub}
                </p>
              </div>

              <Button
                onClick={openAddPromo}
                className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-11 px-5 shadow-md shadow-cyan-500/20 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-2"
              >
                <Plus size={16} />
                <span>{t.addPromo}</span>
              </Button>
            </div>

            {/* Filter and Search Controls Row */}
            <div className="flex flex-wrap gap-4 w-full items-center">
              {/* Search Bar */}
              <div className="flex bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-3 px-4 rounded-2xl shadow-sm items-center flex-1 min-w-[200px] max-w-xs gap-3 h-11">
                <Search size={16} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder={t.searchPromosPlaceholder}
                  value={promoSearch}
                  onChange={(e) => setPromoSearch(e.target.value)}
                  className="bg-transparent text-xs text-[#1A365D] dark:text-white placeholder:text-slate-400 outline-none w-full"
                />
              </div>

              {/* Campaign Select Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{t.filterCampaignLabel}</span>
                <CustomSelect
                  value={selectedCampaignFilter}
                  onChange={setSelectedCampaignFilter}
                  options={getUniqueCampaigns().map(camp => ({ value: camp, label: camp }))}
                  placeholder={lang === 'th' ? 'ทั้งหมด' : 'All'}
                  icon={Filter}
                  lang={lang}
                />
              </div>
            </div>



              {/* Grouped Promotions Content */}
              {(() => {
                const groupedCampaigns = getFilteredAndGroupedPromotions();
                if (groupedCampaigns.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-sm">
                      {t.noPromos}
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-8">
                    {groupedCampaigns.map((campaign, campIdx) => (
                      <div key={campIdx} className="glass-panel border-white/5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden rounded-3xl p-6 flex flex-col gap-5">
                        
                        {/* Campaign Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-200/50 dark:border-white/5">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-[#1A365D] dark:text-white flex items-center gap-1.5">
                                <Tag size={14} className="text-[#2B6CB0] shrink-0" />
                                <span>{campaign.name}</span>
                              </h4>
                              <span className="text-[9px] bg-[#2B6CB0]/10 text-[#2B6CB0] dark:text-cyan-400 px-1.5 py-0.5 rounded-full font-bold">
                                {campaign.items.length} {lang === 'th' ? 'รายการ' : 'items'}
                              </span>
                            </div>
                            
                            {/* Campaign settings summary */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[10px] text-slate-400 font-bold">
                              {campaign.valid_until && (
                                <div className="flex items-center gap-1">
                                  <Calendar size={11} className="shrink-0" />
                                  <span>{t.durationLabel} <span className="text-[#1A365D] dark:text-slate-300">{campaign.valid_until}</span></span>
                                </div>
                              )}
                              {campaign.conditions && (
                                <div className="flex items-center gap-1">
                                  <AlertCircle size={11} className="shrink-0" />
                                  <span>{t.conditionsLabel} <span className="text-slate-500 font-medium">{campaign.conditions}</span></span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Campaign controls */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              onClick={() => openEditCampaign(campaign)}
                              variant="flat"
                              size="sm"
                              className="bg-[#2B6CB0]/10 hover:bg-[#2B6CB0]/20 text-[#2B6CB0] dark:text-cyan-400 rounded-xl cursor-pointer font-bold h-8 text-[10px]"
                            >
                              <Edit3 size={11} /> {t.editCampaignBtn}
                            </Button>
                            <Button
                              onClick={() => openAddSubPromo(campaign.name, campaign)}
                              variant="flat"
                              size="sm"
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl cursor-pointer font-bold h-8 text-[10px]"
                            >
                              <Plus size={11} /> {t.addSubPromoBtn}
                            </Button>
                          </div>
                        </div>

                        {/* Horizontal Scrollable Sub-promotions row */}
                        <div className="relative group/carousel">
                          {/* Left Arrow Button */}
                          <button 
                            type="button"
                            aria-label={lang === 'th' ? 'เลื่อนโปรโมชั่นไปทางซ้าย' : 'Scroll promotions left'}
                            title={lang === 'th' ? 'เลื่อนไปทางซ้าย' : 'Scroll left'}
                            onClick={() => {
                              const el = document.getElementById(`scroll-${campaign.name}`);
                              if (el) el.scrollBy({ left: -320, behavior: 'smooth' });
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/50 dark:border-white/5 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer shadow-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          
                          {/* Carousel container */}
                          <div 
                            id={`scroll-${campaign.name}`}
                            className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory no-scrollbar"
                          >
                            {campaign.items.map((promo) => (
                              <div 
                                key={promo.originalIndex}
                                className="min-w-[260px] w-[260px] md:w-[calc(25%-12px)] flex-shrink-0 snap-start bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-white/5 rounded-2xl flex flex-col justify-between overflow-hidden relative shadow-sm hover:border-[#2B6CB0]/30 dark:hover:border-cyan-500/30 transition-all duration-300"
                              >
                                {promo.image_url && (
                                  <div className="w-full h-40 bg-slate-100/10 dark:bg-slate-900/10 flex items-center justify-center overflow-hidden border-b border-slate-200/20 dark:border-white/5 relative">
                                    {/* Blurry mirror background */}
                                    <div 
                                      className="absolute inset-0 bg-cover bg-center filter blur-xl opacity-35 scale-110 pointer-events-none"
                                      style={{ backgroundImage: `url(${promo.image_url})` }}
                                    />
                                    {/* Foreground crisp centered image */}
                                    <img src={promo.image_url} alt={promo.name} className="relative z-10 max-w-full max-h-full object-contain shadow-sm" />
                                  </div>
                                )}
                                
                                <div className="p-4 flex flex-col justify-between gap-3 flex-1">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0 pr-1">
                                      <h5 className="text-xs font-bold text-[#1A365D] dark:text-white truncate" title={promo.subName}>
                                        {promo.subName}
                                      </h5>
                                      <span className="text-[9px] bg-red-500/10 text-red-500 font-black px-1.5 py-0.5 rounded mt-1.5 inline-block">
                                        {t.discountLabel} {promo.discount || '-'}
                                      </span>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <button 
                                        onClick={() => openEditPromo(promo.originalIndex, promo)} 
                                        aria-label={lang === 'th' ? 'แก้ไขโปรโมชั่น' : 'Edit promotion'}
                                        title={lang === 'th' ? 'แก้ไขโปรโมชั่น' : 'Edit promotion'}
                                        className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-[#2B6CB0] flex items-center justify-center cursor-pointer transition-colors"
                                      >
                                        <Settings size={11} />
                                      </button>
                                      <button 
                                        onClick={() => deletePromo(promo.originalIndex)} 
                                        aria-label={lang === 'th' ? 'ลบโปรโมชั่น' : 'Delete promotion'}
                                        title={lang === 'th' ? 'ลบโปรโมชั่น' : 'Delete promotion'}
                                        className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-colors"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium line-clamp-3 flex-1" title={promo.description}>
                                    {promo.description}
                                  </p>
                                  
                                  <div className="border-t border-slate-200/40 dark:border-white/5 pt-2 flex flex-col gap-0.5 text-[9px] text-slate-400 font-bold">
                                    <div>{t.expiryLabel} <span className="text-[#1A365D] dark:text-slate-300">{promo.valid_until || (lang === 'th' ? 'ไม่มีกำหนด' : 'No Expiry')}</span></div>
                                    {promo.conditions && <div>{t.conditionsLabel} <span className="text-slate-500 font-medium truncate block" title={promo.conditions}>{promo.conditions}</span></div>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Right Arrow Button */}
                          <button 
                            type="button"
                            aria-label={lang === 'th' ? 'เลื่อนโปรโมชั่นไปทางขวา' : 'Scroll promotions right'}
                            title={lang === 'th' ? 'เลื่อนไปทางขวา' : 'Scroll right'}
                            onClick={() => {
                              const el = document.getElementById(`scroll-${campaign.name}`);
                              if (el) el.scrollBy({ left: 320, behavior: 'smooth' });
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/50 dark:border-white/5 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer shadow-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                );
              })()}
          </div>
        )}

        {/* 4. SUB-TAB: FAQ */}
        {activeSubTab === 'faq' && (
          <div className="flex flex-col gap-6 w-full">
            {/* Header controls section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2">
                  <HelpCircle size={22} className="text-[#2B6CB0] dark:text-cyan-400" />
                  <span>{t.faqTitle}</span>
                </h2>
                <p className="text-xs text-[#2B6CB0] font-semibold mt-1">
                  {t.faqSub}
                </p>
              </div>

              <Button
                onClick={openAddFaq}
                className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-11 px-5 shadow-md shadow-cyan-500/20 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-2"
              >
                <Plus size={16} />
                <span>{t.addFaq}</span>
              </Button>
            </div>

            <Card className="glass-panel border-white/5 shadow-sm p-6 rounded-2xl">
              <CardContent className="p-0 flex flex-col gap-6">

              {(!profile.faq || profile.faq.length === 0) ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  {t.noFaqs}
                </div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {profile.faq.map((faq, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-white/5 rounded-2xl flex flex-col gap-2.5 relative">
                      <div className="flex justify-between items-start gap-4">
                        <h4 className="text-xs font-bold text-[#1A365D] dark:text-white flex items-start gap-2">
                          <span className="bg-[#2B6CB0]/10 text-[#2B6CB0] px-1 rounded text-[10px]">Q</span>
                          <span>{faq.question}</span>
                        </h4>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEditFaq(idx, faq)} aria-label={lang === 'th' ? 'แก้ไขคำถาม' : 'Edit FAQ'} title={lang === 'th' ? 'แก้ไขคำถาม' : 'Edit FAQ'} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-[#2B6CB0] flex items-center justify-center cursor-pointer"><Settings size={11} /></button>
                          <button onClick={() => deleteFaq(idx)} aria-label={lang === 'th' ? 'ลบคำถาม' : 'Delete FAQ'} title={lang === 'th' ? 'ลบคำถาม' : 'Delete FAQ'} className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer"><Trash2 size={11} /></button>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 font-medium flex items-start gap-2 pl-6">
                        <span className="bg-emerald-500/10 text-emerald-500 px-1 rounded text-[10px] shrink-0 font-bold">A</span>
                        <p className="leading-relaxed">{faq.answer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        )}

      {/* PROMOTION MODAL */}
      {promoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/35 rounded-3xl p-6 w-full max-w-[550px] shadow-2xl relative text-left">
            <h3 className="text-base font-bold text-[#1A365D] dark:text-white mb-4 border-b border-slate-100 dark:border-white/5 pb-2">
              {promoModalMode === 'add' ? t.addPromoTitle : t.editPromoTitle}
            </h3>
            <form onSubmit={submitPromoForm} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.promoNameLabel}</label>
                <input
                  type="text"
                  required
                  value={promoForm.name}
                  onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })}
                  placeholder={t.placeholderPromoName}
                  className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.discountInputLabel}</label>
                  <input
                     type="text"
                     value={promoForm.discount}
                     onChange={(e) => setPromoForm({ ...promoForm, discount: e.target.value })}
                     placeholder="15%"
                     className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.expiryInputLabel}</label>
                  <input
                    type="text"
                    value={promoForm.valid_until}
                    onChange={(e) => setPromoForm({ ...promoForm, valid_until: e.target.value })}
                    placeholder="YYYY-MM-DD"
                    className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.descInputLabel}</label>
                <textarea
                  value={promoForm.description}
                  onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })}
                  placeholder={t.placeholderPromoDesc}
                  rows={2}
                  className="w-full p-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0] resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.conditionsInputLabel}</label>
                <input
                  type="text"
                  value={promoForm.conditions}
                  onChange={(e) => setPromoForm({ ...promoForm, conditions: e.target.value })}
                  placeholder={t.placeholderPromoCond}
                  className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">
                  {lang === 'th' ? 'รูปภาพโปรโมชัน (ถ้ามี)' : 'Promotion Image (Optional)'}
                </label>
                <div className="flex items-center gap-3">
                  {promoForm.image_url ? (
                    <div className="relative shrink-0 w-16 h-10 border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden bg-slate-100">
                      <img src={promoForm.image_url} alt="Promo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPromoForm({ ...promoForm, image_url: '' })}
                        className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl hover:bg-red-600 cursor-pointer"
                        style={{ padding: '2px' }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ) : (
                    <div className="shrink-0 w-16 h-10 border border-dashed border-slate-300 dark:border-white/10 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400 text-[10px] font-bold">
                      {lang === 'th' ? 'ไม่มีรูป' : 'No Image'}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder={lang === 'th' ? 'กรอก URL รูปภาพ หรือเลือกอัปโหลด' : 'Enter Image URL or upload'}
                    value={promoForm.image_url || ''}
                    onChange={(e) => setPromoForm({ ...promoForm, image_url: e.target.value })}
                    className="flex-1 h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                  />
                  <label className="shrink-0 h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/15 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs text-[#2B6CB0] dark:text-cyan-400 font-bold transition-all">
                    <Upload size={14} />
                    <span>{lang === 'th' ? 'อัปโหลด' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 mt-2 border-t border-slate-100 dark:border-white/5">
                <button type="button" onClick={() => setPromoModalOpen(false)} className="px-4 h-10 text-xs font-semibold text-slate-500 cursor-pointer">{t.cancelBtn}</button>
                <Button type="submit" isLoading={saving} className="bg-[#2B6CB0] text-white font-semibold rounded-xl h-10 px-5 cursor-pointer">{t.saveBtn}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAQ MODAL */}
      {faqModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/35 rounded-3xl p-6 w-full max-w-[550px] shadow-2xl relative text-left">
            <h3 className="text-base font-bold text-[#1A365D] dark:text-white mb-4 border-b border-slate-100 dark:border-white/5 pb-2">
              {faqModalMode === 'add' ? t.addFaqTitle : t.editFaqTitle}
            </h3>
            <form onSubmit={submitFaqForm} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.questionLabel}</label>
                <input
                  type="text"
                  required
                  value={faqForm.question}
                  onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                  placeholder={t.placeholderFaqQ}
                  className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.answerLabel}</label>
                <textarea
                  required
                  value={faqForm.answer}
                  onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                  placeholder={t.placeholderFaqA}
                  rows={4}
                  className="w-full p-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0] resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 mt-2 border-t border-slate-100 dark:border-white/5">
                <button type="button" onClick={() => setFaqModalOpen(false)} className="px-4 h-10 text-xs font-semibold text-slate-500 cursor-pointer">{t.cancelBtn}</button>
                <Button type="submit" isLoading={saving} className="bg-[#2B6CB0] text-white font-semibold rounded-xl h-10 px-5 cursor-pointer">{t.saveBtn}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CAMPAIGN SETTINGS MODAL */}
      {campaignSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/35 rounded-3xl p-6 w-full max-w-[500px] shadow-2xl relative text-left">
            <h3 className="text-base font-bold text-[#1A365D] dark:text-white mb-4 border-b border-slate-100 dark:border-white/5 pb-2 flex items-center gap-2">
              <Settings size={18} className="text-[#2B6CB0]" />
              <span>{t.campaignSettingsTitle}</span>
            </h3>
            
            <form onSubmit={submitCampaignForm} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400">{t.campaignNameLabel}</label>
                <div className="text-sm font-bold text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl">
                  {editingCampaignName}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.campaignExpiryLabel}</label>
                <input
                  type="text"
                  value={campaignForm.valid_until}
                  onChange={(e) => setCampaignForm({ ...campaignForm, valid_until: e.target.value })}
                  placeholder="YYYY-MM-DD"
                  className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.campaignConditionsLabel}</label>
                <input
                  type="text"
                  value={campaignForm.conditions}
                  onChange={(e) => setCampaignForm({ ...campaignForm, conditions: e.target.value })}
                  placeholder={t.placeholderPromoCond}
                  className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 mt-2 border-t border-slate-100 dark:border-white/5">
                <button type="button" onClick={() => setCampaignSettingsModalOpen(false)} className="px-4 h-10 text-xs font-semibold text-slate-500 cursor-pointer">{t.cancelBtn}</button>
                <Button type="submit" isLoading={saving} className="bg-[#2B6CB0] text-white font-semibold rounded-xl h-10 px-5 cursor-pointer">{t.saveBtn}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ServicePage;
