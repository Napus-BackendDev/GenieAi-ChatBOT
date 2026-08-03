import { Button, Card, CardContent } from '@heroui/react';
import { AlertTriangle, BookOpen, Bot, ExternalLink, LifeBuoy, Settings } from 'lucide-react';

const COPY = {
  th: {
    title: 'ศูนย์ช่วยเหลือ',
    subtitle: 'แก้ปัญหาการเชื่อมต่อและตรวจสอบผู้ช่วย AI ได้จากจุดเดียว',
    quick: 'ทางลัด',
    settings: 'ตรวจสอบการเชื่อมต่อ',
    settingsHelp: 'ตั้งค่าและทดสอบ LINE, Facebook และ Web Chat',
    sandbox: 'ทดสอบคำตอบ AI',
    sandboxHelp: 'ลองถามคำถามจริงและดูแหล่งข้อมูลที่ AI ใช้',
    checklist: 'ตรวจสอบเบื้องต้น',
    steps: [
      'เข้าเมนูตั้งค่าและทดสอบการเชื่อมต่อ LINE อีกครั้ง',
      'ตรวจสอบว่า LINE ปิด Auto-reply และ Greeting message แล้ว',
      'หากคำตอบไม่ตรง ให้ตรวจข้อมูลร้าน บริการ และเอกสารที่อัปโหลด',
      'หากหน้าเว็บเชื่อมต่อไม่ได้ ให้ตรวจว่า backend ทำงานที่พอร์ต 8000'
    ],
    docs: 'คู่มือ LINE Messaging API',
    noticeTitle: 'ช่องทางช่วยเหลือในเวอร์ชันนี้',
    notice: 'ขณะนี้ยังไม่มีระบบส่งทิกเก็ตในแอป หากปัญหายังไม่หาย กรุณาส่งภาพหน้าจอ ข้อความผิดพลาด และเวลาที่เกิดเหตุให้ผู้ดูแลระบบ GenieAI ของคุณ'
  },
  en: {
    title: 'Support Center',
    subtitle: 'Troubleshoot connections and validate your AI assistant in one place.',
    quick: 'Quick actions',
    settings: 'Check connections',
    settingsHelp: 'Configure and test LINE, Facebook, and Web Chat.',
    sandbox: 'Test AI responses',
    sandboxHelp: 'Ask a real question and inspect the sources used by the AI.',
    checklist: 'First checks',
    steps: [
      'Open Settings and run the LINE connection test again.',
      'Confirm LINE Auto-reply and Greeting messages are turned off.',
      'For incorrect answers, review your business info, services, and uploaded documents.',
      'If the dashboard cannot connect, confirm the backend is running on port 8000.'
    ],
    docs: 'LINE Messaging API guide',
    noticeTitle: 'Support available in this version',
    notice: 'In-app support tickets are not available yet. If the issue persists, send a screenshot, the exact error message, and the incident time to your GenieAI administrator.'
  }
};

const SupportPage = ({ lang = 'th', setActiveTab }) => {
  const t = COPY[lang] || COPY.th;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 p-3 text-white shadow-lg shadow-cyan-500/20">
            <LifeBuoy size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-[#1A365D] dark:text-white">{t.title}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
          </div>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-[#1A365D] dark:text-white">{t.quick}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border border-cyan-500/15 bg-white/80 shadow-lg dark:bg-slate-900/80">
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <Settings className="text-cyan-600 dark:text-cyan-400" size={22} />
              <div className="flex-1">
                <h4 className="font-bold text-[#1A365D] dark:text-white">{t.settings}</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t.settingsHelp}</p>
              </div>
              <Button color="primary" variant="flat" onClick={() => setActiveTab('settings')}>
                {t.settings}
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-indigo-500/15 bg-white/80 shadow-lg dark:bg-slate-900/80">
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <Bot className="text-indigo-600 dark:text-indigo-400" size={22} />
              <div className="flex-1">
                <h4 className="font-bold text-[#1A365D] dark:text-white">{t.sandbox}</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t.sandboxHelp}</p>
              </div>
              <Button color="secondary" variant="flat" onClick={() => setActiveTab('sandbox')}>
                {t.sandbox}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="border border-white/20 bg-[#E6F4F8]/70 shadow-xl dark:bg-slate-900/70">
        <CardContent className="p-6">
          <h3 className="mb-4 flex items-center gap-2 font-extrabold text-[#1A365D] dark:text-white">
            <BookOpen size={19} className="text-cyan-600 dark:text-cyan-400" />
            {t.checklist}
          </h3>
          <ol className="space-y-3">
            {t.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A365D] text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <Button
            className="mt-5"
            variant="bordered"
            endContent={<ExternalLink size={14} />}
            onClick={() => window.open('https://developers.line.biz/en/docs/messaging-api/', '_blank', 'noopener,noreferrer')}
          >
            {t.docs}
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 shrink-0" size={18} />
        <div>
          <p className="font-bold">{t.noticeTitle}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">{t.notice}</p>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
