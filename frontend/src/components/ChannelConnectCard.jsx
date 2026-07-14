import { useState } from 'react';
import {
  MessageCircle, MessageSquare, ArrowLeft, ExternalLink, Copy, Check,
  AlertTriangle, CheckCircle2, XCircle, Loader2, Info
} from 'lucide-react';
import { Button, Input } from '@heroui/react';

// Reuse the shared webhook-URL builder pattern (dev port 5173 -> backend 8000 swap)
// so localhost previews still point at the FastAPI server.
const buildWebhookBase = () => {
  let base = window.location.origin;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    base = 'https://genieai-chatbot.onrender.com';
  }
  return base;
};

const isLocalHost = () => false;

const T = {
  th: {
    pickTitle: 'เชื่อมต่อช่องทางแชท',
    pickSubtitle: 'เลือกช่องทางที่ลูกค้าของคุณใช้ทักเข้ามา แล้ว AI จะตอบให้อัตโนมัติ',
    lineName: 'LINE Official Account',
    lineDesc: 'ให้ AI ตอบแชทและรับจองผ่าน LINE ของร้านคุณ',
    fbName: 'Facebook Messenger',
    fbDesc: 'ตอบข้อความจากเพจ Facebook ของคุณ',
    comingSoon: 'เร็ว ๆ นี้',
    connected: 'เชื่อมต่อแล้ว',
    back: 'ย้อนกลับ',
    // LINE walkthrough
    lineGuideTitle: 'วิธีเชื่อมต่อ LINE (ทำตามทีละขั้น)',
    step1: 'เปิดแอป LINE Official Account Manager แล้วเลือกบัญชีร้านของคุณ',
    step2: 'เปิด LINE Developers Console เพื่อดึงรหัสเชื่อมต่อของบัญชีเดียวกัน',
    step3: 'คัดลอก "รหัสเชื่อมต่อ" และ "รหัสลับ" ด้านล่าง มาวางในช่อง แล้วกดทดสอบ',
    step4: 'คัดลอกลิงก์ Webhook ด้านล่างไปวางในหน้า LINE Developers (ช่อง Webhook URL) แล้วกดเปิดใช้งาน',
    openOaManager: 'เปิด LINE OA Manager',
    openDevelopers: 'เปิด LINE Developers',
    responseWarning: 'อย่าลืม! ในหน้า LINE OA Manager ให้ตั้งค่า "โหมดการตอบกลับ (Response mode)" เป็น "แชทบอท" และปิด "การตอบกลับอัตโนมัติ" ไม่งั้น AI จะตอบลูกค้าไม่ได้',
    tokenLabel: 'รหัสเชื่อมต่อ LINE (Channel Access Token)',
    tokenPlaceholder: 'วางรหัสเชื่อมต่อยาว ๆ ที่คัดลอกมา',
    secretLabel: 'รหัสลับ (Channel Secret)',
    secretPlaceholder: 'วางรหัสลับที่คัดลอกมา',
    savedTokenNote: 'บันทึกรหัสไว้แล้ว — เว้นว่างไว้ได้หากไม่ต้องการเปลี่ยน',
    webhookLabel: 'ลิงก์ Webhook ของคุณ (นำไปวางในหน้า LINE Developers)',
    copy: 'คัดลอก',
    copied: 'คัดลอกแล้ว!',
    localWarning: 'ลิงก์นี้เป็นเครื่องทดสอบภายใน (localhost) ใช้ได้เฉพาะบนเครื่องนี้เท่านั้น LINE จะเชื่อมต่อไม่ได้ ต้องใช้ลิงก์สาธารณะ (เช่น ngrok) ก่อน',
    testBtn: 'ทดสอบการเชื่อมต่อ',
    testing: 'กำลังทดสอบ...',
    testSuccess: 'เชื่อมสำเร็จ',
    testNeedToken: 'กรุณาใส่รหัสเชื่อมต่อ LINE ก่อนทดสอบ',
    saveBtn: 'บันทึกการเชื่อมต่อ',
    saving: 'กำลังบันทึก...',
    saveOk: 'บันทึกเรียบร้อยแล้ว',
    saveErr: 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    netErr: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
  },
  en: {
    pickTitle: 'Connect a chat channel',
    pickSubtitle: 'Pick the channel your customers message you on, and the AI will reply automatically.',
    lineName: 'LINE Official Account',
    lineDesc: 'Let the AI reply and take bookings on your shop’s LINE.',
    fbName: 'Facebook Messenger',
    fbDesc: 'Reply to messages from your Facebook Page.',
    comingSoon: 'Coming soon',
    connected: 'Connected',
    back: 'Back',
    lineGuideTitle: 'How to connect LINE (step by step)',
    step1: 'Open the LINE Official Account Manager app and select your shop account.',
    step2: 'Open the LINE Developers Console to get the connection keys for that same account.',
    step3: 'Copy the "Access Token" and "Secret" below, paste them in, then press Test.',
    step4: 'Copy the Webhook link below into the LINE Developers page (Webhook URL field) and turn it on.',
    openOaManager: 'Open LINE OA Manager',
    openDevelopers: 'Open LINE Developers',
    responseWarning: 'Don’t forget! In LINE OA Manager, set "Response mode" to "Chatbot" and turn OFF "Auto-reply" — otherwise the AI cannot reply to customers.',
    tokenLabel: 'LINE connection code (Channel Access Token)',
    tokenPlaceholder: 'Paste the long access token you copied',
    secretLabel: 'Secret code (Channel Secret)',
    secretPlaceholder: 'Paste the channel secret you copied',
    savedTokenNote: 'A code is already saved — leave blank to keep it unchanged.',
    webhookLabel: 'Your Webhook link (paste it in the LINE Developers page)',
    copy: 'Copy',
    copied: 'Copied!',
    localWarning: 'This is a local test address (localhost) that only works on this computer. LINE cannot reach it — you need a public URL (e.g. ngrok) first.',
    testBtn: 'Test connection',
    testing: 'Testing...',
    testSuccess: 'Connected successfully',
    testNeedToken: 'Please enter the LINE access token before testing.',
    saveBtn: 'Save connection',
    saving: 'Saving...',
    saveOk: 'Saved successfully',
    saveErr: 'Could not save. Please try again.',
    netErr: 'Could not reach the server. Check your connection and try again.'
  }
};

const maskToken = (val) => {
  if (!val) return '';
  const clean = val.trim();
  if (clean.length <= 4) return '••••';
  return `••••••••${clean.slice(-4)}`;
};

/**
 * Reusable channel-connect card for LINE (and a Facebook "coming soon" tile).
 * Props:
 *   tenantId (string, required)
 *   lang ('th' | 'en')
 *   lineConfigured (bool)     -> shows "Connected" badge, from GET profile line_configured
 *   facebookConfigured (bool)
 *   onConnected (fn)          -> called after a successful save (optional)
 */
const ChannelConnectCard = ({
  tenantId,
  lang = 'th',
  lineConfigured = false,
  onConnected
}) => {
  const t = T[lang] || T.th;
  const [view, setView] = useState('pick'); // 'pick' | 'line'
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [tokenFocused, setTokenFocused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // {valid, bot_name?, picture_url?, error?}
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null); // {type:'success'|'error', text}
  const [savedOnce, setSavedOnce] = useState(lineConfigured);

  const webhookUrl = `${buildWebhookBase()}/api/webhooks/line/${tenantId}`;
  const local = isLocalHost();

  const copyWebhook = () => {
    if (local) return; // do not copy a non-public URL
    navigator.clipboard?.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    setTestResult(null);
    setSaveMsg(null);
    if (!token.trim()) {
      setTestResult({ valid: false, error: t.testNeedToken });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(`/api/tenant/verify-line/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token.trim() })
      });
      const data = await res.json().catch(() => ({ valid: false, error: t.netErr }));
      setTestResult(data);
    } catch {
      setTestResult({ valid: false, error: t.netErr });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaveMsg(null);
    setSaving(true);
    try {
      // Only send fields the user actually typed (empty string is preserved server-side).
      const payload = {};
      if (token.trim()) payload.line_channel_access_token = token.trim();
      if (secret.trim()) payload.line_channel_secret = secret.trim();

      if (Object.keys(payload).length === 0) {
        setSaveMsg({ type: 'success', text: t.saveOk });
        setSaving(false);
        if (onConnected) onConnected();
        return;
      }

      const res = await fetch(`/api/tenant/profile/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || t.saveErr);
      }
      setSaveMsg({ type: 'success', text: t.saveOk });
      setSavedOnce(true);
      if (onConnected) onConnected();
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.message === t.saveErr ? t.saveErr : t.netErr });
    } finally {
      setSaving(false);
    }
  };

  // --- Channel picker view ---
  if (view === 'pick') {
    return (
      <div className="flex flex-col gap-5 w-full text-left">
        <div>
          <h3 className="text-lg font-extrabold text-[#1A365D] dark:text-white">{t.pickTitle}</h3>
          <p className="text-xs text-[#2B6CB0] font-semibold mt-1">{t.pickSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* LINE tile */}
          <button
            type="button"
            onClick={() => setView('line')}
            className="group relative flex flex-col items-start gap-3 p-5 rounded-2xl border border-[#38A169]/25 bg-[#38A169]/5 dark:bg-[#38A169]/10 hover:border-[#38A169]/50 hover:shadow-md transition-all text-left cursor-pointer"
          >
            {(lineConfigured || savedOnce) && (
              <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold text-[#38A169] bg-[#38A169]/10 border border-[#38A169]/30 px-2 py-0.5 rounded-full">
                <Check size={11} /> {t.connected}
              </span>
            )}
            <div className="w-12 h-12 rounded-xl bg-[#38A169] text-white flex items-center justify-center shadow-sm shadow-[#38A169]/30 group-hover:scale-105 transition-transform">
              <MessageCircle size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1A365D] dark:text-white">{t.lineName}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{t.lineDesc}</p>
            </div>
          </button>

          {/* Facebook tile (coming soon / beta) */}
          <div className="relative flex flex-col items-start gap-3 p-5 rounded-2xl border border-[#2B6CB0]/20 bg-[#2B6CB0]/5 dark:bg-[#2B6CB0]/10 opacity-80 cursor-not-allowed text-left">
            <span className="absolute top-3 right-3 text-[10px] font-bold text-[#2B6CB0] bg-[#2B6CB0]/10 border border-[#2B6CB0]/30 px-2 py-0.5 rounded-full">
              {t.comingSoon} · beta
            </span>
            <div className="w-12 h-12 rounded-xl bg-[#2B6CB0] text-white flex items-center justify-center shadow-sm shadow-[#2B6CB0]/30">
              <MessageSquare size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1A365D] dark:text-white">{t.fbName}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{t.fbDesc}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- LINE guided walkthrough view ---
  const steps = [t.step1, t.step2, t.step3, t.step4];

  return (
    <div className="flex flex-col gap-5 w-full text-left">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setView('pick')}
          className="w-8 h-8 rounded-lg border border-[#A2D9E8]/40 bg-white dark:bg-slate-900 text-[#2B6CB0] flex items-center justify-center hover:bg-[#E6F4F8]/40 transition-colors cursor-pointer shrink-0"
          aria-label={t.back}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#38A169] text-white flex items-center justify-center">
            <MessageCircle size={18} />
          </div>
          <h3 className="text-base font-extrabold text-[#1A365D] dark:text-white">{t.lineGuideTitle}</h3>
        </div>
      </div>

      {/* Numbered steps */}
      <ol className="flex flex-col gap-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="w-6 h-6 shrink-0 rounded-full bg-[#2B6CB0] text-white text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">{s}</span>
          </li>
        ))}
      </ol>

      {/* Deep-link buttons */}
      <div className="flex flex-wrap gap-3">
        <a
          href="https://manager.line.biz/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs font-bold text-[#38A169] border border-[#38A169]/30 bg-[#38A169]/5 hover:bg-[#38A169]/10 px-3.5 py-2 rounded-xl transition-colors"
        >
          <ExternalLink size={14} /> {t.openOaManager}
        </a>
        <a
          href="https://developers.line.biz/console/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs font-bold text-[#2B6CB0] border border-[#2B6CB0]/30 bg-[#2B6CB0]/5 hover:bg-[#2B6CB0]/10 px-3.5 py-2 rounded-xl transition-colors"
        >
          <ExternalLink size={14} /> {t.openDevelopers}
        </a>
      </div>

      {/* Mandatory yellow callout */}
      <div className="flex gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300/60 dark:border-amber-400/30">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed font-semibold">
          {t.responseWarning}
        </p>
      </div>

      {/* Token + secret inputs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[#1A365D] dark:text-white">{t.tokenLabel}</label>
          <Input
            type="text"
            value={tokenFocused ? token : (token ? maskToken(token) : '')}
            onFocus={() => setTokenFocused(true)}
            onBlur={() => setTokenFocused(false)}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t.tokenPlaceholder}
            className="w-full"
          />
          {(lineConfigured || savedOnce) && !token.trim() && (
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Info size={11} /> {t.savedTokenNote}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[#1A365D] dark:text-white">{t.secretLabel}</label>
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={t.secretPlaceholder}
            className="w-full"
          />
        </div>
      </div>

      {/* Webhook URL with copy */}
      <div className="flex flex-col gap-1.5 bg-white dark:bg-slate-900/60 p-3.5 rounded-2xl border border-[#A2D9E8]/30 dark:border-white/5">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.webhookLabel}</span>
        <div className="flex items-center gap-2">
          <code className="text-[11px] text-[#2B6CB0] dark:text-cyan-400 font-mono break-all flex-1">{webhookUrl}</code>
          <button
            type="button"
            onClick={copyWebhook}
            disabled={local}
            title={local ? t.localWarning : t.copy}
            className={`p-2 rounded-lg shrink-0 transition-colors flex items-center justify-center ${
              local
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 cursor-not-allowed'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-[#2B6CB0] cursor-pointer'
            }`}
          >
            {copied ? <Check size={14} className="text-[#38A169]" /> : <Copy size={14} />}
          </button>
        </div>
        {local && (
          <div className="flex gap-2 mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold leading-relaxed">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>{t.localWarning}</span>
          </div>
        )}
      </div>

      {/* Test result banner */}
      {testResult && (
        testResult.valid ? (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#38A169]/10 border border-[#38A169]/30">
            {testResult.picture_url ? (
              <img
                src={testResult.picture_url}
                alt=""
                className="w-9 h-9 rounded-full object-cover border border-[#38A169]/30"
              />
            ) : (
              <CheckCircle2 size={20} className="text-[#38A169] shrink-0" />
            )}
            <span className="text-xs font-bold text-[#38A169]">
              {t.testSuccess} ✓ {testResult.bot_name ? `(${testResult.bot_name})` : ''}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-[#E53E3E]/10 border border-[#E53E3E]/25">
            <XCircle size={18} className="text-[#E53E3E] shrink-0" />
            <span className="text-xs font-semibold text-[#E53E3E]">{testResult.error || t.saveErr}</span>
          </div>
        )
      )}

      {/* Save result banner */}
      {saveMsg && (
        <div
          className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold ${
            saveMsg.type === 'success'
              ? 'bg-[#38A169]/10 border border-[#38A169]/25 text-[#38A169]'
              : 'bg-[#E53E3E]/10 border border-[#E53E3E]/25 text-[#E53E3E]'
          }`}
        >
          {saveMsg.type === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {saveMsg.text}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={handleTest}
          isDisabled={testing}
          className="bg-white dark:bg-slate-900 border border-[#2B6CB0]/30 text-[#2B6CB0] font-semibold rounded-xl h-11 px-5 hover:bg-[#2B6CB0]/5 transition-all cursor-pointer flex items-center gap-2"
        >
          {testing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          <span>{testing ? t.testing : t.testBtn}</span>
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          isDisabled={saving}
          className="bg-gradient-to-r from-[#38A169] to-emerald-500 hover:from-[#2F855A] hover:to-emerald-400 text-white font-semibold rounded-xl h-11 px-5 shadow-md shadow-[#38A169]/20 transition-all cursor-pointer flex items-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          <span>{saving ? t.saving : t.saveBtn}</span>
        </Button>
      </div>
    </div>
  );
};

export default ChannelConnectCard;
