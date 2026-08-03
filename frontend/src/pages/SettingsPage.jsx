import { useCallback, useEffect, useState } from 'react';
import { Key, MessageCircle, MessageSquare, Cpu, Save, Copy, Check, Settings, ExternalLink, AlertTriangle, CheckCircle2, XCircle, PlugZap, Trash2 } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@heroui/react';

const translations = {
  th: {
    title: "ตั้งค่าระบบและการเชื่อมต่อ",
    subtitle: "ตั้งค่าความเชื่อมต่อ API ของ LINE, Facebook Messenger, แชตบนเว็บ และปรับแต่งพฤติกรรมสมอง AI",
    lineTab: "LINE API",
    fbTab: "Facebook API",
    webchatTab: "Web Chat",
    aiTab: "ตั้งค่า AI & จองนัด",
    saveBtn: "บันทึกการตั้งค่า",
    saving: "กำลังบันทึก...",
    saveSuccess: "บันทึกการตั้งค่าระบบเสร็จสมบูรณ์เรียบร้อยแล้ว!",
    saveError: "เกิดข้อผิดพลาดในการบันทึกข้อมูลการตั้งค่า",
    lineGuide: "วิธีเชื่อมต่อ LINE ทีละขั้น (สำหรับผู้เริ่มต้น):",
    lineOpenConsole: "เปิดหน้าตั้งค่า LINE",
    lineStep1: "เข้าเว็บ LINE Developers แล้วเข้าสู่ระบบ จากนั้นเลือกบัญชี LINE ของร้านคุณ (LINE Official Account)",
    lineStep2: "เข้าไปที่แท็บ “Messaging API” แล้วกดปุ่ม “Issue” เพื่อสร้างรหัส Channel Access Token ยาว ๆ คัดลอกมาวางในช่องด้านล่าง",
    lineStep3: "ที่แท็บ “Basic settings” จะมี Channel Secret คัดลอกมาวางในช่อง Channel Secret ด้านล่าง",
    lineStep4: "คัดลอกลิงก์ (Webhook URL) ด้านล่างนี้ ไปวางในช่อง “Webhook URL” ที่แท็บ Messaging API แล้วกดเปิดสวิตช์ “Use webhook”",
    lineStep5: "สำคัญมาก: ที่หัวข้อ “Auto-reply messages” ให้กด “Edit” แล้วปิดข้อความตอบกลับอัตโนมัติ (Auto-reply) และปิดข้อความทักทาย (Greeting) ให้หมด ไม่เช่นนั้น LINE จะตอบแทน AI ของเรา",
    lineResponseCallout: "อย่าลืม: ต้องปิดการตอบกลับอัตโนมัติของ LINE (Auto-reply) มิฉะนั้นระบบ AI จะไม่ทำงาน",
    lineTokenLabel: "Channel Access Token (รหัสเชื่อมต่อยาว ๆ)",
    lineSecretLabel: "Channel Secret (รหัสลับของช่อง)",
    lineTokenPlaceholder: "กรอกเพื่ออัปเดต (เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน)",
    lineStatusConnected: "เชื่อมต่อแล้ว ✓",
    lineStatusNotConnected: "ยังไม่ได้เชื่อมต่อ",
    lineTestBtn: "ทดสอบการเชื่อมต่อ",
    lineTesting: "กำลังทดสอบ...",
    lineTestSuccess: "เชื่อมสำเร็จ ✓",
    lineTestFailDefault: "เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบรหัสอีกครั้ง",
    localhostWarning: "ตอนนี้ลิงก์นี้ใช้ได้เฉพาะบนเครื่องคอมพิวเตอร์เครื่องนี้เท่านั้น LINE ภายนอกจะเข้าถึงไม่ได้ ต้องเปิดลิงก์สาธารณะก่อน (เช่นใช้โปรแกรม ngrok) แล้วนำลิงก์นั้นไปวางที่ LINE แทน",
    fbTokenLabel: "Page Access Token",
    fbVerifyLabel: "Verify Token",
    fbGuide: "ขั้นตอนการเชื่อมต่อ Facebook Messenger Webhook:",
    fbStep1: "1. เข้าหน้าเมนู <a href='https://developers.facebook.com/' target='_blank' rel='noopener noreferrer' class='text-[#2B6CB0] dark:text-cyan-400 hover:underline font-bold'>Facebook Developer Portal</a> เลือกแอพของคุณ",
    fbStep2: "2. เพิ่มผลิตภัณฑ์ Messenger และไปที่ส่วนการตั้งค่า Webhooks เพื่อกด Subscribe แชท",
    fbStep3: "3. นำ Webhook URL ด้านล่างและค่า Verify Token ที่กำหนดไปกรอกตรวจสอบฝั่ง Facebook",
    webchatEnable: "เปิดใช้งานช่องทางการแชตบนหน้าเว็บไซต์ (Web Chat Widget)",
    webchatColor: "ธีมสีหลักของกล่องแชต (Accent Color)",
    webchatWelcome: "ข้อความต้อนรับของกล่องแชตแรกเริ่ม",
    webchatEmbedCode: "โค้ดสำหรับนำไปฝังที่หน้าเว็บไซต์ (JavaScript Embed Code):",
    aiModelLabel: "โมเดลปัญญาประดิษฐ์หลัก (Core AI Model)",
    aiTempLabel: "อุณหภูมิความสร้างสรรค์การตอบ (Temperature)",
    aiThresholdLabel: "ขีดจำกัดหน่วยความจำสลับโหมด CAG/RAG (CAG Token Threshold)",
    aiThresholdHelper: "หากขนาดไฟล์รวมเล็กกว่าค่านี้ ระบบจะนำคู่มือทั้งหมดป้อนเข้าระบบหลัก (CAG) ทันทีเพื่อความแม่นยำสูงสุด ถ้าใหญ่กว่าจะสลับไปค้นหาแบบ RAG",
    bookingBufferLabel: "ระยะเวลากันชนของการนัดหมาย (Booking Buffer Mins)",
    bookingBufferHelper: "ป้องกันการจองเวลาซ้ำซ้อนกัน โดยกำหนดช่องว่างขั้นต่ำระหว่างการนัด (นาที)",
    paceLabel: "จังหวะการตอบแชท LINE (ให้เหมือนคนพิมพ์)",
    paceHelper: "โหมดช้าจะโชว์ '…กำลังพิมพ์' และหน่วงเหมือนคนจริงตอบ",
    paceSlow: "ช้าแบบ AIS (แนะนำ)",
    paceNormal: "ปกติ",
    paceOff: "ปิด (ตอบเร็ว)",
    copyBtn: "คัดลอก",
    copied: "คัดลอกแล้ว!",
    webhookUrlLabel: "Webhook URL สำหรับไปวาง:",
    modelHelp: "รุ่นสมองหลักที่ใช้ในการสืบค้นข้อมูลและดำเนินการนัดหมายอัตโนมัติ"
  },
  en: {
    title: "System Settings",
    subtitle: "Configure API credentials for LINE, Facebook Messenger, Web Chat, and tune AI behavior.",
    lineTab: "LINE API",
    fbTab: "Facebook API",
    webchatTab: "Web Chat",
    aiTab: "AI & Booking Config",
    saveBtn: "Save Settings",
    saving: "Saving...",
    saveSuccess: "System settings updated successfully!",
    saveError: "Failed to save settings.",
    lineGuide: "How to connect LINE, step by step (beginner friendly):",
    lineOpenConsole: "Open LINE settings",
    lineStep1: "Go to LINE Developers, sign in, and select your shop's LINE Official Account.",
    lineStep2: "Open the “Messaging API” tab and click “Issue” to generate a long Channel Access Token. Copy and paste it into the field below.",
    lineStep3: "On the “Basic settings” tab you'll find the Channel Secret. Copy it into the Channel Secret field below.",
    lineStep4: "Copy the Webhook URL below and paste it into the “Webhook URL” box on the Messaging API tab, then turn on the “Use webhook” switch.",
    lineStep5: "Important: under “Auto-reply messages”, click “Edit” and turn OFF both Auto-reply and Greeting messages. Otherwise LINE will reply instead of your AI.",
    lineResponseCallout: "Don't forget: you must disable LINE's Auto-reply, or the AI assistant won't respond.",
    lineTokenLabel: "Channel Access Token",
    lineSecretLabel: "Channel Secret",
    lineTokenPlaceholder: "Enter to update (leave blank to keep current)",
    lineStatusConnected: "Connected ✓",
    lineStatusNotConnected: "Not connected yet",
    lineTestBtn: "Test connection",
    lineTesting: "Testing...",
    lineTestSuccess: "Connected ✓",
    lineTestFailDefault: "Connection failed. Please check your credentials.",
    localhostWarning: "This link only works on this computer right now — external LINE servers can't reach it. Expose a public URL first (e.g. with ngrok) and use that link in LINE instead.",
    fbTokenLabel: "Page Access Token",
    fbVerifyLabel: "Verify Token",
    fbGuide: "How to configure Facebook Webhook:",
    fbStep1: "1. Go to the <a href='https://developers.facebook.com/' target='_blank' rel='noopener noreferrer' class='text-[#2B6CB0] dark:text-cyan-400 hover:underline font-bold'>Facebook Developer Portal</a> for your app.",
    fbStep2: "2. Add the Messenger product to your app and set up Webhooks.",
    fbStep3: "3. Copy the Webhook URL below and enter your configured Verify Token.",
    webchatEnable: "Enable Webchat Widget on Website",
    webchatColor: "Webchat Widget Accent Color",
    webchatWelcome: "Default Welcome Message",
    webchatEmbedCode: "Website Integration Embed Code (JavaScript snippet):",
    aiModelLabel: "Core AI Model",
    aiTempLabel: "Response Creativity (Temperature)",
    aiThresholdLabel: "CAG/RAG Context Token Threshold",
    aiThresholdHelper: "Smaller corpuses fit entirely in prompts (CAG). Large files exceeding this threshold switch to search mode (RAG).",
    bookingBufferLabel: "Appointment Buffer Window (Minutes)",
    bookingBufferHelper: "Minimum gap between adjacent appointments to prevent overlaps.",
    paceLabel: "LINE reply pacing (human-like typing)",
    paceHelper: "Slow mode shows the '…typing' indicator and adds human-like delays before replying.",
    paceSlow: "Slow, AIS-style (recommended)",
    paceNormal: "Normal",
    paceOff: "Off (reply fast)",
    copyBtn: "Copy",
    copied: "Copied!",
    webhookUrlLabel: "Your Webhook URL to copy:",
    modelHelp: "Primary brain model used for document lookups and automated booking flows."
  }
};

const SettingsPage = ({ tenantId, lang, onLogout }) => {
  const t = translations[lang || 'th'];
  const [activeSubTab, setActiveSubTab] = useState('line');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [copiedUrlType, setCopiedUrlType] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Connection status flags (secrets are NEVER returned by GET; only these booleans).
  const [lineConfigured, setLineConfigured] = useState(false);
  const [lineVerified, setLineVerified] = useState(false);
  const [, setFacebookConfigured] = useState(false);
  const [webchatConfig, setWebchatConfig] = useState({ token: '', script_path: '/static/widget.js' });

  // LINE "test connection" result state.
  const [lineTest, setLineTest] = useState({ testing: false, result: null }); // result: { valid, bot_name?, picture_url?, error? }

  const [settings, setSettings] = useState({
    line_channel_access_token: '',
    line_channel_secret: '',
    facebook_page_access_token: '',
    facebook_verify_token: '',
    facebook_page_id: '',
    webchat_settings: {
      enabled: true,
      theme_color: '#2B6CB0',
      welcome_message: 'สวัสดีค่ะ! ยินดีต้อนรับสู่บริการผู้ช่วย AI ของเรา มีอะไรให้ช่วยวันนี้คะ?'
    },
    ai_settings: {
      model_name: 'gpt-4o-mini',
      temperature: 0.2,
      cag_token_threshold: 15000,
      humanize_mode: 'slow'
    },
    booking_settings: {
      conflict_window_mins: 30,
      min_lead_time_hours: 2
    }
  });

  const webhookUrls = (() => {
    let base = window.location.origin;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      base = 'https://genieai-chatbot.onrender.com';
    }
    return {
      line: `${base}/api/webhooks/line/${tenantId}`,
      facebook: `${base}/api/webhooks/facebook`,
      isLocalhost: false // Render URL is public and valid, no need to warn
    };
  })();

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tenant/profile/${tenantId}/settings`);
      if (res.ok) {
        const data = await res.json();
        // GET no longer returns any secret tokens — only *_configured booleans.
        // Never prefill token/secret inputs; keep them empty so the user must
        // re-type only when they want to change something.
        setLineConfigured(!!data.line_configured);
        setLineVerified(!!data.line_verified);
        setFacebookConfigured(!!data.facebook_configured);
        setWebchatConfig(data.webchat_config || { token: '', script_path: '/static/widget.js' });
        setSettings({
          line_channel_access_token: '',
          line_channel_secret: '',
          facebook_page_access_token: '',
          facebook_verify_token: data.facebook_verify_token || '',
          facebook_page_id: data.facebook_page_id || '',
          webchat_settings: {
            enabled: data.webchat_settings?.enabled ?? true,
            theme_color: data.webchat_settings?.theme_color || '#2B6CB0',
            welcome_message: data.webchat_settings?.welcome_message || 'สวัสดีค่ะ! ยินดีต้อนรับสู่บริการผู้ช่วย AI ของเรา มีอะไรให้ช่วยวันนี้คะ?',
            token_version: data.webchat_settings?.token_version ?? 1
          },
          ai_settings: {
            model_name: data.ai_settings?.model_name || 'gpt-4o-mini',
            temperature: data.ai_settings?.temperature ?? 0.2,
            cag_token_threshold: data.ai_settings?.cag_token_threshold ?? 15000,
            humanize_mode: data.ai_settings?.humanize_mode || 'slow'
          },
          booking_settings: {
            conflict_window_mins: data.booking_settings?.conflict_window_mins ?? 30,
            min_lead_time_hours: data.booking_settings?.min_lead_time_hours ?? 2
          },
          company_name: data.company_name || '',
          business_hours: data.business_hours || '',
          contact_number: data.contact_number || '',
          webhook_domain: data.webhook_domain || ''
        });
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== settings.company_name) {
      alert(lang === 'th' ? "ชื่อร้านไม่ถูกต้อง กรุณาพิมพ์ให้ตรงกับที่ระบุไว้" : "Incorrect company name. Please type it exactly as shown.");
      return;
    }
    
    const confirmWipe = window.confirm(lang === 'th' 
      ? "คุณแน่ใจจริงๆ ใช่หรือไม่ที่จะลบบัญชีและข้อมูลทั้งหมด? การดำเนินการนี้ไม่สามารถกู้คืนได้!" 
      : "Are you absolutely sure you want to delete your account and all data? This action is IRREVERSIBLE!"
    );
    if (!confirmWipe) return;
    
    setDeleting(true);
    setMessage({ type: '', text: '' });
    
    try {
      const res = await fetch(`/api/tenant/profile/${tenantId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        alert(lang === 'th' ? "ลบบัญชีและข้อมูลของคุณเสร็จสิ้นระบบจะทำการออกจากระบบ" : "Account successfully deleted. You will be logged out.");
        if (onLogout) {
          onLogout();
        }
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to delete account");
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || (lang === 'th' ? "ลบบัญชีล้มเหลว" : "Failed to delete account") });
    } finally {
      setDeleting(false);
    }
  };

  const verifyLine = async (tokenOverride) => {
    // Verify against a freshly-typed token if given, else the saved one.
    setLineTest({ testing: true, result: null });
    try {
      const body = tokenOverride ? { access_token: tokenOverride } : {};
      const res = await fetch(`/api/tenant/verify-line/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      setLineTest({ testing: false, result: data });
      setLineVerified(!!data.valid);
    } catch {
      setLineVerified(false);
      setLineTest({ testing: false, result: { valid: false, error: t.lineTestFailDefault } });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      // Only send secret tokens when the user actually typed a non-empty value;
      // an empty string would be preserved server-side, so we omit blanks.
      const payload = { ...settings };
      if (!payload.line_channel_access_token.trim()) delete payload.line_channel_access_token;
      if (!payload.line_channel_secret.trim()) delete payload.line_channel_secret;
      if (!payload.facebook_page_access_token.trim()) delete payload.facebook_page_access_token;

      const typedLineToken = settings.line_channel_access_token.trim();

      const res = await fetch(`/api/tenant/profile/${tenantId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: t.saveSuccess });
        // Refresh connection flags and clear the token inputs.
        await fetchSettings();
        // Auto-run the LINE test after a successful save so the user gets
        // instant feedback whether the token actually works.
        if (typedLineToken || activeSubTab === 'line') {
          verifyLine(typedLineToken || undefined);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || t.saveError);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedUrlType(type);
    setTimeout(() => setCopiedUrlType(''), 2000);
  };

  const getWebchatSnippet = () => {
    const backendUrl = new URL(window.location.origin);
    if (backendUrl.hostname === 'localhost' || backendUrl.hostname === '127.0.0.1') {
      backendUrl.port = '8000';
    }
    const config = encodeURIComponent(JSON.stringify({
      token: webchatConfig.token,
      themeColor: settings.webchat_settings.theme_color,
      welcomeMessage: settings.webchat_settings.welcome_message
    }));
    return `<!-- GenieAI Chat Widget -->
<script src="${backendUrl.origin}${webchatConfig.script_path}" data-config="${config}" async></script>`;
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
        {lang === 'th' ? 'กำลังโหลดการตั้งค่า...' : 'Loading settings...'}
      </div>
    );
  }

  const subTabs = [
    { id: 'line', name: t.lineTab, icon: MessageCircle, connected: lineConfigured && lineVerified },
    { id: 'facebook', name: t.fbTab, icon: MessageSquare },
    { id: 'webchat', name: t.webchatTab, icon: Key },
    { id: 'ai', name: t.aiTab, icon: Cpu },
    { id: 'delete', name: t.deleteTab, icon: Trash2 }
  ];

  return (
    <div className="animate-fade-in text-left flex flex-col gap-8 p-6 md:p-8 w-full max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1A365D] dark:text-white flex items-center gap-2">
            <Settings size={22} className="text-[#2B6CB0] dark:text-cyan-400" />
            <span>{t.title}</span>
          </h2>
          <p className="text-xs text-[#2B6CB0] font-semibold mt-1">
            {t.subtitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-start">
        {/* Left Side: Sub Navigation Tabs */}
        <div className="flex flex-col gap-1 bg-[#FFFFFF]/80 dark:bg-slate-900/60 border border-[#A2D9E8]/20 dark:border-white/5 p-3 rounded-2xl shadow-sm">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveSubTab(tab.id); setMessage({ type: '', text: '' }); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                  activeSubTab === tab.id
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md shadow-cyan-500/15'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#2B6CB0]'
                }`}
              >
                <Icon size={14} className="shrink-0" />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Right Side: Form Panels */}
        <div className="flex flex-col gap-6">
          {activeSubTab !== 'delete' ? (
            <form onSubmit={handleSave}>
              <Card className="glass-panel border-white/5 shadow-sm p-6 rounded-2xl">
              <CardContent className="p-0 flex flex-col gap-5">
                
                {/* 1. LINE CONFIG */}
                {activeSubTab === 'line' && (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#1A365D] dark:text-white mb-1">{t.lineTab} Integration</h3>
                        <p className="text-xs text-slate-400">{lang === 'th' ? 'เชื่อมโยงปัญญาประดิษฐ์เข้ากับ LINE Official Account (LINE OA) ของท่าน' : 'Link AI helper to your LINE OA channel.'}</p>
                      </div>
                      {/* Connection status badge (from *_configured, not from any token) */}
                      {lineConfigured ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#38A169]/10 text-[#38A169] border border-[#38A169]/25">
                          <CheckCircle2 size={13} /> {t.lineStatusConnected}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-slate-400/10 text-slate-500 border border-slate-300/40 dark:border-white/10">
                          <XCircle size={13} /> {t.lineStatusNotConnected}
                        </span>
                      )}
                    </div>

                    {/* Beginner-friendly numbered walkthrough */}
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-white/5 rounded-2xl flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-[#1A365D] dark:text-cyan-400">{t.lineGuide}</h4>
                        <a
                          href="https://developers.line.biz/console/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#2B6CB0]/10 text-[#2B6CB0] dark:text-cyan-400 hover:bg-[#2B6CB0]/15 transition-colors"
                        >
                          <ExternalLink size={12} /> {t.lineOpenConsole}
                        </a>
                      </div>

                      <ol className="flex flex-col gap-2.5">
                        {[t.lineStep1, t.lineStep2, t.lineStep3, t.lineStep4].map((step, i) => (
                          <li key={i} className="flex gap-2.5 items-start">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{step}</p>
                          </li>
                        ))}
                      </ol>

                      {/* Webhook URL row + localhost guard */}
                      <div className="flex flex-col gap-1.5 mt-1 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/50 dark:border-white/5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.webhookUrlLabel}</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-[#2B6CB0] dark:text-cyan-400 font-mono break-all flex-1">{webhookUrls.line}</code>
                          <button
                            type="button"
                            disabled={webhookUrls.isLocalhost}
                            onClick={() => copyToClipboard(webhookUrls.line, 'line')}
                            className={`p-2 rounded-lg shrink-0 transition-colors ${
                              webhookUrls.isLocalhost
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-[#2B6CB0] cursor-pointer'
                            }`}
                            title={webhookUrls.isLocalhost ? t.localhostWarning : t.copyBtn}
                          >
                            {copiedUrlType === 'line' ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                          </button>
                        </div>
                        {webhookUrls.isLocalhost && (
                          <div className="flex gap-2 items-start mt-1 p-2.5 rounded-lg bg-amber-400/10 border border-amber-400/25">
                            <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed font-medium">{t.localhostWarning}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mandatory Response-mode / disable-auto-reply callout */}
                    <div className="flex gap-2.5 items-start p-3.5 rounded-2xl bg-amber-400/10 border border-amber-400/30">
                      <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed font-bold">{t.lineResponseCallout}</p>
                        <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 leading-relaxed font-medium">{t.lineStep5}</p>
                        <a
                          href="https://manager.line.biz/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-bold text-[#2B6CB0] dark:text-cyan-400 hover:underline"
                        >
                          <ExternalLink size={12} /> {lang === 'th' ? 'เปิด LINE Official Account Manager' : 'Open LINE Official Account Manager'}
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-xs font-bold text-foreground">{t.lineTokenLabel}</label>
                      <input
                        type="text"
                        value={settings.line_channel_access_token}
                        onChange={(e) => setSettings({ ...settings, line_channel_access_token: e.target.value })}
                        placeholder={t.lineTokenPlaceholder}
                        className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                      />
                    </div>

                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-xs font-bold text-foreground">{t.lineSecretLabel}</label>
                      <input
                        type="password"
                        value={settings.line_channel_secret}
                        onChange={(e) => setSettings({ ...settings, line_channel_secret: e.target.value })}
                        placeholder={t.lineTokenPlaceholder}
                        className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                      />
                    </div>

                    {/* Test connection button + result */}
                    <div className="flex flex-col gap-2 text-left border-t border-slate-100 dark:border-white/5 pt-4">
                      <Button
                        type="button"
                        isLoading={lineTest.testing}
                        onClick={() => verifyLine(settings.line_channel_access_token.trim() || undefined)}
                        className="self-start bg-[#2B6CB0] hover:bg-[#245a96] text-white font-semibold rounded-xl h-10 px-5 shadow-sm cursor-pointer flex items-center gap-2"
                      >
                        {!lineTest.testing && <PlugZap size={14} />}
                        <span>{lineTest.testing ? t.lineTesting : t.lineTestBtn}</span>
                      </Button>

                      {lineTest.result && (
                        lineTest.result.valid ? (
                          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#38A169]/10 border border-[#38A169]/25">
                            {lineTest.result.picture_url ? (
                              <img src={lineTest.result.picture_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <CheckCircle2 size={18} className="text-[#38A169] shrink-0" />
                            )}
                            <span className="text-xs font-bold text-[#38A169]">
                              {t.lineTestSuccess}{lineTest.result.bot_name ? ` (${lineTest.result.bot_name})` : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-danger/10 border border-danger/20">
                            <XCircle size={16} className="text-danger shrink-0" />
                            <span className="text-xs font-bold text-danger">{lineTest.result.error || t.lineTestFailDefault}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* 2. FACEBOOK CONFIG */}
                {activeSubTab === 'facebook' && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <h3 className="text-base font-bold text-[#1A365D] dark:text-white mb-1">{t.fbTab} Integration</h3>
                      <p className="text-xs text-slate-400">{lang === 'th' ? 'เชื่อมโยง AI เข้ากับหน้าเพจ Facebook Messenger เพื่อตอบลูกค้า' : 'Connect AI to your Facebook Page Messenger.'}</p>
                    </div>

                    <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-white/5 rounded-2xl flex flex-col gap-3">
                      <h4 className="text-xs font-bold text-[#1A365D] dark:text-cyan-400">{t.fbGuide}</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: t.fbStep1 }} />
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{t.fbStep2}</p>
                      
                      <div className="flex flex-col gap-1.5 mt-1 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/50 dark:border-white/5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.webhookUrlLabel}</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-[#2B6CB0] dark:text-cyan-400 font-mono break-all flex-1">{webhookUrls.facebook}</code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(webhookUrls.facebook, 'fb')}
                            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-[#2B6CB0] rounded-lg cursor-pointer shrink-0 transition-colors"
                          >
                            {copiedUrlType === 'fb' ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{t.fbStep3}</p>
                    </div>

                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-xs font-bold text-foreground">{t.fbTokenLabel}</label>
                      <input
                        type="text"
                        value={settings.facebook_page_access_token}
                        onChange={(e) => setSettings({ ...settings, facebook_page_access_token: e.target.value })}
                        placeholder="EAAZB2ZA1ZAeZAa1B..."
                        className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                      />
                    </div>

                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-xs font-bold text-foreground">{t.fbVerifyLabel}</label>
                      <input
                        type="text"
                        value={settings.facebook_verify_token}
                        onChange={(e) => setSettings({ ...settings, facebook_verify_token: e.target.value })}
                        placeholder="เช่น my_secret_verify_token"
                        className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                      />
                    </div>

                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-xs font-bold text-foreground">
                        {lang === 'en' ? 'Facebook Page ID' : 'Facebook Page ID (รหัสเพจ)'}
                      </label>
                      <input
                        type="text"
                        value={settings.facebook_page_id}
                        onChange={(e) => setSettings({ ...settings, facebook_page_id: e.target.value })}
                        placeholder={lang === 'en' ? 'e.g. 1234567890 — routes messages to this shop' : 'เช่น 1234567890 — ใช้ส่งข้อความเข้าร้านที่ถูกต้อง'}
                        className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                      />
                    </div>
                  </div>
                )}

                {/* 3. WEB CHAT CONFIG */}
                {activeSubTab === 'webchat' && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <h3 className="text-base font-bold text-[#1A365D] dark:text-white mb-1">Web Chat Widget</h3>
                      <p className="text-xs text-slate-400">{lang === 'th' ? 'ฝังกล่องแชตลงบนเว็บไซต์หลักของร้านเพื่อตอบคำถามลูกค้า' : 'Embed chatbot onto your primary website.'}</p>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200/50 dark:border-white/5">
                      <input
                        type="checkbox"
                        id="webchat_enabled"
                        checked={settings.webchat_settings.enabled}
                        onChange={(e) => setSettings({
                          ...settings,
                          webchat_settings: { ...settings.webchat_settings, enabled: e.target.checked }
                        })}
                        className="w-4 h-4 rounded border-slate-300 text-[#2B6CB0] focus:ring-[#2B6CB0] cursor-pointer"
                      />
                      <label htmlFor="webchat_enabled" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        {t.webchatEnable}
                      </label>
                    </div>

                    {settings.webchat_settings.enabled && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1 text-left">
                            <label className="text-xs font-bold text-foreground">{t.webchatColor}</label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={settings.webchat_settings.theme_color}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  webchat_settings: { ...settings.webchat_settings, theme_color: e.target.value }
                                })}
                                className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0 shrink-0"
                              />
                              <input
                                type="text"
                                value={settings.webchat_settings.theme_color}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  webchat_settings: { ...settings.webchat_settings, theme_color: e.target.value }
                                })}
                                className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0] font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 text-left">
                            <label className="text-xs font-bold text-foreground">{t.webchatWelcome}</label>
                            <input
                              type="text"
                              value={settings.webchat_settings.welcome_message}
                              onChange={(e) => setSettings({
                               ...settings,
                               webchat_settings: { ...settings.webchat_settings, welcome_message: e.target.value }
                              })}
                              className="w-full h-10 px-3 text-xs text-[#1A365D] dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2B6CB0]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 text-left border-t border-slate-100 dark:border-white/5 pt-4 mt-1">
                          <span className="text-xs font-bold text-foreground">{t.webchatEmbedCode}</span>
                          <div className="flex flex-col gap-1.5 bg-slate-900 text-slate-100 p-4 rounded-2xl border border-white/5 relative">
                            <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed select-all text-left max-w-full pb-2 pr-10">
                              {getWebchatSnippet()}
                            </pre>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(getWebchatSnippet(), 'snippet')}
                              className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white rounded-lg cursor-pointer transition-colors"
                              title="Copy integration code"
                            >
                              {copiedUrlType === 'snippet' ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 4. AI & BOOKING SETTINGS */}
                {activeSubTab === 'ai' && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <h3 className="text-base font-bold text-[#1A365D] dark:text-white mb-1">{t.aiTab}</h3>
                      <p className="text-xs text-slate-400">{lang === 'th' ? 'ปรับแต่งโมเดลประมวลผลคำตอบและขอบเขตเงื่อนไขจองคิวการนัดหมาย' : 'Tune AI parameters and booking constraint logic.'}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-xs font-bold text-foreground">{t.aiModelLabel}</label>
                        <select
                          value={settings.ai_settings.model_name}
                          onChange={(e) => setSettings({
                            ...settings,
                            ai_settings: { ...settings.ai_settings, model_name: e.target.value }
                          })}
                          className="w-full h-11 px-4 text-xs text-[#1A365D] dark:text-white bg-[#FFFFFF] dark:bg-slate-900 border border-[#A2D9E8]/20 dark:border-white/5 rounded-2xl outline-none focus:border-[#2B6CB0] font-semibold cursor-pointer shadow-sm appearance-none transition-all duration-300"
                        >
                          <option value="gpt-4o-mini">gpt-4o-mini (เสถียร & รวดเร็ว)</option>
                          <option value="gpt-4o">gpt-4o (วิเคราะห์ซับซ้อนแม่นยำสูง)</option>
                        </select>
                        <span className="text-[10px] text-slate-400 leading-tight mt-0.5">{t.modelHelp}</span>
                      </div>

                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-xs font-bold text-foreground flex justify-between">
                          <span>{t.aiTempLabel}</span>
                          <span className="text-[#2B6CB0] dark:text-cyan-400 font-extrabold">{settings.ai_settings.temperature}</span>
                        </label>
                        <div className="flex items-center gap-3 h-10">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={settings.ai_settings.temperature}
                            onChange={(e) => setSettings({
                              ...settings,
                              ai_settings: { ...settings.ai_settings, temperature: Number(e.target.value) }
                            })}
                            className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#2B6CB0] dark:accent-cyan-400"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-left border-t border-slate-100 dark:border-white/5 pt-4">
                      <label className="text-xs font-bold text-foreground">{t.aiThresholdLabel}</label>
                      <Input
                        type="number"
                        value={settings.ai_settings.cag_token_threshold}
                        onChange={(e) => setSettings({
                          ...settings,
                          ai_settings: { ...settings.ai_settings, cag_token_threshold: Number(e.target.value) }
                        })}
                        className="w-full text-foreground bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl h-11"
                      />
                      <span className="text-[10px] text-slate-400 leading-normal mt-1">{t.aiThresholdHelper}</span>
                    </div>

                    {/* LINE reply pacing (human-like typing) */}
                    <div className="flex flex-col gap-1.5 text-left border-t border-slate-100 dark:border-white/5 pt-4">
                      <label className="text-xs font-bold text-foreground">{t.paceLabel}</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-0.5">
                        {[
                          { value: 'slow', label: t.paceSlow },
                          { value: 'normal', label: t.paceNormal },
                          { value: 'off', label: t.paceOff }
                        ].map((opt) => {
                          const active = settings.ai_settings.humanize_mode === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setSettings({
                                ...settings,
                                ai_settings: { ...settings.ai_settings, humanize_mode: opt.value }
                              })}
                              className={`h-11 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                                active
                                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white border-transparent shadow-md shadow-cyan-500/15'
                                  : 'bg-[#FFFFFF] dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-[#A2D9E8]/20 dark:border-white/5 hover:text-[#2B6CB0] hover:border-[#2B6CB0]/30'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-slate-400 leading-normal mt-1">{t.paceHelper}</span>
                    </div>

                    <div className="flex flex-col gap-1 text-left border-t border-slate-100 dark:border-white/5 pt-4">
                      <label className="text-xs font-bold text-foreground">{t.bookingBufferLabel}</label>
                      <Input
                        type="number"
                        value={settings.booking_settings.conflict_window_mins}
                        onChange={(e) => setSettings({
                          ...settings,
                          booking_settings: { ...settings.booking_settings, conflict_window_mins: Number(e.target.value) }
                        })}
                        className="w-full text-foreground bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl h-11"
                      />
                      <span className="text-[10px] text-slate-400 leading-normal mt-1">{t.bookingBufferHelper}</span>
                    </div>
                  </div>
                )}

                {/* Footer Save Row */}
                <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100 dark:border-white/5">
                  <Button
                    type="submit"
                    isLoading={saving}
                    className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold rounded-xl h-11 px-6 shadow-md shadow-cyan-500/20 hover:scale-[1.01] transition-all cursor-pointer flex items-center gap-2"
                  >
                    {!saving && <Save size={14} />}
                    <span>{saving ? t.saving : t.saveBtn}</span>
                  </Button>
                </div>

              </CardContent>
            </Card>
            </form>
          ) : (
            <Card className="glass-panel border-red-500/20 dark:border-red-900/30 bg-red-500/5 shadow-sm p-6 rounded-2xl text-left">
              <CardContent className="p-0 flex flex-col gap-6">
                <div>
                  <h3 className="text-base font-bold text-red-600 dark:text-red-400 mb-1 flex items-center gap-2">
                    <AlertTriangle size={18} />
                    <span>{t.deleteWarningTitle}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-red-500/10">
                    {t.deleteWarningDesc}
                  </p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t.deleteConfirmPrompt} <span className="font-extrabold text-red-600 dark:text-red-400 select-all">"{settings.company_name}"</span>
                  </label>
                  <Input
                    type="text"
                    placeholder={settings.company_name}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full text-foreground bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl h-11"
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/40 dark:border-white/5">
                  <Button
                    type="button"
                    isLoading={deleting}
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== settings.company_name || deleting}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl h-11 px-6 shadow-md shadow-red-600/20 hover:scale-[1.01] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>{deleting ? t.deletingText : t.deleteButton}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {message.text && (
            <div className={`p-4 rounded-xl text-sm border flex items-center gap-2 ${
              message.type === 'success' 
                ? 'bg-success/10 border-success/20 text-success' 
                : 'bg-danger/10 border-danger/20 text-danger'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
