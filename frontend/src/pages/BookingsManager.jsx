import { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Search, Trash2, User, Clock, AlertCircle, ChevronLeft, ChevronRight, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, Button, Chip, Input } from '@heroui/react';

const translations = {
  th: {
    loadError: "ไม่สามารถโหลดข้อมูลการนัดหมายลูกค้าได้",
    confirmCancel: "คุณแน่ใจหรือไม่ว่าต้องการยกเลิกนัดหมายของลูกค้ารายนี้?",
    cancelFail: "ยกเลิกการจองไม่สำเร็จ",
    
    title: "ตารางการนัดหมายของลูกค้า",
    subtitle: "จัดการคิวจองนัดหมาย ตรวจสอบเวลาว่าง และกดยกเลิกนัดหมายลูกค้าของร้านคุณ",
    
    legendHasBookings: "มีนัดหมาย",
    legendSelectedDate: "วันที่เลือก",
    legendToday: "วันนี้",
    
    dailyQueue: "คิวนัดหมายประจำวัน",
    filterUpcoming: "ล่วงหน้า",
    filterPast: "ย้อนหลัง",
    filterAll: "ทั้งหมด",
    
    searchPlaceholder: "ค้นหาชื่อลูกค้า, บริการ, เบอร์โทร...",
    loading: "กำลังโหลดรายการนัดหมาย...",
    noBookings: "ไม่มีนัดหมายในรายการนี้สำหรับวันที่เลือก",
    
    statusUpcoming: "นัดหมายล่วงหน้า",
    statusCompleted: "รับบริการแล้ว",
    
    cancelBtnTooltip: "ยกเลิกนัดหมาย",
    serviceLabel: "บริการ:",
    customerLabel: "ลูกค้า:",
    phoneLabel: "เบอร์โทร:",
    emailLabel: "อีเมล:",
    defaultRole: "แพทย์",
    
    months: [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ],
    weekdays: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
  },
  en: {
    loadError: "Failed to load customer bookings data",
    confirmCancel: "Are you sure you want to cancel this customer's booking?",
    cancelFail: "Booking cancellation failed",
    
    title: "Customer Bookings Schedule",
    subtitle: "Manage booking slots, check availability, and cancel customer bookings.",
    
    legendHasBookings: "Has Bookings",
    legendSelectedDate: "Selected Date",
    legendToday: "Today",
    
    dailyQueue: "Daily Bookings Queue",
    filterUpcoming: "Upcoming",
    filterPast: "Past",
    filterAll: "All",
    
    searchPlaceholder: "Search client name, service, phone...",
    loading: "Loading bookings queue...",
    noBookings: "No bookings matching filter for selected date.",
    
    statusUpcoming: "Upcoming",
    statusCompleted: "Completed",
    
    cancelBtnTooltip: "Cancel Booking",
    serviceLabel: "Service:",
    customerLabel: "Customer:",
    phoneLabel: "Phone:",
    emailLabel: "Email:",
    defaultRole: "Doctor",
    
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ],
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  }
};

const BookingsManager = ({ tenantId, lang, globalSearch }) => {
  const t = translations[lang || 'th'];
  const [bookings, setBookings] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('upcoming'); // 'upcoming', 'past', 'all'
  const [error, setError] = useState('');
  const [isOffDutyExpanded, setIsOffDutyExpanded] = useState(false);

  useEffect(() => {
    setSearchTerm(globalSearch || '');
  }, [globalSearch]);

  // Calendar States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date()); // Holds selected Date object

  const thaiMonths = t.months;
  const weekdays = t.weekdays;

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bookings?tenant_id=${tenantId}`);
      const data = await response.json();
      // Guard: a backend error returns {detail} — never feed a non-array into .filter (blank-screen crash)
      setBookings(Array.isArray(data) ? data : []);
      if (!Array.isArray(data)) setError(t.loadError);
    } catch (e) {
      console.error("Failed to fetch bookings:", e);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/tenant/profile/${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (e) {
      console.error("Failed to fetch profile:", e);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchProfile();
  }, [tenantId]);

  const getDoctorShiftInfo = (doctor, date) => {
    const scheduleStr = doctor.schedule || "";
    if (!scheduleStr || scheduleStr.includes("สอบถามคลินิก") || scheduleStr.includes("Ask clinic")) {
      return { isWorking: false, hours: lang === 'th' ? "โปรดสอบถาม" : "Inquire" };
    }

    const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon, ...
    const dateNum = date.getDate();
    
    // Calculate week of month (1-5)
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const weekOfMonth = Math.ceil((dateNum + firstDay.getDay()) / 7);

    // Weekday names mapping
    const thDays = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
    const enDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const thAbbr = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const enAbbr = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    const thDay = thDays[dayOfWeek];
    const enDay = enDays[dayOfWeek];
    const thAb = thAbbr[dayOfWeek];
    const enAb = enAbbr[dayOfWeek];

    // Split schedule by '|'
    const parts = scheduleStr.split('|').map(p => p.trim());
    for (const part of parts) {
      const partLower = part.toLowerCase();
      // Check if this part of the schedule refers to the selected day
      if (
        partLower.includes(thDay) || 
        partLower.includes(enDay) || 
        partLower.includes(thAb) || 
        partLower.includes(enAb) ||
        (dayOfWeek === 4 && partLower.includes("พฤหัสบดี")) // handle full spelling
      ) {
        // Check for specific week constraints like (1, 3) or (2, 4)
        const weekMatch = part.match(/\(([^)]+)\)/);
        if (weekMatch) {
          const weeksStr = weekMatch[1]; // e.g. "1, 3, 5" or "สัปดาห์ที่ 2, 4"
          // Extract numbers
          const numbers = weeksStr.match(/\d+/g);
          if (numbers) {
            const weeks = numbers.map(Number);
            if (!weeks.includes(weekOfMonth)) {
              continue; // Week doesn't match, keep checking other parts
            }
          }
        }
        
        // Extract hours (e.g. 09:00–12:00 or 10:00–16:00)
        const timeMatch = part.match(/\d{2}:\d{2}\s*[-–~]\s*\d{2}:\d{2}/);
        const hours = timeMatch ? timeMatch[0] : (lang === 'th' ? "ตามตารางนัด" : "As scheduled");
        
        return { isWorking: true, hours };
      }
    }

    return { isWorking: false, hours: "" };
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm(t.confirmCancel)) {
      return;
    }

    try {
      const response = await fetch(`/api/bookings/${bookingId}?tenant_id=${tenantId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || t.cancelFail);
      }

      fetchBookings();
    } catch (err) {
      alert(err.message);
    }
  };

  // Date Check Helpers
  const isUpcoming = (datetimeStr) => {
    const bookingTime = new Date(datetimeStr).getTime();
    const now = new Date().getTime();
    return bookingTime >= now;
  };

  const isSameDay = (dateA, dateB) => {
    return (
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate()
    );
  };

  // Calendar Logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Check if a day has bookings
  const hasBookingsOnDay = (day) => {
    return bookings.some((booking) => {
      try {
        const bDate = new Date(booking.booking_datetime);
        return (
          bDate.getFullYear() === year &&
          bDate.getMonth() === month &&
          bDate.getDate() === day
        );
      } catch {
        return false;
      }
    });
  };

  // Filter Bookings for Selected Day
  const dailyBookings = bookings.filter((booking) => {
    try {
      const bDate = new Date(booking.booking_datetime);
      return isSameDay(bDate, selectedDate);
    } catch {
      return false;
    }
  });

  // Apply search and status filters on daily bookings
  const filteredBookings = dailyBookings.filter(booking => {
    const matchSearch = 
      (booking.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (booking.phone_number || '').includes(searchTerm) ||
      (booking.service_topic || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const upcoming = isUpcoming(booking.booking_datetime);
    
    if (statusFilter === 'upcoming') {
      return matchSearch && upcoming;
    } else if (statusFilter === 'past') {
      return matchSearch && !upcoming;
    }
    return matchSearch;
  });

  const formatDateLabel = (dateObj) => {
    return dateObj.toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (isoStr) => {
    try {
      const dt = new Date(isoStr);
      if (lang === 'en') {
        return dt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return dt.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit'
      }) + ' น.';
    } catch {
      return '';
    }
  };

  // Render Calendar Grid Items
  const calendarCells = [];
  // Prefix empty blocks for previous month offset
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="h-12 w-full"></div>);
  }
  // Month dates
  for (let d = 1; d <= daysInMonth; d++) {
    const dateOfCell = new Date(year, month, d);
    const isSelected = isSameDay(dateOfCell, selectedDate);
    const isToday = isSameDay(dateOfCell, new Date());
    const dayHasBookings = hasBookingsOnDay(d);

    calendarCells.push(
      <button
        key={`day-${d}`}
        type="button"
        onClick={() => setSelectedDate(dateOfCell)}
        className={`h-14 w-full flex flex-col items-center justify-between py-1.5 rounded-xl transition-all duration-300 cursor-pointer relative ${
          isSelected 
            ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/20 font-bold scale-105' 
            : isToday
            ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold'
            : 'text-foreground hover:bg-white/5 hover:scale-105'
        }`}
      >
        <span className="text-sm">{d}</span>
        {dayHasBookings && (
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
            isSelected ? 'bg-white' : 'bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
          }`}></span>
        )}
      </button>
    );
  }

  return (
    <div className="animate-fade-in text-left flex flex-col gap-8 p-6 md:p-8 w-full max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2">
            <CalendarIcon size={22} className="text-[#2B6CB0] dark:text-cyan-400" />
            <span>{t.title}</span>
          </h2>
          <p className="text-xs text-[#2B6CB0] font-semibold mt-1">
            {t.subtitle}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-3 text-sm text-left my-4 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Grid Split Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.5fr] gap-6 items-start">
        
        {/* Left Card: Calendar */}
        <Card className="glass-panel border-white/5 shadow-md p-6 rounded-2xl flex flex-col h-auto">
          <CardContent className="p-0 flex flex-col gap-6">
            {/* Calendar Header with Navigation */}
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <CalendarIcon size={18} className="text-cyan-400" />
                <span>{thaiMonths[month]} {lang === 'th' ? year + 543 : year}</span>
              </h2>
              <div className="flex gap-2">
                <Button 
                  isIconOnly 
                  variant="bordered" 
                  size="sm" 
                  onClick={prevMonth} 
                  className="border-white/10 hover:bg-white/5 text-foreground rounded-xl cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button 
                  isIconOnly 
                  variant="bordered" 
                  size="sm" 
                  onClick={nextMonth} 
                  className="border-white/10 hover:bg-white/5 text-foreground rounded-xl cursor-pointer"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            {/* Weekdays Labels */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wider mb-2">
              {weekdays.map((day, idx) => (
                <div key={idx} className={idx === 0 ? 'text-rose-400' : idx === 6 ? 'text-cyan-400' : 'text-default-400'}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid Cells */}
            <div className="grid grid-cols-7 gap-2">
              {calendarCells}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-default-400 mt-2 pt-3 border-t border-white/5">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"></span>
                {t.legendHasBookings}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500"></span>
                {t.legendSelectedDate}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded border border-cyan-500/30 bg-cyan-500/10"></span>
                {t.legendToday}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right Card: Daily Booking Details */}
        <Card className="glass-panel border-white/5 shadow-md p-6 rounded-2xl flex flex-col min-h-[500px]">
          <CardContent className="p-0 flex flex-col gap-6 h-full">
            {/* Header: Selected Date Description */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-white/5">
              <div>
                <h3 className="font-bold text-foreground text-lg">
                  {t.dailyQueue}
                </h3>
                <p className="text-xs text-cyan-400 font-semibold mt-0.5">
                  {formatDateLabel(selectedDate)}
                </p>
              </div>
              <div className="flex bg-slate-900/60 dark:bg-black/40 border border-white/5 p-1 rounded-xl">
                <button
                  onClick={() => setStatusFilter('upcoming')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 cursor-pointer ${
                    statusFilter === 'upcoming'
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md'
                      : 'text-default-400 hover:text-foreground'
                  }`}
                >
                  {t.filterUpcoming}
                </button>
                <button
                  onClick={() => setStatusFilter('past')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 cursor-pointer ${
                    statusFilter === 'past'
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md'
                      : 'text-default-400 hover:text-foreground'
                  }`}
                >
                  {t.filterPast}
                </button>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md'
                      : 'text-default-400 hover:text-foreground'
                  }`}
                >
                  {t.filterAll}
                </button>
              </div>
            </div>

            {/* Search Input Filter */}
            <div className="flex items-center gap-2 w-full shadow-sm bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 rounded-2xl focus-within:border-[#2B6CB0] transition-colors h-11 px-4">
              <Search size={18} className="text-default-400 shrink-0" />
              <Input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 text-[#1A365D] dark:text-white bg-transparent border-0 shadow-none rounded-none px-0 h-full focus:bg-transparent"
              />
            </div>

            {/* Bookings List */}
            {loading ? (
              <div className="py-12 text-center text-default-400 text-sm flex-1 flex items-center justify-center">
                {t.loading}
              </div>
            ) : (!profile?.staff || profile.staff.length === 0) && filteredBookings.length === 0 ? (
              <div className="py-16 text-center text-default-400 text-sm flex-1 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl bg-slate-900/10">
                <CalendarIcon size={32} className="text-default-400 opacity-60 mb-2 animate-bounce" />
                <span>{t.noBookings}</span>
              </div>
            ) : (() => {
              const doctorsList = profile?.staff || [];
              const doctorSchedules = doctorsList.map(doc => {
                const shift = getDoctorShiftInfo(doc, selectedDate);
                const docBookings = filteredBookings.filter(b => 
                  b.staff_name && b.staff_name.toLowerCase().includes(doc.name.toLowerCase())
                );
                return {
                  ...doc,
                  shift,
                  bookings: docBookings
                };
              });

              const onDutyDoctors = doctorSchedules.filter(d => d.shift.isWorking);
              const offDutyDoctors = doctorSchedules.filter(d => !d.shift.isWorking);

              // A booking must NEVER be hidden. "Other bookings" = every booking not
              // already displayed under an on-duty doctor above. This deliberately
              // includes bookings assigned to a doctor who is OFF-DUTY that day —
              // otherwise (assigned to a real but off-duty doctor) they would appear
              // in neither the on-duty grid nor here, and silently vanish.
              const shownBookingIds = new Set(onDutyDoctors.flatMap(d => d.bookings.map(b => b.booking_id)));
              const unassignedBookings = filteredBookings.filter(b => !shownBookingIds.has(b.booking_id));

              return (
                <div className="flex flex-col gap-6 overflow-y-auto max-h-[600px] pr-1">
                  
                  {/* Section 1: On-Duty Doctors Grid */}
                  <div className="flex flex-col gap-4">
                    <h4 className="text-xs font-extrabold text-[#1A365D] dark:text-cyan-400 uppercase tracking-wider mb-1">
                      {lang === 'th' ? `แพทย์ที่เข้าเวรปฏิบัติงานวันนี้ (${onDutyDoctors.length})` : `Doctors On Duty Today (${onDutyDoctors.length})`}
                    </h4>
                    
                    {onDutyDoctors.length === 0 ? (
                      <div className="text-center py-6 text-xs text-default-400 border border-dashed border-white/5 rounded-2xl bg-slate-900/10">
                        {lang === 'th' ? "ไม่มีแพทย์ที่มีเวรปฏิบัติงานในวันที่เลือก" : "No doctors scheduled to work on this day."}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {onDutyDoctors.map((doc, dIdx) => (
                          <div key={dIdx} className="flex flex-col gap-3.5 p-4 bg-gradient-to-br from-white to-[#E6F4F8]/10 dark:from-slate-900/50 dark:to-slate-950/20 border border-[#A2D9E8]/35 dark:border-white/5 rounded-2xl shadow-sm hover:shadow-md hover:border-[#2B6CB0]/30 transition-all duration-300">
                            {/* Doctor Header */}
                            <div className="flex justify-between items-start gap-2 pb-2.5 border-b border-slate-100 dark:border-white/5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                  {doc.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="text-left min-w-0">
                                  <h4 className="font-extrabold text-foreground text-xs sm:text-sm leading-tight truncate" title={doc.name}>{doc.name}</h4>
                                  <p className="text-[10px] text-default-400 mt-0.5 truncate">
                                    {doc.role || t.defaultRole} {doc.specialties && doc.specialties.length > 0 ? `(${doc.specialties.join(", ")})` : ""}
                                  </p>
                                </div>
                              </div>
                              <Chip
                                size="sm"
                                variant="flat"
                                color="success"
                                className="h-5 text-[9px] px-1 font-bold shrink-0 bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                              >
                                {doc.shift.hours}
                              </Chip>
                            </div>

                            {/* Bookings under this doctor */}
                            <div className="flex flex-col gap-2.5">
                              {doc.bookings.length === 0 ? (
                                <div className="text-left py-2.5 text-[11px] text-[#38A169] bg-[#38A169]/5 dark:bg-[#38A169]/10 rounded-xl px-3 border border-[#38A169]/15 font-bold flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#38A169] animate-pulse"></span>
                                  {lang === 'th' ? "ว่าง (ไม่มีนัดหมาย)" : "Available (No Bookings)"}
                                </div>
                              ) : (
                                doc.bookings.map((booking) => {
                                  const isFuture = isUpcoming(booking.booking_datetime);
                                  return (
                                    <div
                                      key={booking.booking_id}
                                      className="flex flex-col gap-2 p-3 bg-white/40 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 rounded-xl text-[11px] shadow-sm hover:border-cyan-500/20 transition-all"
                                    >
                                      <div className="flex justify-between items-center w-full">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                                          <span className="font-extrabold text-foreground truncate max-w-[120px]">{booking.customer_name}</span>
                                          <span className="text-[10px] text-cyan-500 dark:text-cyan-400 font-extrabold flex items-center gap-0.5 ml-2 shrink-0">
                                            <Clock size={10} />
                                            {formatTime(booking.booking_datetime)}
                                          </span>
                                        </div>
                                        {isFuture && (
                                          <Button
                                            onClick={() => handleCancelBooking(booking.booking_id)}
                                            isIconOnly
                                            variant="light"
                                            color="danger"
                                            size="sm"
                                            title={t.cancelBtnTooltip}
                                            className="w-5 h-5 min-w-5 rounded-md cursor-pointer hover:bg-danger/10 p-0"
                                          >
                                            <Trash2 size={12} />
                                          </Button>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-default-400 border-t border-slate-50 dark:border-white/5 pt-1.5 mt-0.5">
                                        <div className="truncate">
                                          <span className="font-semibold text-foreground">{t.serviceLabel} </span>
                                          <span className="text-cyan-500 dark:text-cyan-400 font-semibold">{booking.service_topic}</span>
                                        </div>
                                        <div>
                                          <span className="font-semibold">{t.phoneLabel} </span>
                                          <span>{booking.phone_number}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Unassigned Bookings */}
                  {unassignedBookings.length > 0 && (
                    <div className="flex flex-col gap-3 p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                            <User size={16} />
                          </div>
                          <div className="text-left">
                            <h4 className="font-extrabold text-foreground text-xs leading-tight">
                              {lang === 'th' ? "คิวจองอื่นๆ / ไม่ระบุแพทย์" : "Other Bookings / Unassigned"}
                            </h4>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        {unassignedBookings.map((booking) => {
                          const isFuture = isUpcoming(booking.booking_datetime);
                          return (
                            <div
                              key={booking.booking_id}
                              className="flex flex-col gap-2 p-3 bg-white/40 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 rounded-xl text-[11px] hover:border-cyan-500/20 transition-all"
                            >
                              <div className="flex justify-between items-center w-full">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                                  <span className="font-extrabold text-foreground truncate max-w-[120px]">{booking.customer_name}</span>
                                  <span className="text-[10px] text-cyan-500 dark:text-cyan-400 font-extrabold flex items-center gap-0.5 ml-2 shrink-0">
                                    <Clock size={10} />
                                    {formatTime(booking.booking_datetime)}
                                  </span>
                                </div>
                                {isFuture && (
                                  <Button
                                    onClick={() => handleCancelBooking(booking.booking_id)}
                                    isIconOnly
                                    variant="light"
                                    color="danger"
                                    size="sm"
                                    title={t.cancelBtnTooltip}
                                    className="w-5 h-5 min-w-5 rounded-md cursor-pointer hover:bg-danger/10 p-0"
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-default-400 border-t border-slate-50 dark:border-white/5 pt-1.5 mt-0.5">
                                <div className="truncate">
                                  <span className="font-semibold text-foreground">{t.serviceLabel} </span>
                                  <span className="text-cyan-500 dark:text-cyan-400 font-semibold">{booking.service_topic}</span>
                                </div>
                                <div>
                                  <span className="font-semibold">{t.phoneLabel} </span>
                                  <span>{booking.phone_number}</span>
                                </div>
                                {booking.staff_name && (
                                  <div className="truncate sm:col-span-2">
                                    <span className="font-semibold text-foreground">{lang === 'th' ? 'แพทย์: ' : 'Doctor: '}</span>
                                    <span className="text-amber-500 dark:text-amber-400 font-semibold">{booking.staff_name}</span>
                                    {doctorsList.some(doc => booking.staff_name.toLowerCase().includes(doc.name.toLowerCase())) && (
                                      <span className="text-[9px] text-amber-500/80 ml-1">{lang === 'th' ? '(นอกเวรวันนี้)' : '(off-duty today)'}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section 3: Off-Duty / Other Doctors Collapsible Accordion */}
                  {offDutyDoctors.length > 0 && (
                    <div className="border border-white/5 rounded-2xl bg-white/5 overflow-hidden transition-all duration-300">
                      <button
                        onClick={() => setIsOffDutyExpanded(!isOffDutyExpanded)}
                        className="w-full flex justify-between items-center p-3.5 hover:bg-white/5 text-left text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Stethoscope size={15} className="text-slate-400" />
                          {lang === 'th' 
                            ? `แพทย์ที่ไม่มีเวรวันนี้ (${offDutyDoctors.length} ท่าน)` 
                            : `Other Doctors Off Duty Today (${offDutyDoctors.length})`
                          }
                        </span>
                        {isOffDutyExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      
                      {isOffDutyExpanded && (
                        <div className="p-4 bg-black/10 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto">
                          {offDutyDoctors.map((doc, idx) => (
                            <div key={idx} className="flex flex-col p-2.5 bg-white/5 rounded-xl border border-white/5 text-left">
                              <h5 className="font-bold text-foreground text-xs truncate">{doc.name}</h5>
                              <p className="text-[9px] text-slate-400 truncate mt-0.5">{doc.role || t.defaultRole}</p>
                              <div className="text-[9px] text-cyan-400 font-semibold mt-1 bg-cyan-900/10 px-2 py-0.5 rounded border border-cyan-500/10 inline-block w-fit">
                                {lang === 'th' ? `ตาราง: ${doc.schedule}` : `Schedule: ${doc.schedule}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })()}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default BookingsManager;
