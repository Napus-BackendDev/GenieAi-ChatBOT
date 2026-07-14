import { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Search, Trash2, User, Clock, AlertCircle, ChevronLeft, ChevronRight, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, Button, Chip, Input } from '@heroui/react';
import { BookingsSkeleton } from '../components/SkeletonLoader';

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

  // Count bookings per calendar day of the CURRENT month (one pass).
  // The calendar shows the actual number per day, not just a "has bookings" dot,
  // so the owner sees how busy each day is at a glance.
  const bookingCountByDay = {};
  bookings.forEach((booking) => {
    try {
      const bDate = new Date(booking.booking_datetime);
      if (bDate.getFullYear() === year && bDate.getMonth() === month) {
        const d = bDate.getDate();
        bookingCountByDay[d] = (bookingCountByDay[d] || 0) + 1;
      }
    } catch { /* skip unparseable */ }
  });
  const monthTotal = Object.values(bookingCountByDay).reduce((a, c) => a + c, 0);

  // Jump the calendar back to today (and select it).
  const goToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
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
    calendarCells.push(<div key={`empty-${i}`} className="aspect-square w-full"></div>);
  }
  // Month dates
  for (let d = 1; d <= daysInMonth; d++) {
    const dateOfCell = new Date(year, month, d);
    const isSelected = isSameDay(dateOfCell, selectedDate);
    const isToday = isSameDay(dateOfCell, new Date());
    const count = bookingCountByDay[d] || 0;

    calendarCells.push(
      <button
        key={`day-${d}`}
        type="button"
        onClick={() => setSelectedDate(dateOfCell)}
        aria-label={`${d} — ${count} ${lang === 'en' ? 'bookings' : 'นัด'}`}
        aria-pressed={isSelected}
        className={`aspect-square w-full flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 cursor-pointer relative ${
          isSelected
            ? 'bg-gradient-to-br from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/30 font-bold'
            : isToday
            ? 'bg-cyan-500/10 ring-2 ring-cyan-500/40 text-cyan-500 dark:text-cyan-300 font-bold'
            : count > 0
            ? 'text-foreground bg-white/[0.03] hover:bg-white/10 font-semibold'
            : 'text-default-400 hover:bg-white/5'
        }`}
      >
        <span className="text-sm leading-none">{d}</span>
        {count > 0 ? (
          <span
            className={`min-w-[1.15rem] h-[1.15rem] px-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none ${
              isSelected
                ? 'bg-white/25 text-white'
                : 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-600 dark:text-cyan-300 ring-1 ring-cyan-500/30'
            }`}
          >
            {count}
          </span>
        ) : (
          <span className="h-[1.15rem]" />
        )}
      </button>
    );
  }
  // Trailing blanks so the final week is a complete rectangle (cleaner grid).
  const usedCells = firstDayIndex + daysInMonth;
  const trailing = (7 - (usedCells % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    calendarCells.push(<div key={`trail-${i}`} className="aspect-square w-full"></div>);
  }

  if (loading) {
    return <BookingsSkeleton />;
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

      {/* Stacked layout: calendar on top, the day's bookings below */}
      <div className="flex flex-col gap-6">

        {/* Top Card: Calendar */}
        <Card className="glass-panel border-white/5 shadow-md p-6 rounded-2xl flex flex-col h-auto">
          <CardContent className="p-0 flex flex-col gap-6">
            {/* Calendar Header with Navigation */}
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <CalendarIcon size={18} className="text-cyan-400" />
                  <span>{thaiMonths[month]} {lang === 'th' ? year + 543 : year}</span>
                </h2>
                <span className="text-[11px] text-default-400 font-semibold mt-0.5 ml-6">
                  {monthTotal > 0
                    ? (lang === 'en' ? `${monthTotal} bookings this month` : `${monthTotal} นัดในเดือนนี้`)
                    : (lang === 'en' ? 'No bookings this month' : 'ยังไม่มีนัดในเดือนนี้')}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <Button
                  size="sm"
                  variant="flat"
                  onClick={goToday}
                  className="h-8 px-3 text-xs font-bold bg-cyan-500/10 text-cyan-500 dark:text-cyan-300 hover:bg-cyan-500/20 rounded-xl cursor-pointer"
                >
                  {lang === 'en' ? 'Today' : 'วันนี้'}
                </Button>
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
                <span className="min-w-[1.1rem] h-[1.1rem] px-1 inline-flex items-center justify-center rounded-full text-[9px] font-bold bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-600 dark:text-cyan-300 ring-1 ring-cyan-500/30">3</span>
                {lang === 'en' ? 'Bookings that day' : 'จำนวนนัดในวันนั้น'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-gradient-to-br from-cyan-500 to-indigo-500"></span>
                {t.legendSelectedDate}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded ring-2 ring-cyan-500/40 bg-cyan-500/10"></span>
                {t.legendToday}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Card: the selected day's bookings */}
        <Card className="glass-panel border-white/5 shadow-md p-6 rounded-2xl flex flex-col min-h-[400px]">
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

            {/* Bookings List — flat, time-sorted; the doctor is just an optional tag */}
            {filteredBookings.length === 0 ? (
              <div className="py-16 text-center text-default-400 text-sm flex-1 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl bg-slate-900/10">
                <CalendarIcon size={32} className="text-default-400 opacity-60 mb-2" />
                <span>{t.noBookings}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[560px] pr-1">
                <p className="text-xs font-bold text-default-400">
                  {lang === 'th' ? `${filteredBookings.length} นัดในวันนี้` : `${filteredBookings.length} booking${filteredBookings.length > 1 ? 's' : ''}`}
                </p>
                {[...filteredBookings]
                  .sort((a, b) => new Date(a.booking_datetime) - new Date(b.booking_datetime))
                  .map((booking) => {
                    const isFuture = isUpcoming(booking.booking_datetime);
                    const doctorOffDuty = booking.staff_name && (profile?.staff || []).some(
                      (doc) => booking.staff_name.toLowerCase().includes(doc.name.toLowerCase())
                        && !getDoctorShiftInfo(doc, selectedDate).isWorking
                    );
                    return (
                      <div
                        key={booking.booking_id}
                        className={`flex items-stretch gap-3 p-3 bg-white/40 dark:bg-slate-900/50 border rounded-2xl transition-all ${
                          isFuture ? 'border-slate-100 dark:border-white/5 hover:border-cyan-500/30' : 'border-transparent opacity-70'
                        }`}
                      >
                        {/* Time chip */}
                        <div className="flex flex-col items-center justify-center px-2.5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 border border-cyan-500/15 shrink-0 min-w-[62px]">
                          <Clock size={12} className="text-cyan-400 mb-0.5" />
                          <span className="text-[11px] font-extrabold text-cyan-500 dark:text-cyan-300 leading-tight text-center">
                            {formatTime(booking.booking_datetime)}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <User size={14} className="text-default-400 shrink-0" />
                              <span className="font-extrabold text-foreground text-sm truncate">
                                {booking.customer_name || '—'}
                              </span>
                              {!isFuture && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 font-bold shrink-0">
                                  {lang === 'th' ? 'ผ่านแล้ว' : 'past'}
                                </span>
                              )}
                            </div>
                            {isFuture && (
                              <Button
                                onClick={() => handleCancelBooking(booking.booking_id)}
                                isIconOnly
                                variant="light"
                                color="danger"
                                size="sm"
                                title={t.cancelBtnTooltip}
                                className="w-6 h-6 min-w-6 rounded-md cursor-pointer hover:bg-danger/10 p-0 shrink-0"
                              >
                                <Trash2 size={13} />
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 font-semibold max-w-full truncate">
                              {booking.service_topic || (lang === 'th' ? 'ไม่ระบุบริการ' : 'No service')}
                            </span>
                            {booking.staff_name ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-300 font-semibold">
                                <Stethoscope size={11} />{booking.staff_name}
                                {doctorOffDuty && (
                                  <span className="text-amber-500 dark:text-amber-400 ml-0.5">
                                    {lang === 'th' ? '(นอกเวร)' : '(off-duty)'}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-500/10 text-default-400 font-semibold">
                                <Stethoscope size={11} />{lang === 'th' ? 'ไม่ระบุแพทย์' : 'Any doctor'}
                              </span>
                            )}
                            {booking.phone_number && (
                              <span className="text-default-400">{booking.phone_number}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default BookingsManager;
