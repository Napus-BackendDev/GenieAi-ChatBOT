import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Bell, Search } from 'lucide-react';
import AuthPage from './pages/AuthPage';
import OnboardingUpload from './pages/OnboardingUpload';
import Sidebar from './components/Sidebar';
import DashboardOverview from './pages/DashboardOverview';
import AnalyticsPage from './pages/AnalyticsPage';
import ServicePage from './pages/ServicePage';
import StaffManager from './pages/StaffManager';
import BookingsManager from './pages/BookingsManager';
import ChatSandbox from './pages/ChatSandbox';
import LineChatManager from './pages/LineChatManager';
import Homepage from './pages/Homepage';
import SettingsPage from './pages/SettingsPage';

function App() {
  const [user, setUser] = useState(null);
  const [onboardingState, setOnboardingState] = useState('home'); // 'home', 'auth', 'onboard_upload', 'dashboard'
  const [authInitialTab, setAuthInitialTab] = useState('login');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('genie_ai_theme');
    if (!saved || saved === 'default') return 'light';
    return saved;
  });
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('genie_ai_lang') || 'th';
  });

  const [globalSearch, setGlobalSearch] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasIntervention, setHasIntervention] = useState(false);
  // Ref (not state) so updating the flagged-session list never re-triggers the
  // polling effect — otherwise a new array each poll caused an infinite fetch loop.
  const flaggedRef = useRef([]);
  // True when the tenant has not yet completed the Info step (no saved profile company_name)
  const [isNewUser, setIsNewUser] = useState(false);

  const [notifications, setNotifications] = useState([]);

  // Poll active chat sessions to detect human intervention requests
  useEffect(() => {
    if (!user || onboardingState !== 'dashboard') return;
    
    const checkIntervention = async () => {
      try {
        const res = await fetch(`/api/chat/sessions?tenant_id=${user.tenant_id}`);
        if (res.ok) {
          const sessionsList = await res.json();
          const needsHelp = sessionsList.some(s => s.requires_human);
          
          const newFlaggedIds = sessionsList.filter(s => s.requires_human).map(s => s.id);
          const newlyAdded = newFlaggedIds.filter(id => !flaggedRef.current.includes(id));
          
          if (newlyAdded.length > 0) {
            const newNotifications = newlyAdded.map(id => {
              const session = sessionsList.find(s => s.id === id);
              const name = session?.name || (lang === 'en' ? "LINE Customer" : "ลูกค้า LINE");
              return {
                id: `intervention-${id}-${Date.now()}`,
                titleTh: "⚠️ ลูกค้าต้องการผู้ดูแลตอบกลับ",
                titleEn: "⚠️ Human Agent Required",
                descTh: `AI ส่งต่อแชทของ ${name} เนื่องจากคำถามอยู่นอกคู่มือความรู้`,
                descEn: `AI transferred chat from ${name} because the query is outside the knowledge base.`,
                timeTh: "เมื่อสักครู่",
                timeEn: "Just now",
                unread: true
              };
            });
            setNotifications(prev => [...newNotifications, ...prev]);
          }
          
          flaggedRef.current = newFlaggedIds;
          setHasIntervention(needsHelp);
        }
      } catch (err) {
        console.error("Failed to check intervention status:", err);
      }
    };

    checkIntervention();
    const interval = setInterval(checkIntervention, 8000);
    return () => clearInterval(interval);
  }, [user, onboardingState, lang]);

  useEffect(() => {
    setGlobalSearch('');
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('genie_ai_lang', lang);
  }, [lang]);

  // Sync URL hash with active dashboard tab to maintain clean and bookmarkable URLs
  useEffect(() => {
    if (onboardingState === 'dashboard') {
      window.history.replaceState(null, '', `#${activeTab}`);
    } else if (onboardingState === 'auth') {
      const hash = authInitialTab === 'signup' ? '#register' : '#login';
      window.history.replaceState(null, '', hash);
    } else if (onboardingState === 'home') {
      window.history.replaceState(null, '', window.location.hash === '#home' ? '#home' : window.location.pathname);
    } else if (window.location.hash && !['#login', '#register', '#home'].includes(window.location.hash)) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [activeTab, onboardingState, authInitialTab]);

  // Read URL hash on load/hashchange to restore the correct active tab/page
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['overview', 'analytics', 'service', 'info', 'promotions', 'faq', 'staff', 'bookings', 'chat', 'sandbox', 'settings'];
      
      if (hash === 'login') {
        setOnboardingState('auth');
        setAuthInitialTab('login');
      } else if (hash === 'register' || hash === 'signup') {
        setOnboardingState('auth');
        setAuthInitialTab('signup');
      } else if (hash === 'home' || !hash) {
        setOnboardingState('home');
      } else if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);


  // Sync theme class with HTML document root for Tailwind v4 and HeroUI
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem('genie_ai_theme', theme);
  }, [theme]);

  // Check if session exists in localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('genie_ai_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      checkUserOnboardingStatus(parsedUser);
    } else {
      setLoading(false);
    }
  }, []);

  // Safe JSON fetch: tolerates an empty body or a backend that is briefly down,
  // returning `fallback` instead of throwing, so onboarding routing never crashes.
  const fetchJsonSafe = async (url, fallback) => {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok || !text) return fallback;
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  };

  const checkUserOnboardingStatus = async (currentUser) => {
    try {
      const docs = await fetchJsonSafe(`/api/documents?tenant_id=${currentUser.tenant_id}`, []);
      const profile = await fetchJsonSafe(`/api/tenant/profile/${currentUser.tenant_id}`, {});

      const docsList = Array.isArray(docs) ? docs : [];
      const hasProfile = Boolean(profile && profile.company_name);

      // The Info step is complete only once a company_name is saved in the profile.
      // (The profile GET no longer returns any secret token fields — line_configured/facebook_configured only.)
      setIsNewUser(!hasProfile);

      if (hasProfile) {
        const updatedUser = {
          ...currentUser,
          company_name: profile.company_name
        };
        const lowerName = profile.company_name.toLowerCase();
        if (lowerName.includes('clinic') || lowerName.includes('ทันตกรรม') || lowerName.includes('ฟัน') || lowerName.includes('แพทย์')) {
          updatedUser.business_type = lang === 'th' ? 'คลินิกทันตกรรม' : 'Dental Clinic';
        } else if (lowerName.includes('ยา') || lowerName.includes('pharmacy') || lowerName.includes('drug')) {
          updatedUser.business_type = lang === 'th' ? 'ร้านขายยา' : 'Pharmacy';
        }
        setUser(updatedUser);
        localStorage.setItem('genie_ai_user', JSON.stringify(updatedUser));
      }

      if (docsList.length === 0 || !hasProfile) {
        setOnboardingState('onboard_upload');
      } else {
        setOnboardingState('dashboard');
      }
    } catch (e) {
      console.error("Error verifying onboarding state:", e);
      setOnboardingState('dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (authenticatedUser) => {
    // Persist the JWT (covers both credentials and Google paths, which both
    // reach here). The global fetch wrapper reads it from localStorage.
    if (authenticatedUser?.access_token) {
      localStorage.setItem('genie_ai_token', authenticatedUser.access_token);
    }
    setUser(authenticatedUser);
    localStorage.setItem('genie_ai_user', JSON.stringify(authenticatedUser));
    setLoading(true);
    checkUserOnboardingStatus(authenticatedUser);
  };

  const handleOnboardingComplete = () => {
    if (user) {
      setLoading(true);
      checkUserOnboardingStatus(user);
    } else {
      setOnboardingState('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('genie_ai_user');
    localStorage.removeItem('genie_ai_token');
    setUser(null);
    setOnboardingState('auth');
    setActiveTab('overview');
  };

  const triggerReupload = () => {
    setOnboardingState('onboard_upload');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted font-sans bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <h2 className="text-[#1A365D] dark:text-white mb-2 text-xl font-bold">กำลังเตรียมระบบแดชบอร์ด...</h2>
          <p className="text-slate-400 text-sm">กรุณารอสักครู่</p>
        </div>
      </div>
    );
  }

  // Render Homepage
  if (onboardingState === 'home') {
    return (
      <Homepage
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        onNavigateToAuth={(tab) => {
          setAuthInitialTab(tab);
          setOnboardingState('auth');
        }}
      />
    );
  }

  // Render Auth Page
  if (onboardingState === 'auth') {
    return (
      <div className="text-foreground bg-background">
        <AuthPage 
          lang={lang} 
          setLang={setLang} 
          onAuthSuccess={handleAuthSuccess} 
          initialTab={authInitialTab}
          onNavigateHome={() => setOnboardingState('home')}
          onTabChange={(tab) => setAuthInitialTab(tab)}
        />
      </div>
    );
  }

  // Render Onboarding Uploader
  if (onboardingState === 'onboard_upload') {
    return (
      <div className="text-foreground bg-background">
        <OnboardingUpload
          tenantId={user?.tenant_id}
          user={user}
          lang={lang}
          isNew={isNewUser}
          onOnboardingComplete={handleOnboardingComplete}
        />
      </div>
    );
  }

  // Render Main Admin Dashboard
  const tabNames = {
    th: {
      overview: 'แดชบอร์ด',
      analytics: 'วิเคราะห์ข้อมูล',
      service: 'บริการ',
      info: 'ข้อมูลร้านค้า',
      promotions: 'โปรโมชัน',
      faq: 'คำถามพบบ่อย',
      staff: 'บุคลากร',
      bookings: 'การนัดหมาย',
      chat: 'แชท',
      sandbox: 'กล่องทดสอบแชต',
      settings: 'ตั้งค่า'
    },
    en: {
      overview: 'Dashboard',
      analytics: 'Analytics',
      service: 'Service List',
      info: 'Information',
      promotions: 'Promotion',
      faq: 'FAQ',
      staff: 'Staff',
      bookings: 'Appointments',
      chat: 'Chat',
      sandbox: 'Chat Sandbox',
      settings: 'Settings'
    }
  }[lang];

  return (
    <div 
      className="admin-layout text-foreground bg-white dark:bg-slate-950 transition-all duration-300"
      style={{ gridTemplateColumns: isSidebarCollapsed ? '80px 1fr' : '260px 1fr' }}
    >
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        lang={lang}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        hasIntervention={hasIntervention}
      />


      {/* App Container (Top bar + main scrollable content area) */}
      <div className="app-container flex-1">
        
        {/* Top Header Bar */}
        <header className="top-bar bg-white dark:bg-slate-900 border-[#A2D9E8]/20 dark:border-white/5">
          {/* Left: Page Title */}
          <h1 className="text-xl font-extrabold text-[#1A365D] dark:text-white">
            {tabNames[activeTab] || 'Dashboard'}
          </h1>
          
          {/* Middle: Search Pill Bar */}
          <div className="hidden md:flex items-center w-[320px] h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-white/10 rounded-full px-3.5 gap-2 focus-within:border-[#2B6CB0] transition-colors">
            <Search size={15} className="text-[#1A365D]/40 dark:text-slate-400" />
            <input
              type="text"
              placeholder={lang === 'th' ? 'ค้นหา...' : 'Search...'}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="bg-transparent text-xs text-[#1A365D] dark:text-white placeholder:text-slate-400 outline-none w-full"
            />
          </div>
          
          {/* Right: Controls & Profile */}
          <div className="flex items-center gap-4">
            
            {/* Language Switcher Button */}
            <button
              onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
              className="px-2.5 py-1 rounded-xl border border-[#A2D9E8]/35 dark:border-white/10 text-xs font-bold text-[#1A365D]/75 dark:text-slate-300 hover:text-[#2B6CB0] dark:hover:text-cyan-400 hover:bg-[#E6F4F8]/40 dark:hover:bg-slate-800/50 transition-all duration-300 cursor-pointer"
              title={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
            >
              {lang === 'th' ? 'EN' : 'TH'}
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-[#1A365D]/70 dark:text-slate-400 hover:text-[#2B6CB0] transition-colors cursor-pointer"
              title={lang === 'th' ? 'สลับโหมดสี' : 'Toggle Theme'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-[#1A365D]/70 dark:text-slate-400 hover:text-[#2B6CB0] transition-colors cursor-pointer"
              >
                <Bell size={18} />
              </button>
              {/* Notification red dot accent #E53E3E */}
              {notifications.some(n => n.unread) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E53E3E] ring-1 ring-white"></span>
              )}

              {/* Glassmorphic Dropdown Panel */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3 text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5">
                    <h4 className="text-xs font-bold text-[#1A365D] dark:text-white">
                      {lang === 'th' ? 'การแจ้งเตือน' : 'Notifications'}
                    </h4>
                    {notifications.some(n => n.unread) && (
                      <button 
                        onClick={() => setNotifications(notifications.map(n => ({...n, unread: false})))}
                        className="text-[10px] font-bold text-[#2B6CB0] dark:text-cyan-400 hover:underline cursor-pointer"
                      >
                        {lang === 'th' ? 'อ่านทั้งหมด' : 'Mark all read'}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <div className="text-center text-xs text-slate-400 py-6">
                        {lang === 'th' ? 'ไม่มีการแจ้งเตือนใหม่' : 'No new notifications'}
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => setNotifications(notifications.map(item => item.id === n.id ? {...item, unread: false} : item))}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                            n.unread 
                              ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-white/5 font-semibold' 
                              : 'bg-transparent border-transparent hover:bg-slate-50/50 dark:hover:bg-slate-800/10'
                          }`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className={`text-[11px] font-bold ${n.unread ? 'text-[#1A365D] dark:text-white' : 'text-slate-400'}`}>
                              {lang === 'th' ? n.titleTh : n.titleEn}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium">{lang === 'th' ? n.timeTh : n.timeEn}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                            {lang === 'th' ? n.descTh : n.descEn}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* User Profile Avatar block */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200/80 dark:border-white/10">
              {user?.picture ? (
                <img 
                  src={user.picture} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full object-cover border border-[#A2D9E8]/30 dark:border-white/15"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#E6F4F8] dark:bg-slate-800 text-[#1A365D] dark:text-cyan-400 font-extrabold flex items-center justify-center text-xs border border-[#A2D9E8]/30 dark:border-white/15">
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : (user?.company_name ? user.company_name.substring(0, 2).toUpperCase() : 'AD')}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-[#1A365D] dark:text-white leading-tight">
                  {user?.name || user?.company_name || 'Owner'}
                </p>
                <p className="text-[9px] text-[#2B6CB0] dark:text-cyan-500 font-bold">
                  Administrator
                </p>
              </div>
            </div>
            
          </div>
        </header>

        {/* Main Content Area */}
        <main className="main-content flex-1 bg-slate-50/50 dark:bg-slate-950/20 overflow-y-auto">
          {activeTab === 'overview' && (
            <DashboardOverview tenantId={user?.tenant_id} user={user} lang={lang} setActiveTab={setActiveTab} />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsPage tenantId={user?.tenant_id} user={user} lang={lang} />
          )}
          
          {(activeTab === 'service' || activeTab === 'info' || activeTab === 'promotions' || activeTab === 'faq') && (
            <ServicePage 
              activeTab={activeTab} 
              tenantId={user?.tenant_id} 
              triggerReupload={triggerReupload} 
              lang={lang} 
              onProfileUpdate={(updatedProfile) => {
                if (updatedProfile && updatedProfile.company_name) {
                  const updatedUser = {
                    ...user,
                    company_name: updatedProfile.company_name
                  };
                  const lowerName = updatedProfile.company_name.toLowerCase();
                  if (lowerName.includes('clinic') || lowerName.includes('ทันตกรรม') || lowerName.includes('ฟัน') || lowerName.includes('แพทย์')) {
                    updatedUser.business_type = lang === 'th' ? 'คลินิกทันตกรรม' : 'Dental Clinic';
                  } else if (lowerName.includes('ยา') || lowerName.includes('pharmacy') || lowerName.includes('drug')) {
                    updatedUser.business_type = lang === 'th' ? 'ร้านขายยา' : 'Pharmacy';
                  }
                  setUser(updatedUser);
                  localStorage.setItem('genie_ai_user', JSON.stringify(updatedUser));
                }
              }}
            />
          )}

          {activeTab === 'staff' && (
            <StaffManager tenantId={user?.tenant_id} lang={lang} globalSearch={globalSearch} />
          )}
          
          {activeTab === 'bookings' && (
            <BookingsManager tenantId={user?.tenant_id} lang={lang} globalSearch={globalSearch} />
          )}

          {activeTab === 'chat' && (
            <LineChatManager tenantId={user?.tenant_id} lang={lang} />
          )}
          
          {activeTab === 'sandbox' && (
            <ChatSandbox tenantId={user?.tenant_id} user={user} lang={lang} />
          )}

          {activeTab === 'settings' && (
            <SettingsPage tenantId={user?.tenant_id} lang={lang} />
          )}
        </main>
        
      </div>
    </div>
  );
}

export default App;
