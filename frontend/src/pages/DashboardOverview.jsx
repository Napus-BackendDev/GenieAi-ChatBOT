import { useEffect, useState, useMemo } from 'react';
import { Calendar, FileText, Copy, Check, User, Users, Power } from 'lucide-react';

const translations = {
  th: {
    welcome: "ยินดีต้อนรับกลับมา",
    subWelcome: "นี่คือข้อมูลการนัดหมายและโครงสร้างความรู้ระบบเลขา AI ของร้านคุณในวันนี้",
    totalBookings: "ยอดจองทั้งหมด",
    allTime: "รวมทั้งหมด",
    knowledgeDocs: "คลังคู่มือความรู้",
    ragActive: "ระบบ RAG/CAG พร้อมใช้งาน",
    upcomingQueue: "คิวที่กำลังมาถึง",
    waitingService: "รอการให้บริการ",
    botStatus: "สถานะบอต LINE",
    connected: "ทำงานอยู่",
    connectedSub: "เชื่อมต่อแล้ว",
    notConnected: "ยังไม่ได้เชื่อมต่อ",
    connectNow: "เชื่อมต่อเลย",
    appointments: "การนัดหมายรายเดือน",
    bookings: "การจอง",
    topServices: "บริการยอดนิยม",
    nextBooking: "นัดหมายถัดไป",
    bookingId: "รหัสการจอง",
    mobilePhone: "เบอร์โทรศัพท์",
    date: "วันที่",
    time: "เวลา",
    lineSentNotice: "*ระบบส่งข้อความยืนยันทาง LINE เรียบร้อยแล้ว",
    noNextBooking: "ไม่มีรายการจองนัดหมายถัดไป",
    staffStatus: "ทีมงาน",
    noStaff: "ยังไม่มีข้อมูลทีมงาน เพิ่มได้ในหน้าตั้งค่าโปรไฟล์",
    recentBookings: "การจองล่าสุด",
    noBookings: "ยังไม่มีรายการจอง",
    noServiceData: "ยังไม่มีข้อมูลบริการจากการจอง",
    noAppointmentData: "ยังไม่มีข้อมูลการจอง",
    ownerAdmin: "เจ้าของร้าน",
    localhostNote: "URL นี้เป็นที่อยู่ภายในเครื่อง (localhost) ใช้ได้เฉพาะตอนทดสอบบนเครื่องนี้เท่านั้น หากต้องการให้ LINE ส่งข้อความเข้ามาได้จริง ต้องใช้ URL สาธารณะ เช่นผ่าน ngrok หรือโดเมนของเซิร์ฟเวอร์"
  },
  en: {
    welcome: "Welcome back",
    subWelcome: "Here is your shop's AI assistant appointment and knowledge summary today.",
    totalBookings: "Total Bookings",
    allTime: "all time",
    knowledgeDocs: "Knowledge Docs",
    ragActive: "RAG/CAG ready",
    upcomingQueue: "Upcoming Queue",
    waitingService: "waiting for service",
    botStatus: "LINE Bot Status",
    connected: "Active",
    connectedSub: "connected",
    notConnected: "Not connected",
    connectNow: "Connect now",
    appointments: "Monthly Appointments",
    bookings: "Bookings",
    topServices: "Top Services",
    nextBooking: "Next Booking Details",
    bookingId: "Booking ID",
    mobilePhone: "Mobile Phone",
    date: "Date",
    time: "Time",
    lineSentNotice: "*Confirmation message sent via LINE",
    noNextBooking: "No upcoming appointments",
    staffStatus: "Staff",
    noStaff: "No staff yet. Add them in profile settings.",
    recentBookings: "Recent Bookings",
    noBookings: "No bookings yet",
    noServiceData: "No service data from bookings yet",
    noAppointmentData: "No booking data yet",
    ownerAdmin: "Owner Admin",
    localhostNote: "This is a local (localhost) address that only works while testing on this machine. For LINE to actually deliver messages, use a public URL such as one from ngrok or your server domain."
  }
};

const PALETTE = ['#2B6CB0', '#A2D9E8', '#1A365D', '#38A169', '#D97706', '#7C3AED'];

const DashboardOverview = ({ tenantId, user, lang, setActiveTab }) => {
  const t = translations[lang || 'th'];
  const monthLabels = lang === 'th'
    ? ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const [bookings, setBookings] = useState([]);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [lineConnected, setLineConnected] = useState(false);
  const [profileStaff, setProfileStaff] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Webhook URL: on localhost dev map port 5173 -> backend 8000, otherwise use current origin.
  const webhookUrl = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `https://genieai-chatbot.onrender.com/api/webhooks/line/${tenantId}`;
    }
    return `${window.location.origin}/api/webhooks/line/${tenantId}`;
  })();

  const isLocalWebhook = false;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [bkRes, docsRes, profRes] = await Promise.all([
          fetch(`/api/bookings?tenant_id=${tenantId}`).catch(() => null),
          fetch(`/api/documents?tenant_id=${tenantId}`).catch(() => null),
          fetch(`/api/tenant/profile/${tenantId}`).catch(() => null)
        ]);

        const realBookings = bkRes && bkRes.ok ? await bkRes.json() : [];
        const docs = docsRes && docsRes.ok ? await docsRes.json() : [];
        const profile = profRes && profRes.ok ? await profRes.json() : {};

        if (cancelled) return;

        setBookings(Array.isArray(realBookings) ? realBookings : []);
        setDocumentsCount(Array.isArray(docs) ? docs.length : 0);
        setLineConnected(!!(profile && profile.line_configured));
        setProfileStaff((profile && Array.isArray(profile.staff)) ? profile.staff : []);
      } catch (e) {
        console.error("Failed to load dashboard statistics:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tenantId]);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goToSettings = () => {
    // Primary path: App passes setActiveTab (see App.jsx overview render block).
    if (typeof setActiveTab === 'function') {
      setActiveTab('settings');
      return;
    }
    // Fallback: hint the settings tab via the URL hash (App reads this on load).
    window.location.hash = 'settings';
  };

  const formatDate = (isoStr) => {
    try {
      return new Date(isoStr).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch {
      return isoStr || '';
    }
  };

  const formatTime = (isoStr) => {
    try {
      const time = new Date(isoStr).toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-GB', {
        hour: '2-digit', minute: '2-digit'
      });
      return lang === 'th' ? `${time} น.` : time;
    } catch {
      return '';
    }
  };

  const now = Date.now();
  const upcomingCount = useMemo(
    () => bookings.filter(b => new Date(b.booking_datetime).getTime() >= now).length,
    [bookings]
  );

  // Recent bookings: newest first (by appointment datetime).
  const recentBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(b.booking_datetime) - new Date(a.booking_datetime)),
    [bookings]
  );

  const nextBooking = useMemo(
    () => [...bookings]
      .filter(b => new Date(b.booking_datetime).getTime() >= now)
      .sort((a, b) => new Date(a.booking_datetime) - new Date(b.booking_datetime))[0],
    [bookings]
  );

  // Top services by real service_topic counts.
  const topServices = useMemo(() => {
    const counts = {};
    bookings.forEach(b => {
      const k = b.service_topic || (lang === 'th' ? 'อื่นๆ' : 'Other');
      counts[k] = (counts[k] || 0) + 1;
    });
    const total = bookings.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], i) => ({
        name,
        count,
        pct: (count / total) * 100,
        color: PALETTE[i % PALETTE.length]
      }));
  }, [bookings, lang]);

  // Monthly appointment buckets (last 12 months, real counts).
  const monthlyChart = useMemo(() => {
    const ref = new Date();
    const out = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
      const count = bookings.filter(b => {
        const bd = new Date(b.booking_datetime);
        return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth();
      }).length;
      out.push({ label: monthLabels[d.getMonth()], count });
    }
    return out;
  }, [bookings, lang]);
  const maxMonthly = Math.max(1, ...monthlyChart.map(m => m.count));
  const hasBookings = bookings.length > 0;

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm animate-pulse">
        {lang === 'th' ? 'กำลังโหลดข้อมูลแดชบอร์ด...' : 'Loading dashboard...'}
      </div>
    );
  }

  return (
    <div className="animate-fade-in text-left flex flex-col gap-8 p-6 md:p-8 w-full max-w-full">

      {/* Top Welcome Section + LINE Webhook Banner */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1A365D] dark:text-white">
            {t.welcome}, {user?.company_name || t.ownerAdmin}!
          </h2>
          <p className="text-xs text-[#2B6CB0] font-semibold mt-1">{t.subWelcome}</p>
        </div>

        <div className="flex flex-col items-start xl:items-end gap-1.5 max-w-full">
          <div className="flex items-center gap-3 bg-[#E6F4F8] dark:bg-slate-900 border border-[#A2D9E8]/40 dark:border-white/5 py-2 px-4 rounded-full shadow-sm max-w-full">
            <div className={`w-2 h-2 rounded-full ${lineConnected ? 'bg-[#38A169]' : 'bg-[#D97706]'} animate-pulse`}></div>
            <span className="text-[11px] font-bold text-[#1A365D] dark:text-slate-200 truncate max-w-[200px] md:max-w-[320px]">
              LINE Webhook: {webhookUrl}
            </span>
            <button
              onClick={handleCopyWebhook}
              className="p-1.5 hover:bg-[#A2D9E8]/30 dark:hover:bg-slate-800 rounded-full text-[#2B6CB0] dark:text-cyan-400 transition-colors cursor-pointer"
              title="Copy URL"
            >
              {copied ? <Check size={13} className="text-[#38A169]" /> : <Copy size={13} />}
            </button>
          </div>
          {isLocalWebhook && (
            <p className="text-[10px] text-[#D97706] dark:text-amber-400 font-medium leading-snug max-w-[340px] xl:text-right">
              {t.localhostNote}
            </p>
          )}
        </div>
      </div>

      {/* Row 1: 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Card 1: Total Bookings */}
        <div className="bg-[#FFFFFF] dark:bg-slate-900 bg-gradient-to-br from-white to-[#E6F4F8]/15 dark:from-slate-900 dark:to-slate-950 border border-[#A2D9E8]/30 dark:border-white/5 p-5 rounded-2xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col justify-between h-[105px] glow-brand-blue hover-scale relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold text-[#1A365D]/50 dark:text-slate-400 uppercase tracking-wider">
                {t.totalBookings}
              </p>
              <h3 className="text-2xl font-bold text-[#1A365D] dark:text-white mt-1">
                {bookings.length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#E6F4F8] dark:bg-slate-800 text-[#2B6CB0] dark:text-cyan-400 flex items-center justify-center border border-[#A2D9E8]/20">
              <Calendar size={18} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span className="text-slate-400 font-medium">{t.allTime}</span>
          </div>
        </div>

        {/* Card 2: Knowledge Documents */}
        <div className="bg-[#FFFFFF] dark:bg-slate-900 bg-gradient-to-br from-white to-[#E6F4F8]/15 dark:from-slate-900 dark:to-slate-950 border border-[#A2D9E8]/30 dark:border-white/5 p-5 rounded-2xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col justify-between h-[105px] glow-brand-blue hover-scale relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold text-[#1A365D]/50 dark:text-slate-400 uppercase tracking-wider">
                {t.knowledgeDocs}
              </p>
              <h3 className="text-2xl font-bold text-[#1A365D] dark:text-white mt-1">
                {documentsCount}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#E6F4F8] dark:bg-slate-800 text-[#2B6CB0] dark:text-cyan-400 flex items-center justify-center border border-[#A2D9E8]/20">
              <FileText size={18} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span className="text-slate-400 font-medium">{t.ragActive}</span>
          </div>
        </div>

        {/* Card 3: Upcoming Bookings */}
        <div className="bg-[#FFFFFF] dark:bg-slate-900 bg-gradient-to-br from-white to-purple-50/10 dark:from-slate-900 dark:to-slate-950 border border-purple-100 dark:border-white/5 p-5 rounded-2xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col justify-between h-[105px] glow-brand-blue hover-scale relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold text-[#1A365D]/50 dark:text-slate-400 uppercase tracking-wider">
                {t.upcomingQueue}
              </p>
              <h3 className="text-2xl font-bold text-[#1A365D] dark:text-white mt-1">
                {upcomingCount}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100/20">
              <Users size={18} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span className="text-slate-400 font-medium">{t.waitingService}</span>
          </div>
        </div>

        {/* Card 4: LINE Webhook Status */}
        <div className="bg-[#FFFFFF] dark:bg-slate-900 bg-gradient-to-br from-white to-emerald-50/10 dark:from-slate-900 dark:to-slate-950 border border-emerald-100 dark:border-white/5 p-5 rounded-2xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col justify-between h-[105px] glow-brand-blue hover-scale relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold text-[#1A365D]/50 dark:text-slate-400 uppercase tracking-wider">
                {t.botStatus}
              </p>
              {lineConnected ? (
                <h3 className="text-lg font-extrabold text-[#38A169] mt-2 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#38A169] animate-ping"></span>
                  {t.connected}
                </h3>
              ) : (
                <h3 className="text-lg font-extrabold text-[#D97706] mt-2 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]"></span>
                  {t.notConnected}
                </h3>
              )}
            </div>
            <div className={`w-10 h-10 rounded-xl bg-emerald-50 dark:bg-slate-800 flex items-center justify-center border border-emerald-100/20 ${lineConnected ? 'text-[#38A169]' : 'text-[#D97706]'}`}>
              <Power size={18} />
            </div>
          </div>
          {lineConnected ? (
            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <span className="text-[#38A169]">{t.connectedSub}</span>
            </div>
          ) : (
            <button
              onClick={goToSettings}
              className="text-[10px] font-extrabold text-[#2B6CB0] dark:text-cyan-400 hover:underline cursor-pointer text-left"
            >
              {t.connectNow} →
            </button>
          )}
        </div>

      </div>

      {/* Row 2: Visualizations (2 Columns - 2/3 and 1/3 split) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-6">

        {/* Left Column: Monthly Appointments Chart */}
        <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-extrabold text-[#1A365D] dark:text-white">
                {t.appointments}
              </h3>
              <div className="flex gap-4 mt-2">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                  <span className="chart-legend-dot bg-[#2B6CB0]"></span>
                  {t.bookings}
                </span>
              </div>
            </div>
          </div>

          {/* Bar Chart Graphics (real monthly buckets) */}
          {hasBookings ? (
            <div className="chart-bar-container pt-4 min-h-[180px]">
              {monthlyChart.map((d, i) => (
                <div key={i} className="chart-bar-col animate-fade-in">
                  <div className="chart-bar-value-wrapper">
                    <div
                      className="chart-bar-segment bg-[#2B6CB0] transition-all duration-500 ease-out-back"
                      style={{ height: `${(d.count / maxMonthly) * 100}%` }}
                      title={`${d.count}`}
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold mt-2">{d.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-h-[180px] flex flex-col items-center justify-center text-center text-slate-400 text-xs">
              <Calendar size={36} className="opacity-30 mb-2" />
              <span>{t.noAppointmentData}</span>
            </div>
          )}
        </div>

        {/* Right Column: Top Services */}
        <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-extrabold text-[#1A365D] dark:text-white">
              {t.topServices}
            </h3>
          </div>

          {topServices.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 text-xs py-6">
              <span>{t.noServiceData}</span>
            </div>
          ) : (
            <div className="flex flex-row items-center gap-6 justify-center py-4">
              {/* SVG Donut Chart (real per-service share) */}
              <div className="relative w-[120px] h-[120px]">
                <svg width="120" height="120" viewBox="0 0 36 36" className="donut-svg">
                  <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#E6F4F8" strokeWidth="4.2" className="dark:stroke-slate-800" />
                  {(() => {
                    let cumulative = 0;
                    return topServices.map((s, i) => {
                      const frac = s.pct;
                      const el = (
                        <circle
                          key={i}
                          cx="18" cy="18" r="15.915"
                          fill="transparent"
                          stroke={s.color}
                          strokeWidth="4.2"
                          strokeDasharray={`${frac.toFixed(2)} ${(100 - frac).toFixed(2)}`}
                          strokeDashoffset={(-cumulative).toFixed(2)}
                          strokeLinecap="butt"
                        />
                      );
                      cumulative += frac;
                      return el;
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-base font-extrabold text-[#1A365D] dark:text-white">{bookings.length}</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{t.bookings}</span>
                </div>
              </div>

              {/* Legends */}
              <div className="flex flex-col gap-2.5 text-left flex-1 min-w-0">
                {topServices.map((s, i) => (
                  <div key={i} className="flex justify-between items-center text-xs gap-2">
                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 min-w-0 flex-1" title={s.name}>
                      <span className="chart-legend-dot shrink-0" style={{ backgroundColor: s.color }}></span>
                      <span className="truncate block max-w-[140px] sm:max-w-[180px] md:max-w-none">{s.name}</span>
                    </span>
                    <span className="font-extrabold text-[#1A365D] dark:text-white shrink-0">{Math.round(s.pct)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Row 3: Detailed Cards (3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* Column 1: Next Booking Details */}
        <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col h-[280px]">
          <h3 className="text-sm font-extrabold text-[#1A365D] dark:text-white mb-4 pb-2.5 border-b border-slate-100 dark:border-white/5">
            {t.nextBooking}
          </h3>

          {nextBooking ? (
            <div className="flex-1 flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#E6F4F8] dark:bg-slate-800 text-[#2B6CB0] font-bold flex items-center justify-center text-sm border border-[#A2D9E8]/30">
                  {(nextBooking.customer_name || '?').substring(0, 2).toUpperCase()}
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-[#1A365D] dark:text-white text-sm">
                    {nextBooking.customer_name || '-'}
                  </h4>
                  <p className="text-xs text-[#2B6CB0] dark:text-cyan-400 font-semibold">
                    {nextBooking.service_topic || '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-2 my-2 py-2 border-t border-b border-slate-50 dark:border-white/5 text-xs text-slate-500 font-medium">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">{t.bookingId}</span>
                  <span className="text-[#1A365D] dark:text-white truncate block max-w-[100px] font-bold">{(nextBooking.booking_id || '').substring(0, 8) || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">{t.mobilePhone}</span>
                  <span className="text-[#1A365D] dark:text-white block font-bold">{nextBooking.phone_number || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">{t.date}</span>
                  <span className="text-[#1A365D] dark:text-white block font-bold">{formatDate(nextBooking.booking_datetime)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">{t.time}</span>
                  <span className="text-[#2B6CB0] dark:text-cyan-400 block font-extrabold">{formatTime(nextBooking.booking_datetime)}</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 italic">
                {t.lineSentNotice}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
              <User size={36} className="opacity-30 mb-2" />
              <span>{t.noNextBooking}</span>
            </div>
          )}
        </div>

        {/* Column 2: Staff (real profile.staff only) */}
        <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col h-[280px]">
          <h3 className="text-sm font-extrabold text-[#1A365D] dark:text-white mb-4 pb-2.5 border-b border-slate-100 dark:border-white/5">
            {t.staffStatus}
          </h3>

          {profileStaff.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 text-xs px-4">
              <Users size={36} className="opacity-30 mb-2" />
              <span>{t.noStaff}</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto scrollbar-hidden">
              {profileStaff.map((staff, idx) => {
                const name = staff.name || '-';
                const label = name + (staff.role ? ` (${staff.role})` : '');
                return (
                  <div key={idx} className="flex justify-between items-center">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#E6F4F8] dark:bg-slate-800 text-[#1A365D] dark:text-cyan-400 font-bold flex items-center justify-center text-[10px] border border-[#A2D9E8]/30 shrink-0">
                        {name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-[#1A365D] dark:text-slate-200 truncate">
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 3: Recent Bookings */}
        <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col h-[280px] md:col-span-2 xl:col-span-1">
          <h3 className="text-sm font-extrabold text-[#1A365D] dark:text-white mb-4 pb-2.5 border-b border-slate-100 dark:border-white/5">
            {t.recentBookings}
          </h3>

          <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-hidden">
            {recentBookings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                <Calendar size={36} className="opacity-30 mb-2" />
                <span>{t.noBookings}</span>
              </div>
            ) : (
              recentBookings.slice(0, 4).map((req, idx) => (
                <div
                  key={req.booking_id || idx}
                  className="flex items-center justify-between p-2.5 bg-[#E6F4F8]/15 dark:bg-slate-950/40 rounded-xl border border-[#A2D9E8]/10 text-xs"
                >
                  <div className="text-left truncate min-w-0 flex-1">
                    <h4 className="font-bold text-[#1A365D] dark:text-white truncate">
                      {req.customer_name || '-'}
                    </h4>
                    <p className="text-[9px] text-[#2B6CB0] dark:text-cyan-400 font-semibold truncate">
                      {req.service_topic || '-'}
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 shrink-0 ml-2 text-right">
                    {formatDate(req.booking_datetime)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default DashboardOverview;
