import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Sun, Moon, Bell, Search, Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { InputGroup } from '@heroui/react';
import {
  installTenantContextInterceptor,
  broadcastSessionEvent,
  subscribeToSessionEvents,
  clearTenantMemory,
  setTenantContext,
} from './lib/sessionSync';
import { parseApiJson } from './lib/apiResponse';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const OnboardingUpload = lazy(() => import('./pages/OnboardingUpload'));
const DashboardOverview = lazy(() => import('./pages/DashboardOverview'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ServicePage = lazy(() => import('./pages/ServicePage'));
const StaffManager = lazy(() => import('./pages/StaffManager'));
const BookingsManager = lazy(() => import('./pages/BookingsManager'));
const ChatSandbox = lazy(() => import('./pages/ChatSandbox'));
const LineChatManager = lazy(() => import('./pages/LineChatManager'));
const Homepage = lazy(() => import('./pages/Homepage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));

const PageFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-slate-500">
    Loading...
  </div>
);

const readAuthValue = (key) => localStorage.getItem(key) || sessionStorage.getItem(key);
const authStorage = () => (
  localStorage.getItem('genie_ai_user')
    ? localStorage
    : sessionStorage
);
const clearAuth = () => {
  ['genie_ai_user', 'genie_ai_token'].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

function App() {
  const [user, setUser] = useState(null);
  const [onboardingState, setOnboardingState] = useState('home'); // 'home', 'auth', 'onboard_upload', 'dashboard'
  const [authInitialTab, setAuthInitialTab] = useState('login');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const mobileMenuButtonRef = useRef(null);
  const [hasIntervention, setHasIntervention] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  // Ref (not state) so updating the flagged-session list never re-triggers the
  // polling effect — otherwise a new array each poll caused an infinite fetch loop.
  const flaggedRef = useRef([]);
  // True when the tenant has not yet completed the Info step (no saved profile company_name)
  const [isNewUser, setIsNewUser] = useState(false);

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsMobileSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobile && isMobileSidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, isMobileSidebarOpen]);

  useEffect(() => {
    // Close the drawer when the page changes. Depending on isMobileSidebarOpen here would close it the instant it opens.
    setIsMobileSidebarOpen(false);
  }, [activeTab]);

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
          const totalUnread = sessionsList.reduce((acc, s) => acc + (s.unread || 0), 0);
          setHasUnread(totalUnread > 0);
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

  // Sync URL pathname with active state to maintain clean and bookmarkable URLs
  useEffect(() => {
    if (loading) return;
    let path = '/';
    if (onboardingState === 'dashboard') {
      path = `/${activeTab}`;
    } else if (onboardingState === 'auth') {
      path = authInitialTab === 'signup' ? '/register' : '/login';
    } else if (onboardingState === 'home') {
      path = '/';
    } else if (onboardingState === 'onboard_upload') {
      path = '/onboarding';
    }
    
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, [activeTab, onboardingState, authInitialTab, loading]);

  // Read URL pathname on load/popstate to restore the correct active tab/page
  useEffect(() => {
    const handlePathChange = () => {
      const path = window.location.pathname.replace(/^\//, ''); // remove leading slash
      const validTabs = ['overview', 'analytics', 'service', 'info', 'promotions', 'faq', 'staff', 'bookings', 'chat', 'sandbox', 'settings', 'support'];
      
      if (path === 'login') {
        setOnboardingState('auth');
        setAuthInitialTab('login');
      } else if (path === 'register' || path === 'signup') {
        setOnboardingState('auth');
        setAuthInitialTab('signup');
      } else if (path === 'onboarding') {
        const savedUser = readAuthValue('genie_ai_user');
        if (savedUser) {
          setOnboardingState('onboard_upload');
        } else {
          setOnboardingState('auth');
          setAuthInitialTab('login');
        }
      } else if (path === 'home' || !path) {
        setOnboardingState('home');
      } else if (path && validTabs.includes(path)) {
        if (readAuthValue('genie_ai_user')) {
          setActiveTab(path);
        } else {
          setOnboardingState('auth');
          setAuthInitialTab('login');
        }
      }
    };

    handlePathChange();
    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
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

  const applyProfileToUser = (currentUser, profile) => {
    if (!currentUser || !profile?.company_name) return currentUser;
    const updatedUser = {
      ...currentUser,
      company_name: profile.company_name,
      business_type: profile.business_type || currentUser.business_type
    };
    const lowerName = profile.company_name.toLowerCase();
    if (!updatedUser.business_type && (lowerName.includes('clinic') || lowerName.includes('ทันตกรรม') || lowerName.includes('ฟัน') || lowerName.includes('แพทย์'))) {
      updatedUser.business_type = lang === 'th' ? 'คลินิกทันตกรรม' : 'Dental Clinic';
    } else if (!updatedUser.business_type && (lowerName.includes('ยา') || lowerName.includes('pharmacy') || lowerName.includes('drug'))) {
      updatedUser.business_type = lang === 'th' ? 'ร้านขายยา' : 'Pharmacy';
    }
    setUser(updatedUser);
    authStorage().setItem('genie_ai_user', JSON.stringify(updatedUser));
    return updatedUser;
  };

  const checkUserOnboardingStatus = async (currentUser) => {
    // If the path is '/' (empty path) or 'home', stay on home and do not redirect
    const path = window.location.pathname.replace(/^\//, '');
    if (path === 'home' || !path) {
      setOnboardingState('home');
      setLoading(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      let res;
      try {
        res = await fetch(`/api/tenant/profile/${currentUser.tenant_id}`, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        if (res.status === 404) {
          setIsNewUser(true);
          setOnboardingState('onboard_upload');
          setLoading(false);
          return;
        }
        console.warn(`Profile load returned HTTP ${res.status}; service unavailable.`);
        setServiceUnavailable(true);
        setLoading(false);
        return;
      }

      const profile = await parseApiJson(res, 'Profile unavailable');
      const onboardingDone = Boolean(profile.onboarding_completed || profile.company_name);

      setIsNewUser(!onboardingDone);

      if (profile && profile.company_name) {
        applyProfileToUser(currentUser, profile);
      }

      if (!onboardingDone) {
        setOnboardingState('onboard_upload');
      } else {
        setOnboardingState('dashboard');
        if (path === 'onboarding') {
          window.history.pushState(null, '', '/overview');
          setActiveTab('overview');
        }
      }
    } catch (e) {
      console.error("Error verifying onboarding state:", e);
      setServiceUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  const restoreSession = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      let res;
      try {
        res = await fetch('/api/auth/session', { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (res.ok) {
        const serverUser = await parseApiJson(res, 'Session unavailable');
        if (serverUser?.tenant_id) {
          setUser(serverUser);
          setTenantContext(serverUser.tenant_id);
          authStorage().setItem('genie_ai_user', JSON.stringify(serverUser));
          setServiceUnavailable(false);
          checkUserOnboardingStatus(serverUser);
          return;
        }
      } else if (res.status === 401) {
        // Explicit 401: clear local state and return to auth
        clearAuth();
        clearTenantMemory();
        setUser(null);
        setServiceUnavailable(false);
        setLoading(false);
        return;
      } else if (res.status === 503) {
        console.warn("Auth session returned 503; backend unavailable.");
        setServiceUnavailable(true);
        setLoading(false);
        return;
      } else {
        setServiceUnavailable(true);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("Failed to reach /api/auth/session or parse response:", err);
      setServiceUnavailable(true);
      setLoading(false);
      return;
    }

    clearAuth();
    clearTenantMemory();
    setUser(null);
    setServiceUnavailable(false);
    setLoading(false);
  };

  // Restore session on mount and listen to cross-tab auth events
  useEffect(() => {
    installTenantContextInterceptor(() => {
      restoreSession();
    });

    const unsubscribe = subscribeToSessionEvents((evt) => {
      if (evt.type === 'LOGOUT') {
        clearAuth();
        clearTenantMemory();
        setUser(null);
        setOnboardingState('auth');
      } else if (evt.type === 'LOGIN' || evt.type === 'TENANT_CHANGED') {
        restoreSession();
      }
    });

    restoreSession();
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-redirect logged-in users away from auth screen to dashboard or onboarding.
  useEffect(() => {
    if (user && onboardingState === 'auth') {
      checkUserOnboardingStatus(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, onboardingState]);

  const handleAuthSuccess = (authenticatedUser, keepLoggedIn = true) => {
    clearAuth();
    const storage = keepLoggedIn ? localStorage : sessionStorage;
    setUser(authenticatedUser);
    setTenantContext(authenticatedUser.tenant_id);
    storage.setItem('genie_ai_user', JSON.stringify(authenticatedUser));
    broadcastSessionEvent('LOGIN', { tenant_id: authenticatedUser.tenant_id });
    setLoading(true);
    checkUserOnboardingStatus(authenticatedUser);
  };

  const handleOnboardingComplete = (profile) => {
    if (profile?.company_name) {
      applyProfileToUser(user, profile);
    } else if (user?.tenant_id) {
      fetchJsonSafe(`/api/tenant/profile/${user.tenant_id}`, null)
        .then((savedProfile) => applyProfileToUser(user, savedProfile));
    }
    window.history.pushState(null, '', '/overview');
    setOnboardingState('dashboard');
    setActiveTab('overview');
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok && res.status !== 401) {
        console.warn("Logout token revocation failed on server:", res.status);
      }
    } catch (err) {
      console.warn("Logout error:", err);
    }
    clearAuth();
    clearTenantMemory();
    broadcastSessionEvent('LOGOUT');
    setUser(null);
    setOnboardingState('auth');
    setActiveTab('overview');
  };

  const triggerReupload = () => {
    setOnboardingState('onboard_upload');
  };

  if (serviceUnavailable) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full text-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-amber-500/20 shadow-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center text-3xl">
            ⚠️
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
            {lang === 'th' ? 'ระบบไม่พร้อมใช้งานชั่วคราว' : 'Service Temporarily Unavailable'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            {lang === 'th'
              ? 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ในขณะนี้ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง'
              : 'Unable to connect to the server right now. Please wait a moment and try again.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setServiceUnavailable(false);
              restoreSession();
            }}
            className="w-full h-11 px-6 font-bold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 transition-opacity cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            {lang === 'th' ? 'ลองใหม่อีกครั้ง' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

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
      <Suspense fallback={<PageFallback />}>
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
      </Suspense>
    );
  }

  // Render Auth Page
  if (onboardingState === 'auth') {
    return (
      <div className="text-foreground bg-background">
        <Suspense fallback={<PageFallback />}>
          <AuthPage
            lang={lang}
            setLang={setLang}
            onAuthSuccess={handleAuthSuccess}
            initialTab={authInitialTab}
            onNavigateHome={() => setOnboardingState('home')}
            onTabChange={(tab) => setAuthInitialTab(tab)}
          />
        </Suspense>
      </div>
    );
  }

  // Render Onboarding Uploader
  if (onboardingState === 'onboard_upload') {
    return (
      <div className="text-foreground bg-background">
        <Suspense fallback={<PageFallback />}>
          <OnboardingUpload
            tenantId={user?.tenant_id}
            user={user}
            lang={lang}
            isNew={isNewUser}
            onOnboardingComplete={handleOnboardingComplete}
          />
        </Suspense>
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
      settings: 'ตั้งค่า',
      support: 'ช่วยเหลือ'
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
      settings: 'Settings',
      support: 'Support'
    }
  }[lang];

  return (
    <div 
      className="admin-layout text-foreground bg-white dark:bg-slate-950 transition-all duration-300"
      style={{ gridTemplateColumns: isMobile ? '1fr' : (isSidebarCollapsed ? '80px 1fr' : '260px 1fr') }}
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
        hasUnread={hasUnread}
        isMobile={isMobile}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        mobileMenuButtonRef={mobileMenuButtonRef}
      />


      {/* App Container (Top bar + main scrollable content area) */}
      <div className="app-container flex-1">
        
        {/* Top Header Bar */}
        <header className="top-bar bg-white dark:bg-slate-900 border-[#A2D9E8]/20 dark:border-white/5">
          {isMobile && (
            <button
              type="button"
              aria-label={lang === 'th' ? 'เปิดเมนู' : 'Open menu'}
              aria-controls="admin-sidebar"
              aria-expanded={isMobileSidebarOpen}
              ref={mobileMenuButtonRef}
              onClick={() => setIsMobileSidebarOpen(true)}
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-[#1A365D] dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu size={20} />
            </button>
          )}
          {/* Left: Page Title */}
          <h1 className="text-xl font-extrabold text-[#1A365D] dark:text-white">
            {tabNames[activeTab] || 'Dashboard'}
          </h1>
          
          {/* Middle: Search appears only where globalSearch is consumed. */}
          {['staff', 'bookings'].includes(activeTab) && (
            <div className="hidden md:flex items-center w-[320px]">
              <InputGroup className="w-full">
                <InputGroup.Prefix>
                  <Search size={15} className="text-[#1A365D]/40 dark:text-slate-400" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  type="search"
                  aria-label={lang === 'th' ? 'ค้นหา' : 'Search'}
                  placeholder={lang === 'th' ? 'ค้นหา...' : 'Search...'}
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                />
              </InputGroup>
            </div>
          )}
          
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
          <Suspense fallback={<PageFallback />}>
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
                applyProfileToUser(user, updatedProfile);
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
            <SettingsPage tenantId={user?.tenant_id} lang={lang} onLogout={handleLogout} />
          )}

          {activeTab === 'support' && (
            <SupportPage lang={lang} setActiveTab={setActiveTab} />
          )}
          </Suspense>
        </main>
        
      </div>
    </div>
  );
}

export default App;
