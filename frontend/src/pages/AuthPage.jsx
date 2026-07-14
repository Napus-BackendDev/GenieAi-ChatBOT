import { useState, useEffect, useRef } from 'react';
import { Mail, Lock, ArrowRight, Store, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@heroui/react';

const translations = {
  th: {
    welcomeBack: "ยินดีต้อนรับกลับมา",
    createAccount: "สร้างบัญชีผู้ใช้",
    loginSub: "ยินดีต้อนรับเข้าสู่ระบบจัดการเลขา AI อัจฉริยะประจำร้าน",
    signupSub: "เริ่มต้นสร้างระบบผู้ช่วยจัดการธุรกิจอัจฉริยะของคุณ",
    emailLabel: "อีเมลแอดเดรส (Email Address)",
    passwordLabel: "รหัสผ่าน (Password)",
    passwordPlaceholder: "กรอกรหัสผ่านของคุณ",
    keepLoggedIn: "อยู่ในระบบตลอดเวลา",
    forgotPassword: "ลืมรหัสผ่าน?",
    loginBtn: "เข้าสู่ระบบ",
    signupBtn: "สมัครสมาชิก",
    noAccount: "ยังไม่มีบัญชีผู้ใช้?",
    haveAccount: "มีบัญชีผู้ใช้แล้ว?",
    orEmailLogin: "หรือเข้าสู่ระบบด้วยอีเมล",
    orEmailSignup: "หรือสมัครสมาชิกด้วยอีเมล",
    academyTitle: "สถาบันการเรียนรู้ GenieAI",
    academyDesc: "เราเตรียมความรู้และตัวช่วยเพื่อให้ธุรกิจของคุณเติบโตได้เร็วขึ้น แม้ขณะอยู่นอกออฟฟิศ",
    startAcademy: "ดูวิธีเริ่มต้นใช้งาน",
    aiSaaS: "ระบบผู้ช่วย AI สำหรับธุรกิจ",
    aiDesc: "ช่วยจัดการคิวจอง บริการ และความรู้ของร้านคุณด้วยผู้ช่วย AI อัจฉริยะ เชื่อมต่อ LINE ได้ในไม่กี่นาที ตอบลูกค้าแทนคุณได้ตลอด 24 ชั่วโมง",
    mockLoginNotice: "* ตัวเลือกเข้าระบบแบบจำลองสำหรับนักพัฒนา"
  },
  en: {
    welcomeBack: "Welcome Back",
    createAccount: "Create Account",
    loginSub: "Welcome back to your smart shop AI assistant manager dashboard",
    signupSub: "Get started by creating your intelligent business assistant",
    emailLabel: "Email Address",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    keepLoggedIn: "Keep me logged in",
    forgotPassword: "Forgot your password?",
    loginBtn: "Log In",
    signupBtn: "Sign Up",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    orEmailLogin: "OR LOGIN WITH EMAIL",
    orEmailSignup: "OR SIGN UP WITH EMAIL",
    academyTitle: "GenieAI Academy",
    academyDesc: "We prepare tools and knowledge to grow your business faster, even when you're out of office.",
    startAcademy: "See how to get started",
    aiSaaS: "AI-Driven SaaS Assistant",
    aiDesc: "Streamline appointments, services, and store knowledge with a smart AI assistant. Connect LINE in minutes to answer your customers around the clock.",
    mockLoginNotice: "* developer mock login fallback"
  }
};

const AuthPage = ({ lang, setLang, onAuthSuccess, initialTab = 'login', onNavigateHome, onTabChange }) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState(initialTab); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const googleBtnRef = useRef(null);
  
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (onTabChange) {
      onTabChange(activeTab);
    }
  }, [activeTab]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'credentials',
          email: email.trim(),
          password: password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }

      // Whether the account is new or returning, App decides routing:
      // new tenants (no saved profile) are sent into the onboarding wizard,
      // which collects company/business info in its Info step.
      onAuthSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLoginResponse = async (googleRes) => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: 'google',
          token: googleRes.credential
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Google Auth Failed');
      }

      // Pass the provider's account straight through (do NOT inject a mock
      // email/phone). App routes new tenants into the wizard, which collects
      // any missing phone in its Info step.
      onAuthSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.google) {
      setSdkLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setSdkLoaded(true);
    };
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (sdkLoaded && window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '35939223788-p8j1o73lkmikv13uoh8f2bep2cagmd9p.apps.googleusercontent.com',
        callback: handleGoogleLoginResponse
      });

      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(
          googleBtnRef.current,
          { 
            theme: 'outline', 
            size: 'large', 
            width: googleBtnRef.current.clientWidth || 420,
            text: activeTab === 'login' ? 'signin_with' : 'signup_with'
          }
        );
      }
    }
  }, [sdkLoaded, activeTab]);

  return (
    <div className="flex min-h-screen w-full items-stretch overflow-hidden bg-[#FFFFFF] transition-colors duration-300">
      
      {/* Left Column: Form Section (Background is always #FFFFFF) */}
      <div className="w-full lg:w-[48%] xl:w-[45%] flex flex-col justify-between p-8 md:p-12 lg:p-16 bg-[#FFFFFF]">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between w-full">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-all"
            onClick={onNavigateHome}
          >
            {/* Icon Wrapper: Background is #E6F4F8, icon/text is #1A365D */}
            <div className="bg-[#E6F4F8] rounded-xl w-10 h-10 flex items-center justify-center border border-[#A2D9E8]/35 text-[#1A365D] shadow-sm">
              <Store size={20} />
            </div>
            <div>
              {/* Title: #1A365D */}
              <h2 className="font-bold text-base leading-tight text-[#1A365D]">
                GenieAI
              </h2>
              {/* Sub: #2B6CB0 */}
              <span className="text-[10px] font-bold text-[#2B6CB0] tracking-wider uppercase">
                {t.aiSaaS}
              </span>
            </div>
          </div>

          {/* Language Switcher */}
          <Button
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            size="sm"
            variant="light"
            className="border border-[#A2D9E8]/30 hover:bg-[#E6F4F8] text-[#1A365D] font-bold rounded-lg cursor-pointer h-8 px-2.5 min-w-0"
          >
            {lang === 'th' ? 'EN' : 'TH'}
          </Button>
        </div>

        {/* Form Content Area */}
        <div className="my-auto py-8 max-w-[420px] w-full mx-auto">
          {/* Login / Sign Up State (store info is now collected in the onboarding wizard) */}
          <div className="animate-fade-in text-left">
              {/* Header: #1A365D */}
              <h1 className="text-4xl font-extrabold text-[#1A365D] tracking-tight mb-2">
                {activeTab === 'login' ? t.welcomeBack : t.createAccount}
              </h1>
              {/* Description: #2B6CB0 */}
              <p className="text-sm text-[#2B6CB0]/90 mb-8 leading-relaxed">
                {activeTab === 'login' ? t.loginSub : t.signupSub}
              </p>

              {error && (
                /* Red Accent Color #E53E3E for errors */
                <div className="bg-[#E53E3E]/10 border border-[#E53E3E]/20 text-[#E53E3E] rounded-xl p-3 text-sm mb-5 font-semibold">
                  {error}
                </div>
              )}

              {/* Google Button Container (loads official GSI iframe) */}
              <div className="w-full flex flex-col gap-2">
                <div ref={googleBtnRef} className="w-full min-h-[44px] flex justify-center"></div>
                <button
                  type="button"
                  onClick={() => handleGoogleLoginResponse({ credential: 'mock' })}
                  className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-[#2B6CB0] transition-colors cursor-pointer text-center block mt-1"
                >
                  {t.mockLoginNotice}
                </button>
              </div>

              {/* Separator: Lines border #1A365D/10, text #2B6CB0 */}
              <div className="flex items-center text-center my-6">
                <div className="flex-1 border-t border-[#1A365D]/10"></div>
                <span className="px-4 text-[10px] font-bold text-[#2B6CB0] uppercase tracking-widest">
                  {activeTab === 'login' ? t.orEmailLogin : t.orEmailSignup}
                </span>
                <div className="flex-1 border-t border-[#1A365D]/10"></div>
              </div>

              {/* Form inputs */}
              <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-xs font-semibold text-[#1A365D]">
                    {t.emailLabel}
                  </label>
                  <div className="flex w-full items-stretch rounded-xl border border-[#1A365D]/20 overflow-hidden bg-[#FFFFFF] focus-within:border-[#2B6CB0] transition-colors">
                    <div className="bg-[#E6F4F8] px-3.5 flex items-center justify-center text-[#1A365D] border-r border-[#1A365D]/10">
                      <Mail className="shrink-0" size={16} />
                    </div>
                    <input
                      type="email"
                      placeholder="owner@yourshop.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="flex-1 h-11 px-3 text-sm text-[#1A365D] placeholder:text-slate-400 bg-[#FFFFFF] outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-xs font-semibold text-[#1A365D]">
                    {t.passwordLabel}
                  </label>
                  <div className="flex w-full items-stretch rounded-xl border border-[#1A365D]/20 overflow-hidden bg-[#FFFFFF] focus-within:border-[#2B6CB0] transition-colors">
                    <div className="bg-[#E6F4F8] px-3.5 flex items-center justify-center text-[#1A365D] border-r border-[#1A365D]/10">
                      <Lock className="shrink-0" size={16} />
                    </div>
                    <input
                      type="password"
                      placeholder={t.passwordPlaceholder}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                      className="flex-1 h-11 px-3 text-sm text-[#1A365D] placeholder:text-slate-400 bg-[#FFFFFF] outline-none"
                    />
                  </div>
                </div>

                {activeTab === 'login' && (
                  <div className="flex items-center justify-between mt-1 text-xs">
                    {/* Checkbox accent: #2B6CB0, text #1A365D */}
                    <label className="flex items-center gap-2 text-[#1A365D]/80 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepLoggedIn}
                        onChange={(e) => setKeepLoggedIn(e.target.checked)}
                        className="w-4 h-4 rounded border-[#1A365D]/20 accent-[#2B6CB0] cursor-pointer"
                      />
                      <span>{t.keepLoggedIn}</span>
                    </label>
                    {/* Link: #2B6CB0 */}
                    <a href="#forgot" className="text-[#2B6CB0] hover:underline font-bold">
                      {t.forgotPassword}
                    </a>
                  </div>
                )}

                {/* Submit Button: bg #2B6CB0, hover bg #1A365D, text #FFFFFF */}
                <Button 
                  type="submit" 
                  color="primary" 
                  className="w-full font-bold h-11 mt-4 rounded-xl cursor-pointer bg-[#2B6CB0] hover:bg-[#1A365D] text-[#FFFFFF] shadow-md hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                  isLoading={loading}
                >
                  <span>{activeTab === 'login' ? t.loginBtn : t.signupBtn}</span>
                  {!loading && <ArrowRight size={16} />}
                </Button>
              </form>

              {/* Bottom Switch Link: text #1A365D, link #2B6CB0 */}
              <div className="text-center text-xs text-[#1A365D]/85 mt-8">
                {activeTab === 'login' ? (
                  <p>
                    {t.noAccount}{' '}
                    <button
                      onClick={() => { setActiveTab('signup'); setError(''); }}
                      className="text-[#2B6CB0] hover:text-[#1A365D] hover:underline font-bold cursor-pointer"
                    >
                      {t.signupBtn}
                    </button>
                  </p>
                ) : (
                  <p>
                    {t.haveAccount}{' '}
                    <button
                      onClick={() => { setActiveTab('login'); setError(''); }}
                      className="text-[#2B6CB0] hover:text-[#1A365D] hover:underline font-bold cursor-pointer"
                    >
                      {t.loginBtn}
                    </button>
                  </p>
                )}
              </div>
          </div>
        </div>

        {/* Footer info: text #1A365D/50 */}
        <div className="text-left text-[11px] text-[#1A365D]/55 font-medium">
          © {new Date().getFullYear()} GenieAI SaaS. All rights reserved.
        </div>
      </div>

      {/* Right Column: Visual Section (Soft Primary Color gradient: from #E6F4F8 to #A2D9E8) */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col justify-between p-12 bg-gradient-to-br from-[#E6F4F8] to-[#A2D9E8] border-l border-[#A2D9E8]/30 relative overflow-hidden transition-colors duration-300">
        
        {/* Sleeknote Academy Top Right Block */}
        <div className="flex flex-col items-end text-right self-end max-w-[280px]">
          {/* Badge: #1A365D text, icon #2B6CB0 */}
          <div className="flex items-center gap-2 text-[#1A365D] font-bold text-xs uppercase tracking-wider mb-1">
            <BookOpen size={14} className="text-[#2B6CB0]" />
            <span>{t.academyTitle}</span>
          </div>
          {/* Subtext: #1A365D/80 */}
          <p className="text-[11px] text-[#1A365D]/80 leading-relaxed mb-3 font-medium">
            {t.academyDesc}
          </p>
          {/* Outlined Button: border #1A365D, text #1A365D */}
          <a
            href="https://developers.line.biz/en/docs/messaging-api/getting-started/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold border border-[#1A365D] text-[#1A365D] px-3.5 py-1.5 rounded-lg hover:bg-[#1A365D]/5 transition-all uppercase tracking-wider"
          >
            {t.startAcademy}
          </a>
        </div>

        {/* Vector Cartoon Illustration Container */}
        <div className="my-auto flex flex-col items-center justify-center relative z-10 w-full max-w-[500px] mx-auto">
          
          {/* Subtle glowing backdrop elements using A2D9E8 / E6F4F8 blends */}
          <div className="absolute w-[280px] h-[280px] bg-[#A2D9E8]/30 rounded-full blur-3xl -top-12 -left-12 -z-10 animate-pulse"></div>
          <div className="absolute w-[280px] h-[280px] bg-[#FFFFFF]/40 rounded-full blur-3xl -bottom-12 -right-12 -z-10 animate-pulse"></div>

          {/* Floating Glassmorphic UI Card details around the vector (Bg is #FFFFFF, text is #1A365D) */}
          {/* Positioned in front (z-20) and overlapping boundaries */}
          <div className="absolute top-16 -left-8 md:-left-12 bg-[#FFFFFF]/90 backdrop-blur border border-[#A2D9E8] p-3 rounded-xl shadow-lg flex items-center gap-2.5 animate-bounce z-20" style={{ animationDuration: '6s' }}>
            <span className="text-xl">🤖</span>
            <div className="text-left">
              <p className="text-[10px] font-bold text-[#1A365D] leading-tight">{lang === 'th' ? 'ผู้ช่วย LINE' : 'LINE Assistant'}</p>
              {/* Green status accent: #38A169 */}
              <p className="text-[8px] text-[#38A169] font-bold">{lang === 'th' ? 'พร้อมทำงาน' : 'Online (Active)'}</p>
            </div>
          </div>
          
          <div className="absolute bottom-20 -right-8 md:-right-12 bg-[#FFFFFF]/90 backdrop-blur border border-[#A2D9E8] p-3 rounded-xl shadow-lg flex items-center gap-2.5 animate-bounce z-20" style={{ animationDuration: '8s' }}>
            <span className="text-xl">📅</span>
            <div className="text-left">
              <p className="text-[10px] font-bold text-[#1A365D] leading-tight">{lang === 'th' ? 'จองอัตโนมัติ' : 'Auto Bookings'}</p>
              {/* Blue accent: #2B6CB0 */}
              <p className="text-[8px] text-[#2B6CB0] font-bold">{lang === 'th' ? 'ตอบลูกค้าให้เอง' : 'Answers for you'}</p>
            </div>
          </div>

          {/* Floating card wrapper: bg #FFFFFF, border #A2D9E8 */}
          <div className="relative group max-w-[420px] w-full bg-[#FFFFFF] p-5 rounded-3xl border border-[#A2D9E8]/60 shadow-[0_15px_40px_rgba(26,54,93,0.08)] hover:scale-[1.01] transition-transform duration-500 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#E6F4F8] to-[#A2D9E8]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            {/* The Image */}
            <img 
              src="/genie_login_illustration.png" 
              alt="Genie AI Digital Assistant Illustration" 
              className="w-full h-auto rounded-2xl drop-shadow-sm select-none group-hover:scale-[1.02] transition-transform duration-700" 
            />
          </div>
        </div>

        {/* Feature Copy Highlights */}
        <div className="text-center md:text-left max-w-[480px]">
          {/* Title: #1A365D, Icon #2B6CB0 */}
          <h3 className="text-xl font-bold text-[#1A365D] flex items-center gap-2 justify-center md:justify-start">
            <Sparkles size={18} className="text-[#2B6CB0] animate-pulse" />
            <span>{t.aiSaaS}</span>
          </h3>
          {/* Subtext: #1A365D/80 */}
          <p className="text-xs text-[#1A365D]/80 leading-relaxed mt-2 font-medium">
            {t.aiDesc}
          </p>
        </div>

      </div>

    </div>
  );
};

export default AuthPage;
