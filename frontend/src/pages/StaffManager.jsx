import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2, Search, Award, Languages, Calendar, GraduationCap, Heart, Clock, AlertCircle, CheckCircle, Filter, ChevronDown } from 'lucide-react';
import { Card, CardContent, Button } from '@heroui/react';

const translations = {
  th: {
    loading: "กำลังโหลดข้อมูลทีมบุคลากร...",
    loadError: "ไม่สามารถโหลดข้อมูลบุคลากรได้",
    saveError: "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
    saveSuccess: "บันทึกข้อมูลบุคลากรสำเร็จเรียบร้อยแล้ว!",
    confirmDelete: "คุณต้องการลบข้อมูลบุคลากรท่านนี้จริงหรือไม่? การเปลี่ยนแปลงจะส่งผลต่อ AI ในการตอบคำถามทันที.",
    
    title: "จัดการทีมบุคลากร (Staff Directory)",
    subtitle: "ระบุตารางการเข้างาน วุฒิการศึกษา และความชำนาญของทันตแพทย์ เพื่อส่งป้อนเป็นความรู้ระบบ AI ให้ตอบกลับอย่างถูกต้อง",
    addBtn: "เพิ่มบุคลากรใหม่",
    searchPlaceholder: "ค้นหาชื่อ, ตำแหน่ง หรือความเชี่ยวชาญ...",
    noResults: "ไม่พบบุคลากรตามที่ค้นหา หรือยังไม่มีรายชื่อลงทะเบียนในระบบ",
    defaultRole: "ทันตแพทย์ประจำคลินิก",
    editTooltip: "แก้ไขข้อมูล",
    deleteTooltip: "ลบข้อมูล",
    
    labelQualifications: "วุฒิบัตร / การศึกษา",
    labelSchedule: "ตารางเข้าเวรทำงาน",
    labelBoardCert: "บอร์ดการแพทย์",
    labelLanguages: "ภาษาที่รองรับ",
    labelSpecialInterests: "ความสนใจ / บริการชำนาญพิเศษ",
    labelExperience: "ประสบการณ์ทำงาน / วุฒิการศึกษา",
    
    modalAddTitle: "เพิ่มบุคลากรการรักษาท่านใหม่",
    modalEditTitle: "แก้ไขข้อมูลของ {name}",
    
    formName: "ชื่อ-นามสกุล *",
    formRole: "ตำแหน่ง / บทบาท",
    formSpecialties: "ความเชี่ยวชาญเฉพาะทาง (คั่นด้วยเครื่องหมายจุลภาค ,)",
    formExperience: "ประสบการณ์ทำงาน",
    formQualifications: "วุฒิการศึกษา / วุฒิบัตร",
    formBoardCert: "ประกาศนียบัตรวิชาชีพ / บอร์ดการแพทย์",
    formLanguages: "ภาษาที่ใช้สื่อสารได้ (คั่นด้วยเครื่องหมายจุลภาค ,)",
    formSchedule: "ตารางการทำงาน / เข้าเวร",
    formSpecialInterests: "ความสนใจพิเศษ (คั่นด้วยเครื่องหมายจุลภาค ,)",
    
    placeholderName: "เช่น ทพญ. ณัฐธิดา แสนแก้ว",
    placeholderRole: "เช่น ทันตแพทย์รักษารากฟัน (Endodontist)",
    placeholderSpecialties: "เช่น รักษารากฟัน, ทันตกรรมทั่วไป",
    placeholderExperience: "เช่น 5 ปี หรือ 12 ปี",
    placeholderQualifications: "เช่น DDS Chulalongkorn 2018 | Certificate of Endodontics Mahidol 2021",
    placeholderBoardCert: "เช่น Diplomate of the Thai Board of Endodontics",
    placeholderLanguages: "เช่น ไทย, อังกฤษ, ญี่ปุ่น",
    placeholderSchedule: "เช่น ทุกวันอังคาร 09:00 - 18:00 น. หรือ อาทิตย์ (สัปดาห์ที่ 1, 3) 10:00 - 16:00 น.",
    placeholderSpecialInterests: "เช่น การรักษารากฟันด้วยกล้องจุลทรรศน์, การอุดฟันสีเนื้อคอมโพสิต",
    
    cancelBtn: "ยกเลิก",
    addSubmitBtn: "เพิ่มข้อมูลบุคลากร",
    editSubmitBtn: "บันทึกการแก้ไข"
  },
  en: {
    loading: "Loading staff members data...",
    loadError: "Failed to load staff list",
    saveError: "Error saving staff data",
    saveSuccess: "Staff information saved successfully!",
    confirmDelete: "Are you sure you want to delete this staff member? This will immediately affect the AI bot knowledge base.",
    
    title: "Staff Directory",
    subtitle: "Manage staff schedules, qualifications, and specialties to feed into the AI bot knowledge base.",
    addBtn: "Add New Staff",
    searchPlaceholder: "Search by name, role, or specialty...",
    noResults: "No staff members found matching your search or none registered yet.",
    defaultRole: "Clinic Dentist",
    editTooltip: "Edit info",
    deleteTooltip: "Delete info",
    
    labelQualifications: "Qualifications / Education",
    labelSchedule: "Schedule",
    labelBoardCert: "Medical Board",
    labelLanguages: "Languages",
    labelSpecialInterests: "Special Interests & Skills",
    labelExperience: "Experience / Background",
    
    modalAddTitle: "Add New Staff Member",
    modalEditTitle: "Edit Info of {name}",
    
    formName: "Full Name *",
    formRole: "Position / Role",
    formSpecialties: "Specialties (comma-separated ,)",
    formExperience: "Work Experience",
    formQualifications: "Qualifications / Certifications",
    formBoardCert: "Medical Board / License",
    formLanguages: "Communicated Languages (comma-separated ,)",
    formSchedule: "Work Schedule",
    formSpecialInterests: "Special Interests (comma-separated ,)",
    
    placeholderName: "e.g. Dr. Jane Smith",
    placeholderRole: "e.g. Endodontist",
    placeholderSpecialties: "e.g. Root canal therapy, General dentistry",
    placeholderExperience: "e.g. 5 years or 12 years",
    placeholderQualifications: "e.g. DDS Chulalongkorn 2018 | Certificate of Endodontics Mahidol 2021",
    placeholderBoardCert: "e.g. Diplomate of the Thai Board of Endodontics",
    placeholderLanguages: "e.g. English, Thai, Japanese",
    placeholderSchedule: "e.g. Every Tuesday 09:00 AM - 06:00 PM",
    placeholderSpecialInterests: "e.g. Root canal treatment under microscope, Composite bonding",
    
    cancelBtn: "Cancel",
    addSubmitBtn: "Add Staff Info",
    editSubmitBtn: "Save Changes"
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
              onChange("");
              setIsOpen(false);
            }}
            className={`w-full text-left text-xs font-semibold px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
              !value 
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

const StaffManager = ({ tenantId, lang, globalSearch }) => {
  const t = translations[lang || 'th'];
  const [profile, setProfile] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [startHourHH, setStartHourHH] = useState('');
  const [startHourMM, setStartHourMM] = useState('');
  const [endHourHH, setEndHourHH] = useState('');
  const [endHourMM, setEndHourMM] = useState('');

  const startHour = startHourHH ? `${startHourHH}${startHourMM ? ':' + startHourMM : ''}` : '';
  const endHour = endHourHH ? `${endHourHH}${endHourMM ? ':' + endHourMM : ''}` : '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Extract all unique specialties dynamically from the staff list
  const allSpecialties = React.useMemo(() => {
    const specs = new Set();
    staffList.forEach(staff => {
      (staff.specialties || []).forEach(spec => {
        if (spec && spec.trim()) {
          specs.add(spec.trim());
        }
      });
    });
    return Array.from(specs).sort();
  }, [staffList]);

  useEffect(() => {
    setSearchQuery(globalSearch || '');
  }, [globalSearch]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    specialties: '',
    experience: '',
    qualifications: '',
    languages: '',
    schedule: '',
    special_interests: '',
    board_cert: ''
  });

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tenant/profile/${tenantId}`);
      const data = await response.json();
      setProfile(data);
      setStaffList(data.staff || []);
    } catch (e) {
      console.error("Failed to load staff list:", e);
      setMessage({ type: 'error', text: t.loadError });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [tenantId]);

  const saveProfileData = async (updatedList) => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch(`/api/tenant/profile/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          staff: updatedList
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || t.saveError);
      }

      setStaffList(updatedList);
      setProfile({ ...profile, staff: updatedList });
      setMessage({ type: 'success', text: t.saveSuccess });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdd = () => {
    setModalMode('add');
    setFormData({
      name: '',
      role: lang === 'th' ? 'ทันตแพทย์ (Dentist)' : 'Dentist',
      specialties: '',
      experience: '',
      qualifications: '',
      languages: lang === 'th' ? 'ไทย, อังกฤษ' : 'Thai, English',
      schedule: '',
      special_interests: '',
      board_cert: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (idx, staff) => {
    setModalMode('edit');
    setSelectedIdx(idx);
    setFormData({
      name: staff.name,
      role: staff.role || '',
      specialties: (staff.specialties || []).join(', '),
      experience: staff.experience || '',
      qualifications: staff.qualifications || '',
      languages: (staff.languages || []).join(', '),
      schedule: staff.schedule || '',
      special_interests: (staff.special_interests || []).join(', '),
      board_cert: staff.board_cert || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = (idx) => {
    if (!window.confirm(t.confirmDelete)) {
      return;
    }
    const updated = staffList.filter((_, i) => i !== idx);
    saveProfileData(updated);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const formattedStaff = {
      name: formData.name.trim(),
      role: formData.role.trim(),
      specialties: formData.specialties.split(',').map(s => s.trim()).filter(Boolean),
      experience: formData.experience.trim(),
      qualifications: formData.qualifications.trim(),
      languages: formData.languages.split(',').map(s => s.trim()).filter(Boolean),
      schedule: formData.schedule.trim(),
      special_interests: formData.special_interests.split(',').map(s => s.trim()).filter(Boolean),
      board_cert: formData.board_cert.trim()
    };

    let updatedList = [];
    if (modalMode === 'add') {
      updatedList = [...staffList, formattedStaff];
    } else {
      updatedList = [...staffList];
      updatedList[selectedIdx] = formattedStaff;
    }

    setIsModalOpen(false);
    saveProfileData(updatedList);
  };

  const parseFilterTime = (timeStr) => {
    if (!timeStr) return null;
    const clean = timeStr.trim().replace('.', ':');
    if (!clean) return null;
    
    // Check if it contains ':'
    if (clean.includes(':')) {
      const parts = clean.split(':');
      const hr = parseInt(parts[0], 10);
      const minStr = parts[1] || '0';
      const min = parseInt(minStr, 10);
      if (isNaN(hr) || isNaN(min)) return null;
      return hr + min / 60;
    }
    
    // If it's just a number, like "9" or "12"
    const hrOnly = parseInt(clean, 10);
    if (!isNaN(hrOnly)) {
      return hrOnly;
    }
    
    return null;
  };

  const isStaffAvailableOn = (scheduleStr, day, startHr, endHr) => {
    if (!scheduleStr) return false;
    
    // Day translation maps
    const dayMap = {
      sunday: ['อาทิตย์', 'อา.', 'sunday', 'sun'],
      monday: ['จันทร์', 'จ.', 'monday', 'mon'],
      tuesday: ['อังคาร', 'อ.', 'tuesday', 'tue'],
      wednesday: ['พุธ', 'พ.', 'wednesday', 'wed'],
      thursday: ['พฤหัส', 'พฤ.', 'thursday', 'thu'],
      friday: ['ศุกร์', 'ศ.', 'friday', 'fri'],
      saturday: ['เสาร์', 'ส.', 'saturday', 'sat']
    };

    // Find if the day is mentioned
    const parts = scheduleStr.split('|');
    let matchedPart = null;
    
    for (const part of parts) {
      const partLower = part.toLowerCase();
      
      // Check if day matches
      const searchTerms = dayMap[day] || [];
      const hasDay = searchTerms.some(term => partLower.includes(term));
      
      // Support range like อังคาร-พุธ (Tuesday-Wednesday)
      let hasDayRange = false;
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      const rangeMatch = partLower.match(/(จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์|อาทิตย์|จ\.|อ\.|พ\.|พฤ\.|ศ\.|ส\.|อา\.|mon|tue|wed|thu|fri|sat|sun)\s*([–\-\—toถึง])\s*(จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์|อาทิตย์|จ\.|อ\.|พ\.|พฤ\.|ศ\.|ส\.|อา\.|mon|tue|wed|thu|fri|sat|sun)/);
      if (rangeMatch) {
        const startDayStr = rangeMatch[1];
        const endDayStr = rangeMatch[3];
        
        const getDayIdx = (str) => {
          const s = str.trim();
          if (s.includes('อา') || s.includes('sun')) return 0;
          if (s.includes('จั') || s.includes('mon')) return 1;
          if (s.includes('อั') || s.includes('tue')) return 2;
          if (s.includes('พุ') || s.includes('wed')) return 3;
          if (s.includes('พฤ') || s.includes('thu')) return 4;
          if (s.includes('ศุ') || s.includes('fri')) return 5;
          if (s.includes('เส') || s.includes('sat')) return 6;
          return -1;
        };
        
        const startDayIdx = getDayIdx(startDayStr);
        const endDayIdx = getDayIdx(endDayStr);
        const currentDayIdx = daysOfWeek.indexOf(day);
        
        if (startDayIdx !== -1 && endDayIdx !== -1 && currentDayIdx !== -1) {
          if (startDayIdx <= endDayIdx) {
            hasDayRange = currentDayIdx >= startDayIdx && currentDayIdx <= endDayIdx;
          } else {
            hasDayRange = currentDayIdx >= startDayIdx || currentDayIdx <= endDayIdx;
          }
        }
      }

      if (hasDay || hasDayRange) {
        matchedPart = part;
        break;
      }
    }

    if (!matchedPart) return false;
    
    const filterStart = startHr ? parseFilterTime(startHr) : null;
    const filterEnd = endHr ? parseFilterTime(endHr) : null;
    
    if (filterStart === null && filterEnd === null) return true; // Day matches, no time limit

    // Parse time range from matched part (e.g. "09:00–12:00" or "09.00 - 15.00")
    const timeMatch = matchedPart.match(/(\d{1,2})[:.](\d{2})\s*[–\-\—toถึง]\s*(\d{1,2})[:.](\d{2})/);
    if (!timeMatch) return true; // Day matches but time cannot be parsed

    const scheduleStartHr = parseInt(timeMatch[1], 10) + parseInt(timeMatch[2], 10) / 60;
    const scheduleEndHr = parseInt(timeMatch[3], 10) + parseInt(timeMatch[4], 10) / 60;

    if (filterStart !== null && filterEnd !== null) {
      return scheduleStartHr <= filterStart && scheduleEndHr >= filterEnd;
    } else if (filterStart !== null) {
      return scheduleStartHr <= filterStart && scheduleEndHr >= filterStart;
    } else if (filterEnd !== null) {
      return scheduleStartHr <= filterEnd && scheduleEndHr >= filterEnd;
    }
    return true;
  };

  const filteredStaff = staffList.filter(staff => {
    const query = searchQuery.toLowerCase();
    const nameMatch = staff.name.toLowerCase().includes(query);
    const specialtyMatch = (staff.specialties || []).some(s => s.toLowerCase().includes(query));
    const roleMatch = (staff.role || '').toLowerCase().includes(query);
    const searchMatch = nameMatch || specialtyMatch || roleMatch;

    const specialtyMatchDropdown = !selectedSpecialty || (staff.specialties || []).includes(selectedSpecialty);
    const scheduleMatch = !selectedDay || isStaffAvailableOn(staff.schedule, selectedDay, startHour, endHour);
    
    return searchMatch && specialtyMatchDropdown && scheduleMatch;
  });

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
        {t.loading}
      </div>
    );
  }

  return (
    <div className="animate-fade-in text-left flex flex-col gap-8 p-6 md:p-8 w-full max-w-full">
      
      {/* Header controls section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2">
            <Users size={22} className="text-[#2B6CB0] dark:text-cyan-400" />
            <span>{t.title}</span>
          </h2>
          <p className="text-xs text-[#2B6CB0] font-semibold mt-1">
            {t.subtitle}
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-11 px-5 shadow-md shadow-cyan-500/20 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-2"
        >
          <Plus size={16} />
          <span>{t.addBtn}</span>
        </Button>
      </div>

      {/* Filter and Search Controls Row */}
      <div className="flex flex-wrap gap-4 w-full items-center">
        {/* Search Bar */}
        <div className="flex bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-3 px-4 rounded-2xl shadow-sm items-center flex-1 min-w-[280px] max-w-md gap-3 h-11">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-[#1A365D] dark:text-white placeholder:text-slate-400 outline-none w-full"
          />
        </div>

        {/* Category (Specialty) Dropdown Filter */}
        <CustomSelect
          value={selectedSpecialty}
          onChange={setSelectedSpecialty}
          options={allSpecialties.map(spec => ({ value: spec, label: spec }))}
          placeholder={lang === 'th' ? 'ทุกหมวดหมู่ความเชี่ยวชาญ' : 'All Specialties'}
          icon={Filter}
          lang={lang}
        />

        {/* Day Selector Dropdown */}
        <CustomSelect
          value={selectedDay}
          onChange={(val) => {
            setSelectedDay(val);
            if (!val) {
              setStartHourHH('');
              setStartHourMM('');
              setEndHourHH('');
              setEndHourMM('');
            }
          }}
          options={[
            { value: "sunday", label: lang === 'th' ? 'วันอาทิตย์ (Sunday)' : 'Sunday' },
            { value: "monday", label: lang === 'th' ? 'วันจันทร์ (Monday)' : 'Monday' },
            { value: "tuesday", label: lang === 'th' ? 'วันอังคาร (Tuesday)' : 'Tuesday' },
            { value: "wednesday", label: lang === 'th' ? 'วันพุธ (Wednesday)' : 'Wednesday' },
            { value: "thursday", label: lang === 'th' ? 'วันพฤหัสบดี (Thursday)' : 'Thursday' },
            { value: "friday", label: lang === 'th' ? 'วันศุกร์ (Friday)' : 'Friday' },
            { value: "saturday", label: lang === 'th' ? 'วันเสาร์ (Saturday)' : 'Saturday' }
          ]}
          placeholder={lang === 'th' ? 'เลือกวันทำงาน' : 'Select Work Day'}
          icon={Calendar}
          lang={lang}
        />

        {/* Time Range Filter (Condition: Day selected) */}
        {selectedDay && (
          <div className="flex items-center bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-2 px-4 rounded-2xl shadow-sm gap-2.5 h-11 animate-fade-in w-full sm:w-auto">
            <Clock size={15} className="text-cyan-500 shrink-0" />
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">{lang === 'th' ? 'ช่วงเวลาทำงาน:' : 'Time Range:'}</span>
            
            {/* Start Time: HH : MM */}
            <div className="flex items-center gap-0.5">
              <input
                type="text"
                placeholder={lang === 'th' ? 'ชช' : 'HH'}
                value={startHourHH}
                onChange={(e) => setStartHourHH(e.target.value)}
                className="bg-transparent text-xs text-[#1A365D] dark:text-white outline-none border-b border-[#1A365D]/20 dark:border-white/20 focus:border-[#2B6CB0] dark:focus:border-cyan-400 font-semibold w-6 text-center pb-0.5 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                maxLength={2}
              />
              <span className="text-xs text-slate-400 font-semibold">:</span>
              <input
                type="text"
                placeholder={lang === 'th' ? 'นท' : 'MM'}
                value={startHourMM}
                onChange={(e) => setStartHourMM(e.target.value)}
                className="bg-transparent text-xs text-[#1A365D] dark:text-white outline-none border-b border-[#1A365D]/20 dark:border-white/20 focus:border-[#2B6CB0] dark:focus:border-cyan-400 font-semibold w-6 text-center pb-0.5 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                maxLength={2}
              />
            </div>

            <span className="text-xs font-bold text-slate-400">—</span>

            {/* End Time: HH : MM */}
            <div className="flex items-center gap-0.5">
              <input
                type="text"
                placeholder={lang === 'th' ? 'ชช' : 'HH'}
                value={endHourHH}
                onChange={(e) => setEndHourHH(e.target.value)}
                className="bg-transparent text-xs text-[#1A365D] dark:text-white outline-none border-b border-[#1A365D]/20 dark:border-white/20 focus:border-[#2B6CB0] dark:focus:border-cyan-400 font-semibold w-6 text-center pb-0.5 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                maxLength={2}
              />
              <span className="text-xs text-slate-400 font-semibold">:</span>
              <input
                type="text"
                placeholder={lang === 'th' ? 'นท' : 'MM'}
                value={endHourMM}
                onChange={(e) => setEndHourMM(e.target.value)}
                className="bg-transparent text-xs text-[#1A365D] dark:text-white outline-none border-b border-[#1A365D]/20 dark:border-white/20 focus:border-[#2B6CB0] dark:focus:border-cyan-400 font-semibold w-6 text-center pb-0.5 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                maxLength={2}
              />
            </div>

            {(startHourHH || startHourMM || endHourHH || endHourMM) && (
              <button
                type="button"
                onClick={() => {
                  setStartHourHH('');
                  setStartHourMM('');
                  setEndHourHH('');
                  setEndHourMM('');
                }}
                className="text-[10px] text-red-500 hover:underline font-bold ml-1 cursor-pointer"
              >
                {lang === 'th' ? 'ล้างเวลา' : 'Clear'}
              </button>
            )}
          </div>
        )}
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm border flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-success/10 border-success/20 text-success' 
            : 'bg-danger/10 border-danger/20 text-danger'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Cards Grid */}
      {filteredStaff.length === 0 ? (
        <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-16 rounded-3xl text-center text-slate-400 text-sm">
          {t.noResults}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredStaff.map((staff, idx) => (
            <Card 
              key={idx} 
              className="glass-panel border-white/5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between group hover:scale-[1.01]"
            >
              <CardContent className="p-0 flex flex-col gap-4">
                
                {/* Actions overlay header */}
                <div className="flex justify-between items-start gap-4">
                  <div className="text-left">
                    <h3 className="font-bold text-[#1A365D] dark:text-white text-base leading-tight">
                      {staff.name}
                    </h3>
                    <span className="text-[10px] font-bold text-[#2B6CB0] dark:text-cyan-400 tracking-wide uppercase mt-1 block">
                      {staff.role || t.defaultRole}
                    </span>
                  </div>

                  {/* Edit/Delete button group */}
                  <div className="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(idx, staff)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                      title={t.editTooltip}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(idx)}
                      className="w-7 h-7 rounded-lg bg-[#E53E3E]/10 hover:bg-[#E53E3E]/20 text-[#E53E3E] flex items-center justify-center border border-[#E53E3E]/20 transition-colors cursor-pointer"
                      title={t.deleteTooltip}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Badges for Specialties */}
                {staff.specialties && staff.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {staff.specialties.map((s, sIdx) => (
                      <span key={sIdx} className="bg-[#E6F4F8] dark:bg-slate-800 text-[#1A365D] dark:text-cyan-400 text-[9px] font-bold px-2 py-0.5 rounded-md border border-[#A2D9E8]/20">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Details layout divider */}
                <div className="border-t border-slate-100 dark:border-white/5 my-1"></div>

                {/* Metadatas */}
                <div className="flex flex-col gap-2.5 text-xs text-slate-500 font-medium">
                  {/* Experience */}
                  {staff.experience && (
                    <div className="flex items-start gap-2">
                      <GraduationCap size={14} className="text-[#2B6CB0] shrink-0 mt-0.5" />
                      <div className="text-left text-[11px] leading-snug">
                        <span className="text-slate-400 block text-[9px] font-bold uppercase">{t.labelExperience}</span>
                        <span className="text-[#1A365D] dark:text-slate-200 font-semibold">{staff.experience}</span>
                      </div>
                    </div>
                  )}

                  {/* Qualifications */}
                  {staff.qualifications && (
                    <div className="flex items-start gap-2">
                      <GraduationCap size={14} className="text-[#2B6CB0] shrink-0 mt-0.5" />
                      <div className="text-left text-[11px] leading-snug">
                        <span className="text-slate-400 block text-[9px] font-bold uppercase">{t.labelQualifications}</span>
                        <span className="text-[#1A365D] dark:text-slate-200 font-semibold">{staff.qualifications}</span>
                      </div>
                    </div>
                  )}

                  {/* Board Cert */}
                  {staff.board_cert && (
                    <div className="flex items-start gap-2">
                      <Award size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-left text-[11px] leading-snug">
                        <span className="text-slate-400 block text-[9px] font-bold uppercase">{t.labelBoardCert}</span>
                        <span className="text-[#1A365D] dark:text-slate-200 font-semibold">{staff.board_cert}</span>
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {staff.languages && staff.languages.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Languages size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                      <div className="text-left text-[11px] leading-snug">
                        <span className="text-slate-400 block text-[9px] font-bold uppercase">{t.labelLanguages}</span>
                        <span className="text-[#1A365D] dark:text-slate-200 font-semibold">{staff.languages.join(', ')}</span>
                      </div>
                    </div>
                  )}

                  {/* Special Interests */}
                  {staff.special_interests && staff.special_interests.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Heart size={14} className="text-[#E53E3E] shrink-0 mt-0.5" />
                      <div className="text-left text-[11px] leading-snug">
                        <span className="text-slate-400 block text-[9px] font-bold uppercase">{t.labelSpecialInterests}</span>
                        <span className="text-[#1A365D] dark:text-slate-200 font-semibold">{staff.special_interests.join(', ')}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Work Schedule Highlight Block */}
                <div className="mt-3 p-3 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 rounded-xl flex items-start gap-2.5">
                  <Clock size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-left">
                    <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                      {t.labelSchedule}
                    </span>
                    <span className="text-xs text-[#1A365D] dark:text-slate-100 font-bold mt-0.5 block">
                      {staff.schedule || (lang === 'th' ? 'ไม่มีข้อมูลตารางงานระบุไว้' : 'No schedule specified')}
                    </span>
                  </div>
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dynamic Pop-up Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/35 rounded-3xl p-6 w-full max-w-[650px] shadow-2xl relative text-left">
            <h3 className="text-lg font-bold text-[#1A365D] dark:text-white mb-4 border-b border-slate-100 dark:border-white/5 pb-2">
              {modalMode === 'add' ? t.modalAddTitle : t.modalEditTitle.replace('{name}', formData.name)}
            </h3>

            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
              
              {/* Row 1: Name and Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.formName}</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.placeholderName}
                    className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.formRole}</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder={t.placeholderRole}
                    className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                  />
                </div>
              </div>

              {/* Row 2: Specialties & Experience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.formSpecialties}</label>
                  <input
                    type="text"
                    value={formData.specialties}
                    onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                    placeholder={t.placeholderSpecialties}
                    className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.formExperience}</label>
                  <input
                    type="text"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    placeholder={t.placeholderExperience}
                    className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                  />
                </div>
              </div>

              {/* Row 3: Qualifications */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.formQualifications}</label>
                <textarea
                  value={formData.qualifications}
                  onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                  placeholder={t.placeholderQualifications}
                  rows={2}
                  className="w-full p-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0] resize-none"
                />
              </div>

              {/* Row 4: Board Cert & Languages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.formBoardCert}</label>
                  <input
                    type="text"
                    value={formData.board_cert}
                    onChange={(e) => setFormData({ ...formData, board_cert: e.target.value })}
                    placeholder={t.placeholderBoardCert}
                    className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.formLanguages}</label>
                  <input
                    type="text"
                    value={formData.languages}
                    onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                    placeholder={t.placeholderLanguages}
                    className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                  />
                </div>
              </div>

              {/* Row 5: Schedule */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.formSchedule}</label>
                <input
                  type="text"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  placeholder={t.placeholderSchedule}
                  className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                />
              </div>

              {/* Row 6: Special Interests */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1A365D] dark:text-slate-200">{t.formSpecialInterests}</label>
                <input
                  type="text"
                  value={formData.special_interests}
                  onChange={(e) => setFormData({ ...formData, special_interests: e.target.value })}
                  placeholder={t.placeholderSpecialInterests}
                  className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                />
              </div>

              {/* Footer action buttons */}
              <div className="flex justify-end gap-3 pt-3 mt-2 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 h-10 text-xs font-semibold text-slate-500 hover:text-[#2B6CB0] transition-colors cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <Button
                  type="submit"
                  isLoading={saving}
                  className="bg-[#2B6CB0] hover:bg-[#1A365D] text-white font-semibold rounded-xl h-10 px-5 shadow-md hover:scale-[1.01] transition-all cursor-pointer"
                >
                  {modalMode === 'add' ? t.addSubmitBtn : t.editSubmitBtn}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffManager;
