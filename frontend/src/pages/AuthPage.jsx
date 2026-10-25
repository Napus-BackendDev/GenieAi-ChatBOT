import { useCallback, useState, useEffect, useRef } from 'react';
import { Mail, Lock, ArrowRight, Store, Sparkles, BookOpen } from 'lucide-react';
import { Button, Checkbox, InputGroup, Label, TextField } from '@heroui/react';
import Mascot3D from '../components/Mascot3D';
import { parseApiJson } from '../lib/apiResponse';
import { loadGoogleSdk, resetGoogleSdk } from '../lib/googleSdk';

const mockLoginEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_LOGIN === 'true';

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
    forgotHelp: "ระบบเวอร์ชันนี้ยังไม่รองรับการรีเซ็ตรหัสผ่านทางอีเมล หากสมัครด้วย Google ให้ใช้ปุ่ม Google เดิม หากใช้รหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ GenieAI ก่อนสร้างบัญชีใหม่เพื่อไม่ให้ข้อมูลร้านสูญหาย",
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
    mockLoginNotice: "* ตัวเลือกเข้าระบบแบบจำลองสำหรับนักพัฒนา",
    apiUnavailable: "ระบบเข้าสู่ระบบไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่ภายหลังหรือติดต่อผู้ดูแลระบบ"
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
    forgotHelp: "Email password reset is not available in this version. If you registered with Google, use Google sign-in. For password accounts, contact your GenieAI administrator before creating another account so your business data stays attached.",
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
    mockLoginNotice: "* developer mock login fallback",
    apiUnavailable: "The sign-in service is temporarily unavailable. Please try again later or contact support."
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
  }, [activeTab, onTabChange]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [googleSdkFailed, setGoogleSdkFailed] = useState(false);
  const [googleConfig, setGoogleConfig] = useState(null);
  const [providerStatus, setProviderStatus] = useState('loading'); // 'loading' | 'ready' | 'disabled' | 'unavailable'
  const googleInitializedFor = useRef('');
  const googleLoginInFlightRef = useRef(false);

  // Account linking state when a Google account matches an existing password account
  const [linkingData, setLinkingData] = useState(null); // { email, google_token }
  const [linkingPassword, setLinkingPassword] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);

  const fetchProviders = useCallback(() => {
    setProviderStatus('loading');
    fetch('/api/auth/providers', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await parseApiJson(response, t.apiUnavailable);
        if (!response.ok) throw new Error(data.detail || t.apiUnavailable);
        return data;
      })
      .then((data) => {
        if (data?.google?.enabled && data.google?.client_id) {
          setGoogleConfig(data.google);
          setProviderStatus('ready');
        } else {
          setGoogleConfig({ enabled: false });
          setProviderStatus('disabled');
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch auth providers:', err);
        setGoogleConfig({ enabled: false });
        setProviderStatus('unavailable');
      });
  }, [t.apiUnavailable]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = activeTab === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const bodyPayload = activeTab === 'signup'
        ? { email: email.trim(), password, keep_logged_in: keepLoggedIn }
        : { provider: 'credentials', email: email.trim(), password, keep_logged_in: keepLoggedIn };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      const data = await parseApiJson(response, t.apiUnavailable);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(lang === 'th' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : 'Invalid email or password');
        }
        if (response.status === 409) {
          throw new Error(lang === 'th' ? 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ' : 'This email is already registered. Please log in.');
        }
        throw new Error(data.detail || (lang === 'th' ? 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' : 'Authentication failed'));
      }

      onAuthSuccess(data, keepLoggedIn);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLoginResponse = useCallback(async (googleRes) => {
    if (googleLoginInFlightRef.current) return;
    googleLoginInFlightRef.current = true;
    setError('');
    setLoading(true);

    try {
      if (googleRes?.error === 'popup_closed_by_user') {
        throw new Error(lang === 'th' ? 'หน้าต่างเข้าสู่ระบบ Google ถูกปิดก่อนทำรายการเสร็จสิ้น' : 'Google sign-in popup was closed before completion.');
      }
      if (!googleRes?.credential) {
        throw new Error(lang === 'th' ? 'ไม่ได้รับข้อมูลยืนยันตัวตนจาก Google กรุณาลองใหม่อีกครั้ง' : 'No credential received from Google. Please try again.');
      }
      const endpoint = activeTab === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const bodyPayload = {
        provider: 'google',
        token: googleRes.credential,
        keep_logged_in: keepLoggedIn
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      const data = await parseApiJson(response, t.apiUnavailable);
      if (!response.ok) {
        if (response.status === 409 && (data.code === 'ACCOUNT_LINK_REQUIRED' || data.detail === 'ACCOUNT_LINK_REQUIRED')) {
          setLinkingData({ email: data.email || email.trim(), google_token: googleRes.credential });
          return;
        }
        if (response.status === 404) {
          throw new Error(lang === 'th' ? 'ยังไม่มีบัญชีที่ผูกกับ Google นี้ กรุณาเลือก "สร้างบัญชีผู้ใช้"' : 'No account found for this Google login. Please select "Create Account".');
        }
        if (response.status === 409) {
          throw new Error(lang === 'th' ? 'บัญชี Google นี้ลงทะเบียนไว้แล้ว กรุณาเลือก "เข้าสู่ระบบ"' : 'This account is already registered. Please select "Log In".');
        }
        if (response.status === 503) {
          throw new Error(lang === 'th' ? 'ระบบยืนยันตัวตนไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง' : 'Authentication service is temporarily unavailable. Please retry later.');
        }
        throw new Error(data.detail || (lang === 'th' ? 'การยืนยันตัวตนผ่าน Google ล้มเหลว' : 'Google authentication failed'));
      }

      onAuthSuccess(data, keepLoggedIn);
    } catch (err) {
      setError(err.message);
    } finally {
      googleLoginInFlightRef.current = false;
      setLoading(false);
    }
  }, [activeTab, email, keepLoggedIn, lang, onAuthSuccess, t.apiUnavailable]);

  const handleLinkGoogleSubmit = async (e) => {
    e.preventDefault();
    if (!linkingData || !linkingPassword) return;
    setLinkingLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/link-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: linkingData.email,
          password: linkingPassword,
          token: linkingData.google_token,
          google_token: linkingData.google_token,
          keep_logged_in: keepLoggedIn
        })
      });
      const data = await parseApiJson(response, t.apiUnavailable);
      if (!response.ok) {
        throw new Error(data.detail || (lang === 'th' ? 'รหัสผ่านไม่ถูกต้อง ไม่สามารถเชื่อมต่อ Google ได้' : 'Invalid password. Unable to link Google account.'));
      }
      setLinkingData(null);
      setLinkingPassword('');
      onAuthSuccess(data, keepLoggedIn);
    } catch (err) {
      setError(err.message);
    } finally {
      setLinkingLoading(false);
    }
  };

  const loadSdk = useCallback(() => {
    if (!googleConfig?.enabled) return;
    setGoogleSdkFailed(false);
    loadGoogleSdk(15000)
      .then(() => { setSdkLoaded(true); setGoogleSdkFailed(false); })
      .catch((e) => {
        console.warn('Google SDK loading error:', e);
        setGoogleSdkFailed(true);
      });
  }, [googleConfig?.enabled]);

  useEffect(() => {
    loadSdk();
  }, [loadSdk]);

  const retryGoogleSdk = () => {
    resetGoogleSdk();
    setSdkLoaded(false);
    loadSdk();
  };

  const googleCallbackRef = useRef(handleGoogleLoginResponse);
  useEffect(() => {
    googleCallbackRef.current = handleGoogleLoginResponse;
  }, [handleGoogleLoginResponse]);

  useEffect(() => {
    if (sdkLoaded && googleConfig?.enabled && window.google && googleConfig.client_id) {
      if (googleInitializedFor.current !== googleConfig.client_id) {
        window.google.accounts.id.initialize({
          client_id: googleConfig.client_id,
          callback: (response) => googleCallbackRef.current(response),
        });
        googleInitializedFor.current = googleConfig.client_id;
      }

      if (googleBtnRef.current) {
        googleBtnRef.current.replaceChildren();
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
  }, [sdkLoaded, googleConfig, activeTab]);

  return (
    <div className="flex min-h-screen w-full items-stretch overflow-hidden bg-slate-50 dark:bg-[#07090E] text-slate-800 dark:text-slate-100 transition-colors duration-300">
      
      {/* Left Column: Form Section */}
      <div className="w-full lg:w-[48%] xl:w-[45%] flex flex-col justify-between p-8 md:p-12 lg:p-16 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between w-full">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-all"
            onClick={onNavigateHome}
          >
            <div className="bg-gradient-to-br from-[#2B6CB0] to-cyan-500 rounded-xl w-10 h-10 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Store size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-base leading-tight text-slate-900 dark:text-white">
                GenieAI
              </h2>
              <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 tracking-wider uppercase">
                {t.aiSaaS}
              </span>
            </div>
          </div>

          {/* Language Switcher */}
          <Button
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            size="sm"
            variant="light"
            className="border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-lg cursor-pointer h-8 px-2.5 min-w-0"
          >
            {lang === 'th' ? 'EN' : 'TH'}
          </Button>
        </div>

        {/* Form Content Area */}
        <div className="my-auto py-8 max-w-[420px] w-full mx-auto">
          {/* Login / Sign Up State */}
          <div className="animate-fade-in text-left">
              <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                {activeTab === 'login' ? t.welcomeBack : t.createAccount}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 leading-relaxed font-medium">
                {activeTab === 'login' ? t.loginSub : t.signupSub}
              </p>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl p-3 text-sm mb-5 font-semibold">
                  {error}
                </div>
              )}

              {linkingData ? (
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5 mb-6 text-left animate-fade-in">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white mb-1">
                    {lang === 'th' ? '🔗 ยืนยันการเชื่อมต่อบัญชี Google' : '🔗 Link Google Account'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                    {lang === 'th'
                      ? `อีเมล ${linkingData.email} มีบัญชีในระบบแล้ว กรุณากรอกรหัสผ่านเพื่อเชื่อมต่อกับ Google สำหรับการเข้าสู่ระบบครั้งต่อไป`
                      : `The account ${linkingData.email} already exists. Please enter your password to link your Google account.`}
                  </p>
                  <form onSubmit={handleLinkGoogleSubmit} className="flex flex-col gap-3">
                    <TextField isRequired name="linkingPassword" type="password" className="w-full">
                      <Label>{t.passwordLabel}</Label>
                      <InputGroup>
                        <InputGroup.Prefix><Lock className="text-slate-500" size={16} /></InputGroup.Prefix>
                        <InputGroup.Input
                          placeholder={t.passwordPlaceholder}
                          value={linkingPassword}
                          onChange={(e) => setLinkingPassword(e.target.value)}
                          autoFocus
                        />
                      </InputGroup>
                    </TextField>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="submit"
                        color="primary"
                        className="flex-1 font-bold h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                        isLoading={linkingLoading}
                      >
                        {lang === 'th' ? 'ยืนยันเชื่อมต่อ' : 'Confirm Link'}
                      </Button>
                      <Button
                        type="button"
                        variant="light"
                        onClick={() => { setLinkingData(null); setLinkingPassword(''); }}
                        className="h-10 rounded-xl"
                      >
                        {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  {/* Google Button Container */}
                  <div className="w-full flex flex-col gap-2">
                    {googleConfig?.enabled && (
                      <div ref={googleBtnRef} className="w-full min-h-[44px] flex justify-center"></div>
                    )}
                    {providerStatus === 'unavailable' && (
                      <div className="w-full flex items-center justify-between p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
                        <span>{lang === 'th' ? 'ระบบ Google Sign-In ไม่พร้อมใช้งานชั่วคราว' : 'Google Sign-In is temporarily unavailable'}</span>
                        <Button size="sm" variant="flat" onClick={fetchProviders} className="h-7 px-2 text-xs font-bold cursor-pointer">
                          {lang === 'th' ? 'ลองใหม่' : 'Retry'}
                        </Button>
                      </div>
                    )}
                    {googleConfig?.enabled && googleSdkFailed && (
                      <div className="w-full flex items-center justify-between p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
                        <span>{lang === 'th' ? 'โหลด Google Sign-In ไม่สำเร็จ' : 'Failed to load Google Sign-In'}</span>
                        <Button size="sm" variant="flat" onClick={retryGoogleSdk} className="h-7 px-2 text-xs font-bold cursor-pointer">
                          {lang === 'th' ? 'ลองใหม่' : 'Retry'}
                        </Button>
                      </div>
                    )}
                    {mockLoginEnabled && (
                      <Button
                        type="button"
                        variant="light"
                        size="sm"
                        onClick={() => handleGoogleLoginResponse({ credential: 'mock' })}
                        className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400"
                      >
                        {t.mockLoginNotice}
                      </Button>
                    )}
                  </div>

                  {/* Separator */}
                  <div className="flex items-center text-center my-6">
                    <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
                    <span className="px-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      {activeTab === 'login' ? t.orEmailLogin : t.orEmailSignup}
                    </span>
                    <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
                  </div>
                </>
              )}

              {/* Form inputs */}
              <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-4">
                <TextField isRequired name="email" type="email" className="w-full">
                  <Label>{t.emailLabel}</Label>
                  <InputGroup>
                    <InputGroup.Prefix>
                      <Mail className="text-slate-500" size={16} />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      placeholder="owner@yourshop.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </InputGroup>
                </TextField>

                <TextField isRequired name="password" type="password" className="w-full">
                  <Label>{t.passwordLabel}</Label>
                  <InputGroup>
                    <InputGroup.Prefix>
                      <Lock className="text-slate-500" size={16} />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      placeholder={t.passwordPlaceholder}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                    />
                  </InputGroup>
                </TextField>

                {activeTab === 'login' && (
                  <>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <Checkbox
                        isSelected={keepLoggedIn}
                        onChange={setKeepLoggedIn}
                        size="sm"
                        className="text-slate-600 dark:text-slate-300"
                      >
                        {t.keepLoggedIn}
                      </Checkbox>
                      <Button
                        type="button"
                        variant="light"
                        size="sm"
                        onClick={() => setShowForgotHelp((shown) => !shown)}
                        className="text-cyan-600 dark:text-cyan-400 font-bold px-2 min-w-0"
                      >
                      {t.forgotPassword}
                      </Button>
                    </div>
                    {showForgotHelp && (
                      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {t.forgotHelp}
                      </div>
                    )}
                  </>
                )}

                <Button 
                  type="submit" 
                  color="primary" 
                  className="w-full font-bold h-11 mt-4 rounded-xl cursor-pointer bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:opacity-95 text-white shadow-lg shadow-cyan-500/25 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                  isLoading={loading}
                >
                  <span>{activeTab === 'login' ? t.loginBtn : t.signupBtn}</span>
                  {!loading && <ArrowRight size={16} />}
                </Button>
              </form>

              <div className="text-center text-xs text-slate-600 dark:text-slate-400 mt-8">
                {activeTab === 'login' ? (
                  <p>
                    {t.noAccount}{' '}
                    <button
                      onClick={() => { setActiveTab('signup'); setError(''); }}
                      className="text-cyan-600 dark:text-cyan-400 hover:underline font-bold cursor-pointer"
                    >
                      {t.signupBtn}
                    </button>
                  </p>
                ) : (
                  <p>
                    {t.haveAccount}{' '}
                    <button
                      onClick={() => { setActiveTab('login'); setError(''); }}
                      className="text-cyan-600 dark:text-cyan-400 hover:underline font-bold cursor-pointer"
                    >
                      {t.loginBtn}
                    </button>
                  </p>
                )}
              </div>
          </div>
        </div>

        <div className="text-left text-[11px] text-slate-500 dark:text-slate-500 font-medium">
          © {new Date().getFullYear()} GenieAI SaaS. All rights reserved.
        </div>
      </div>

      {/* Right Column: Visual Section (Clean Glassmorphic Ambient Stage) */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col justify-between p-12 bg-gradient-to-br from-[#E6F4F8] via-[#D8F0F6] to-[#A2D9E8] dark:from-[#0B0F17] dark:via-[#1A2338] dark:to-[#07090E] border-l border-slate-200 dark:border-slate-800 relative overflow-hidden transition-colors duration-300">
        
        {/* Ambient Grid Pattern & Light Orbs */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[450px] h-[450px] bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none" />

        {/* Sleeknote Academy Top Right Block (Above Background) */}
        <div className="flex flex-col items-end text-right self-end max-w-[300px] relative z-10 bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wider mb-1">
            <BookOpen size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span>{t.academyTitle}</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mb-3 font-medium">
            {t.academyDesc}
          </p>
          <a
            href="https://developers.line.biz/en/docs/messaging-api/getting-started/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold border border-slate-800 dark:border-slate-200 text-slate-900 dark:text-white px-3.5 py-1.5 rounded-lg hover:bg-slate-900/10 dark:hover:bg-white/10 transition-all uppercase tracking-wider"
          >
            {t.startAcademy}
          </a>
        </div>

        {/* Floating Glassmorphic Widgets & 3D Interactive Mascot Component */}
        <div className="my-auto flex flex-col items-center justify-center relative z-10 w-full max-w-[500px] mx-auto py-12">
          
          {/* Glowing backdrop Orbs */}
          <div className="absolute w-[320px] h-[320px] bg-cyan-500/25 rounded-full blur-3xl -top-12 -left-12 -z-10 animate-pulse"></div>
          <div className="absolute w-[320px] h-[320px] bg-indigo-500/25 rounded-full blur-3xl -bottom-12 -right-12 -z-10 animate-pulse"></div>

          {/* Interactive 3D Mascot Avatar */}
          <Mascot3D size="xl" showBadge={true} />

          {/* Floating Widget 1 */}
          <div className="absolute top-8 -left-4 md:-left-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce z-20" style={{ animationDuration: '6s' }}>
            <span className="text-2xl">🤖</span>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{lang === 'th' ? 'ผู้ช่วย LINE อัจฉริยะ' : 'Smart LINE Assistant'}</p>
              <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">{lang === 'th' ? 'พร้อมทำงาน 24 ชั่วโมง' : 'Online 24/7 Active'}</p>
            </div>
          </div>
          
          {/* Floating Widget 2 */}
          <div className="absolute bottom-8 -right-4 md:-right-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce z-20" style={{ animationDuration: '8s' }}>
            <span className="text-2xl">📅</span>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{lang === 'th' ? 'จองคิวอัตโนมัติ' : 'Auto Bookings'}</p>
              <p className="text-[9px] text-cyan-600 dark:text-cyan-400 font-bold">{lang === 'th' ? 'ไม่มีคิวซ้อน 100%' : 'Conflict-Free 100%'}</p>
            </div>
          </div>
        </div>

        {/* Feature Copy Highlights Bottom Bar */}
        <div className="text-center md:text-left max-w-[500px] relative z-10 bg-white/85 dark:bg-slate-900/85 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-xl shadow-xl">
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2 justify-center md:justify-start">
            <Sparkles size={18} className="text-cyan-600 dark:text-cyan-400 animate-pulse" />
            <span>{t.aiSaaS}</span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-2 font-medium">
            {t.aiDesc}
          </p>
        </div>

      </div>

    </div>
  );
};

export default AuthPage;
