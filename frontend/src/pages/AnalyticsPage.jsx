import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, DollarSign, Users, CalendarCheck, Bot,
  ArrowUpRight, ArrowDownRight, Sparkles, Clock, UserCheck, MessageSquare
} from 'lucide-react';

const translations = {
  th: {
    title: 'วิเคราะห์ข้อมูล',
    subtitle: 'ภาพรวมประสิทธิภาพธุรกิจและผู้ช่วย AI ของร้านคุณ',
    demoBadge: 'ข้อมูลสาธิต',
    demoTip: 'ยังมีข้อมูลการจองจริงไม่พอ ระบบจึงแสดงตัวอย่างเพื่อให้เห็นหน้าตากราฟ',
    tf7: '7 วัน', tf30: '30 วัน', tf12m: '12 เดือน',
    kpiBookings: 'ยอดจองในช่วงนี้',
    kpiRevenue: 'รายได้ประมาณ',
    kpiCustomers: 'ลูกค้าไม่ซ้ำ',
    kpiResolution: 'AI ตอบเองได้',
    vsPrev: 'เทียบช่วงก่อน',
    bookingTrend: 'เทรนด์การจอง',
    bookingTrendSub: 'จำนวนการจองที่เกิดขึ้นในแต่ละช่วง',
    topServices: 'บริการยอดนิยม',
    byStaff: 'ผลงานตามพนักงาน',
    byStaffSub: 'จำนวนการจองต่อคน',
    peakDays: 'วันที่คนจองเยอะ',
    peakDaysSub: 'กระจายตามวันในสัปดาห์',
    aiPerf: 'ประสิทธิภาพ AI / แชท',
    resolved: 'AI ตอบเอง',
    escalated: 'ส่งต่อเจ้าหน้าที่',
    totalSessions: 'บทสนทนาทั้งหมด',
    activeSessions: 'กำลังสนทนา',
    revenueByService: 'รายได้ตามบริการ',
    noData: 'ยังไม่มีข้อมูล',
    bookings: 'การจอง',
    baht: 'บาท',
    days: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
    months: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  },
  en: {
    title: 'Analytics',
    subtitle: 'Business performance and AI assistant overview for your shop',
    demoBadge: 'Demo data',
    demoTip: 'Not enough real bookings yet, so sample data is shown to preview the charts.',
    tf7: '7 days', tf30: '30 days', tf12m: '12 months',
    kpiBookings: 'Bookings this period',
    kpiRevenue: 'Est. Revenue',
    kpiCustomers: 'Unique customers',
    kpiResolution: 'AI Self-Resolved',
    vsPrev: 'vs previous',
    bookingTrend: 'Booking Trend',
    bookingTrendSub: 'Bookings created over time',
    topServices: 'Top Services',
    byStaff: 'Staff Performance',
    byStaffSub: 'Bookings per staff member',
    peakDays: 'Peak Days',
    peakDaysSub: 'Distribution by day of week',
    aiPerf: 'AI / Chat Performance',
    resolved: 'AI resolved',
    escalated: 'Escalated to human',
    totalSessions: 'Total conversations',
    activeSessions: 'Active now',
    revenueByService: 'Revenue by Service',
    noData: 'No data yet',
    bookings: 'bookings',
    baht: 'THB',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  }
};

const PALETTE = ['#2B6CB0', '#A2D9E8', '#1A365D', '#38A169', '#D97706', '#7C3AED', '#0891B2', '#E53E3E'];

// ---------- helpers ----------
const parsePrice = (p) => {
  if (typeof p === 'number') return p;
  const n = parseInt(String(p || '').replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? 0 : n;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const bookingDate = (b) => new Date(b.created_at || b.booking_datetime);

// ---------- SVG sub-charts ----------
const TrendChart = ({ data, color = '#2B6CB0' }) => {
  const w = 640, h = 210, padX = 10, padTop = 16, padBottom = 26;
  const chartW = w - padX * 2;
  const chartH = h - padTop - padBottom;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.count));
  const xFor = (i) => padX + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yFor = (v) => padTop + chartH - (v / max) * chartH;
  const linePts = data.map((d, i) => `${xFor(i).toFixed(1)},${yFor(d.count).toFixed(1)}`).join(' ');
  const areaPts = `${padX},${padTop + chartH} ${linePts} ${padX + chartW},${padTop + chartH}`;
  const labelEvery = Math.max(1, Math.ceil(n / 7));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[210px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* horizontal gridlines */}
      {[0.25, 0.5, 0.75].map((g, i) => (
        <line key={i} x1={padX} y1={padTop + chartH * g} x2={padX + chartW} y2={padTop + chartH * g}
          stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
      ))}
      <polygon points={areaPts} fill="url(#trendFill)" />
      <polyline points={linePts} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(d.count)} r={n > 20 ? 1.6 : 3}
          fill="#fff" stroke={color} strokeWidth="2" />
      ))}
      {data.map((d, i) => (
        (i % labelEvery === 0 || i === n - 1) ? (
          <text key={`l${i}`} x={xFor(i)} y={h - 8} textAnchor="middle"
            fontSize="10" fill="currentColor" fillOpacity="0.45" fontWeight="600">
            {d.label}
          </text>
        ) : null
      ))}
    </svg>
  );
};

const DonutChart = ({ segments, centerLabel, centerSub }) => {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let cumulative = 0;
  return (
    <div className="relative w-[130px] h-[130px] shrink-0">
      <svg width="130" height="130" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#E6F4F8" strokeWidth="4"
          className="dark:stroke-slate-800" />
        {segments.map((s, i) => {
          const frac = (s.value / total) * 100;
          const el = (
            <circle key={i} cx="18" cy="18" r="15.915" fill="transparent"
              stroke={s.color} strokeWidth="4"
              strokeDasharray={`${frac.toFixed(2)} ${(100 - frac).toFixed(2)}`}
              strokeDashoffset={(-cumulative).toFixed(2)}
              strokeLinecap="butt" />
          );
          cumulative += frac;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-extrabold text-[#1A365D] dark:text-white">{centerLabel}</span>
        {centerSub && <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{centerSub}</span>}
      </div>
    </div>
  );
};

const HBar = ({ label, value, display, max, color, suffix }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between items-center text-xs">
      <span className="text-slate-500 dark:text-slate-300 font-semibold truncate max-w-[60%]" title={label}>{label}</span>
      <span className="font-extrabold text-[#1A365D] dark:text-white shrink-0">{display != null ? display : `${value}${suffix || ''}`}</span>
    </div>
    <div className="h-2 w-full bg-[#E6F4F8] dark:bg-slate-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${max > 0 ? Math.max(4, (value / max) * 100) : 0}%`, backgroundColor: color }} />
    </div>
  </div>
);

// ---------- demo generator ----------
const genDemoBookings = (serviceNames, staffNames) => {
  const out = [];
  const now = Date.now();
  const svc = serviceNames.length ? serviceNames : ['ตรวจปรึกษา', 'ทำหัตถการ', 'ฟอกสีฟัน', 'ขูดหินปูน', 'จัดฟัน'];
  const stf = staffNames.length ? staffNames : ['ทีมงาน A', 'ทีมงาน B', 'ทีมงาน C'];
  const count = 48;
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.pow(Math.random(), 1.4) * 60); // recency-biased
    const apptDate = new Date(now - daysAgo * 86400000);
    apptDate.setHours(9 + Math.floor(Math.random() * 10), Math.random() > 0.5 ? 30 : 0, 0, 0);
    const created = new Date(apptDate.getTime() - Math.floor(Math.random() * 3) * 86400000);
    out.push({
      booking_id: `demo-${i}`,
      customer_name: `ลูกค้า ${i + 1}`,
      phone_number: `08${(10000000 + Math.floor(Math.random() * 89999999))}`,
      service_topic: svc[Math.floor(Math.random() * svc.length)],
      staff_name: stf[Math.floor(Math.random() * stf.length)],
      booking_datetime: apptDate.toISOString(),
      created_at: created.toISOString()
    });
  }
  return out;
};

const AnalyticsPage = ({ tenantId, lang }) => {
  const t = translations[lang || 'th'];
  const [timeframe, setTimeframe] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [isDemo, setIsDemo] = useState(false);
  const [chat, setChat] = useState({ total: 0, active: 0, escalated: 0, demo: false });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [bkRes, profRes, sessRes] = await Promise.all([
          fetch(`/api/bookings?tenant_id=${tenantId}`).catch(() => null),
          fetch(`/api/tenant/profile/${tenantId}`).catch(() => null),
          fetch(`/api/chat/sessions?tenant_id=${tenantId}`).catch(() => null)
        ]);

        const realBookings = bkRes && bkRes.ok ? await bkRes.json() : [];
        const profile = profRes && profRes.ok ? await profRes.json() : {};
        const svcList = (profile && profile.services) || [];
        const staffList = ((profile && profile.staff) || []).map((s) => s.name).filter(Boolean);

        let sessions = [];
        if (sessRes && sessRes.ok) {
          try { sessions = await sessRes.json(); } catch { sessions = []; }
        }

        if (cancelled) return;

        setServices(svcList);

        // Use real bookings when we have a meaningful amount, otherwise fall back to demo
        if (realBookings.length >= 4) {
          setBookings(realBookings);
          setIsDemo(false);
        } else {
          setBookings(genDemoBookings(svcList.map((s) => s.name).filter(Boolean), staffList));
          setIsDemo(true);
        }

        if (Array.isArray(sessions) && sessions.length > 0) {
          const escalated = sessions.filter((s) => s.requires_human).length;
          const active = sessions.filter((s) => s.time === 'Active now').length;
          setChat({ total: sessions.length, active, escalated, demo: false });
        } else {
          setChat({ total: 128, active: 3, escalated: 9, demo: true });
        }
      } catch (e) {
        console.error('Failed to load analytics:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tenantId]);

  const priceMap = useMemo(() => {
    const m = {};
    services.forEach((s) => { if (s.name) m[s.name.trim().toLowerCase()] = parsePrice(s.price); });
    return m;
  }, [services]);

  const avgPrice = useMemo(() => {
    const vals = Object.values(priceMap).filter((v) => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 500;
  }, [priceMap]);

  // Returns the matched service price, or null when it falls back to avgPrice
  const exactPriceFor = (topic) => {
    if (!topic) return null;
    const key = topic.trim().toLowerCase();
    if (priceMap[key]) return priceMap[key];
    // fuzzy: service name contained in the topic or vice versa
    for (const [name, price] of Object.entries(priceMap)) {
      if (price > 0 && (key.includes(name) || name.includes(key))) return price;
    }
    return null;
  };

  const priceFor = (topic) => {
    const matched = exactPriceFor(topic);
    return matched === null ? avgPrice : matched;
  };

  const periodDays = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 365;

  const inWindow = (list, startMsAgo, endMsAgo) => {
    const now = Date.now();
    return list.filter((b) => {
      const ms = bookingDate(b).getTime();
      return ms >= now - startMsAgo && ms < now - endMsAgo;
    });
  };

  const curBookings = useMemo(() => inWindow(bookings, periodDays * 86400000, 0), [bookings, periodDays]);
  const prevBookings = useMemo(() => inWindow(bookings, periodDays * 2 * 86400000, periodDays * 86400000), [bookings, periodDays]);

  const revenue = useMemo(() => curBookings.reduce((sum, b) => sum + priceFor(b.service_topic), 0), [curBookings]);
  const prevRevenue = useMemo(() => prevBookings.reduce((sum, b) => sum + priceFor(b.service_topic), 0), [prevBookings]);
  // Revenue is an estimate when any booking's price fell back to avgPrice (no matching service price)
  const revenueIsEstimate = useMemo(
    () => curBookings.some((b) => exactPriceFor(b.service_topic) === null),
    [curBookings, priceMap]
  );
  const uniqueCustomers = useMemo(() => new Set(curBookings.map((b) => b.phone_number)).size, [curBookings]);

  const pctChange = (cur, prev) => {
    if (prev <= 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  };

  // Trend buckets
  const trend = useMemo(() => {
    const now = new Date();
    const out = [];
    if (timeframe === '12m') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const count = bookings.filter((b) => {
          const bd = bookingDate(b);
          return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth();
        }).length;
        out.push({ label: t.months[d.getMonth()], count });
      }
    } else {
      const days = timeframe === '7d' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const day = startOfDay(new Date(now.getTime() - i * 86400000));
        const count = bookings.filter((b) => startOfDay(bookingDate(b)).getTime() === day.getTime()).length;
        const label = days === 7 ? t.days[day.getDay()] : `${day.getDate()}`;
        out.push({ label, count });
      }
    }
    return out;
  }, [bookings, timeframe, lang]);

  // Top services (within current window)
  const topServices = useMemo(() => {
    const counts = {};
    curBookings.forEach((b) => {
      const k = b.service_topic || (lang === 'th' ? 'อื่นๆ' : 'Other');
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count], i) => ({ name, count, color: PALETTE[i % PALETTE.length] }));
  }, [curBookings, lang]);

  // Staff performance
  const staffPerf = useMemo(() => {
    const counts = {};
    curBookings.forEach((b) => {
      const k = b.staff_name || (lang === 'th' ? 'ไม่ระบุ' : 'Unassigned');
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, count], i) => ({ name, count, color: PALETTE[i % PALETTE.length] }));
  }, [curBookings, lang]);

  // Peak day of week (uses appointment datetime)
  const peakDays = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    curBookings.forEach((b) => { counts[new Date(b.booking_datetime).getDay()]++; });
    return counts.map((count, i) => ({ label: t.days[i], count }));
  }, [curBookings, lang]);

  const resolutionRate = chat.total > 0 ? Math.round(((chat.total - chat.escalated) / chat.total) * 100) : 0;

  const revenueByService = useMemo(() => {
    const rev = {};
    curBookings.forEach((b) => {
      const k = b.service_topic || (lang === 'th' ? 'อื่นๆ' : 'Other');
      rev[k] = (rev[k] || 0) + priceFor(b.service_topic);
    });
    return Object.entries(rev).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, amount], i) => ({ name, amount, color: PALETTE[i % PALETTE.length] }));
  }, [curBookings, lang]);

  const bookingChange = pctChange(curBookings.length, prevBookings.length);
  const revenueChange = pctChange(revenue, prevRevenue);

  const timeframes = [
    { id: '7d', label: t.tf7 },
    { id: '30d', label: t.tf30 },
    { id: '12m', label: t.tf12m }
  ];

  const KpiCard = ({ icon: Icon, label, value, change, accent }) => (
    <div className="bg-white dark:bg-slate-900 bg-gradient-to-br from-white to-[#E6F4F8]/15 dark:from-slate-900 dark:to-slate-950 border border-[#A2D9E8]/30 dark:border-white/5 p-5 rounded-2xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col justify-between h-[112px] hover-scale relative overflow-hidden">
      <div className="flex justify-between items-start">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold text-[#1A365D]/50 dark:text-slate-400 uppercase tracking-wider truncate">{label}</p>
          <h3 className="text-2xl font-bold text-[#1A365D] dark:text-white mt-1 truncate">{value}</h3>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#E6F4F8] dark:bg-slate-800 flex items-center justify-center border border-[#A2D9E8]/20 shrink-0" style={{ color: accent }}>
          <Icon size={18} />
        </div>
      </div>
      {typeof change === 'number' && (
        <div className="flex items-center gap-1.5 text-[10px] font-bold">
          <span className={`flex items-center gap-0.5 ${change >= 0 ? 'text-[#38A169]' : 'text-[#E53E3E]'}`}>
            {change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{change >= 0 ? '+' : ''}{change}%
          </span>
          <span className="text-slate-400 font-medium">{t.vsPrev}</span>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm animate-pulse">
        {lang === 'th' ? 'กำลังโหลดข้อมูลวิเคราะห์...' : 'Loading analytics...'}
      </div>
    );
  }

  const maxStaff = Math.max(1, ...staffPerf.map((s) => s.count));
  const maxPeak = Math.max(1, ...peakDays.map((d) => d.count));
  const maxRev = Math.max(1, ...revenueByService.map((r) => r.amount));

  return (
    <div className="animate-fade-in text-left flex flex-col gap-6 p-6 md:p-8 w-full max-w-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2">
            <Sparkles size={22} className="text-[#2B6CB0] dark:text-cyan-400" />
            {t.title}
            {isDemo && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full" title={t.demoTip}>
                {t.demoBadge}
              </span>
            )}
          </h2>
          <p className="text-xs text-[#2B6CB0] font-semibold mt-1">{t.subtitle}</p>
        </div>

        {/* Timeframe selector */}
        <div className="flex bg-[#E6F4F8]/40 dark:bg-slate-950 p-0.5 rounded-xl border border-[#A2D9E8]/20 dark:border-white/10 text-xs font-bold text-slate-500 dark:text-slate-400">
          {timeframes.map((tf) => (
            <button key={tf.id} onClick={() => setTimeframe(tf.id)}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                timeframe === tf.id
                  ? 'bg-white dark:bg-slate-900 text-[#2B6CB0] dark:text-cyan-400 shadow-sm'
                  : 'hover:text-[#2B6CB0] dark:hover:text-cyan-400'
              }`}>
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard icon={CalendarCheck} label={t.kpiBookings} value={curBookings.length} change={bookingChange} accent="#2B6CB0" />
        <KpiCard icon={DollarSign} label={t.kpiRevenue} value={`${revenueIsEstimate ? '~' : ''}฿${revenue.toLocaleString('th-TH')}`} change={revenueChange} accent="#38A169" />
        <KpiCard icon={Users} label={t.kpiCustomers} value={uniqueCustomers} accent="#7C3AED" />
        <KpiCard icon={Bot} label={t.kpiResolution} value={chat.demo ? '—' : `${resolutionRate}%`} accent="#0891B2" />
      </div>

      {/* Row 2: Trend + Top services */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-6">
        <div className="bg-white dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(26,54,93,0.02)]">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-base font-extrabold text-[#1A365D] dark:text-white">{t.bookingTrend}</h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">{t.bookingTrendSub}</p>
            </div>
            <span className="text-[10px] font-bold text-[#2B6CB0] border border-[#2B6CB0]/20 px-2 py-0.5 rounded-md">
              {timeframes.find((x) => x.id === timeframe)?.label}
            </span>
          </div>
          <div className="text-[#2B6CB0] dark:text-cyan-400">
            <TrendChart data={trend} color="#2B6CB0" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col">
          <h3 className="text-base font-extrabold text-[#1A365D] dark:text-white mb-4">{t.topServices}</h3>
          {topServices.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">{t.noData}</div>
          ) : (
            <div className="flex items-center gap-5">
              <DonutChart
                segments={topServices.map((s) => ({ value: s.count, color: s.color }))}
                centerLabel={curBookings.length}
                centerSub={t.bookings}
              />
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {topServices.map((s, i) => (
                  <div key={i} className="flex justify-between items-center text-xs gap-2">
                    <span className="text-slate-500 dark:text-slate-300 font-medium flex items-center gap-1.5 min-w-0 flex-1" title={s.name}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="font-extrabold text-[#1A365D] dark:text-white shrink-0">
                      {Math.round((s.count / curBookings.length) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Staff + Peak days + AI performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* Staff performance */}
        <div className="bg-white dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2">
              <UserCheck size={16} className="text-[#2B6CB0] dark:text-cyan-400" />{t.byStaff}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{t.byStaffSub}</p>
          </div>
          <div className="flex flex-col gap-3.5">
            {staffPerf.length === 0 ? (
              <div className="text-slate-400 text-xs text-center py-6">{t.noData}</div>
            ) : staffPerf.map((s, i) => (
              <HBar key={i} label={s.name} value={s.count} max={maxStaff} color={s.color} />
            ))}
          </div>
        </div>

        {/* Peak days */}
        <div className="bg-white dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2">
              <Clock size={16} className="text-[#2B6CB0] dark:text-cyan-400" />{t.peakDays}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{t.peakDaysSub}</p>
          </div>
          <div className="flex items-end justify-between gap-1.5 flex-1 min-h-[150px] pt-2">
            {peakDays.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full flex items-end justify-center flex-1">
                  <div className="w-full max-w-[26px] rounded-t-md bg-gradient-to-t from-[#2B6CB0] to-[#A2D9E8] transition-all duration-700"
                    style={{ height: `${Math.max(6, (d.count / maxPeak) * 120)}px` }} title={`${d.count}`} />
                </div>
                <span className="text-[10px] text-slate-400 font-bold">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI / Chat performance */}
        <div className="bg-white dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(26,54,93,0.02)] flex flex-col md:col-span-2 xl:col-span-1">
          <h3 className="text-sm font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2 mb-4">
            <Bot size={16} className="text-[#2B6CB0] dark:text-cyan-400" />{t.aiPerf}
            {chat.demo && (
              <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                {t.demoBadge}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-5">
            <DonutChart
              segments={[
                { value: chat.total - chat.escalated, color: '#38A169' },
                { value: chat.escalated, color: '#D97706' }
              ]}
              centerLabel={`${resolutionRate}%`}
            />
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-300 font-medium flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#38A169]" />{t.resolved}
                </span>
                <span className="font-extrabold text-[#1A365D] dark:text-white">{chat.total - chat.escalated}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-300 font-medium flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />{t.escalated}
                </span>
                <span className="font-extrabold text-[#1A365D] dark:text-white">{chat.escalated}</span>
              </div>
              <div className="border-t border-slate-100 dark:border-white/5 pt-3 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <MessageSquare size={13} />{t.totalSessions}
                </span>
                <span className="font-extrabold text-[#1A365D] dark:text-white">{chat.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Revenue by service */}
      <div className="bg-white dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(26,54,93,0.02)]">
        <h3 className="text-sm font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2 mb-5">
          <TrendingUp size={16} className="text-[#2B6CB0] dark:text-cyan-400" />{t.revenueByService}
        </h3>
        {revenueByService.length === 0 ? (
          <div className="text-slate-400 text-xs text-center py-6">{t.noData}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
            {revenueByService.map((r, i) => (
              <HBar key={i} label={r.name} value={r.amount} display={`฿${r.amount.toLocaleString('th-TH')}`}
                max={maxRev} color={r.color} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default AnalyticsPage;
