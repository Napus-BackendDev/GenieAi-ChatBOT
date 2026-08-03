import { useState, useEffect, useRef } from 'react';
import { Send, Zap, Search, FileText, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@heroui/react';

const translations = {
  th: {
    welcomeAssistant: "สวัสดีค่ะ! ยินดีต้อนรับสู่กล่องทดสอบเลขา AI ประจำร้าน คุณสามารถทดลองถามคำถามเกี่ยวกับรายละเอียดร้านค้า ค่านวด/ตัดผม หรือขอลองนัดหมายคิวบริการเพื่อเช็คระบบได้เลยค่ะ",
    chatError: "เกิดข้อผิดพลาดในการรับข้อมูลแชต",
    systemFail: "❌ ขออภัยด้วยค่ะ ระบบขัดข้องชั่วคราว:",
    thinking: "🤖 เลขากำลังคิดคำตอบ...",
    
    title: "กล่องจำลองแชตบอต (Chat Sandbox)",
    subtitle: "ทดลองพิมพ์ถามคำถามเพื่อจำลองพฤติกรรมของ AI เลขา และทดสอบระบบตอบกลับ RAG/CAG ได้ทันที",
    
    chatHeader: "ห้องคุยจำลอง (Sandbox Chatbot)",
    inputPlaceholder: "ถามคำถาม เช่น ร้านเปิดวันไหนบ้าง? หรือ ช่วยจองคิวพรุ่งนี้บ่าย 2...",
    
    diagnosticHeader: "สถานะโหมดการตอบสนอง (Retrieval Status)",
    cagTitle: "⚡ CAG Mode Active (อ่านคลังแบบ 100%)",
    cagDesc: "เอกสารของแอดมินมีขนาดกะทัดรัด ระบบจึงโหลดคู่มือทั้งหมดเข้าสู่ Context Window โดยตรง เพื่อความถูกต้องสูงสุดและตอบสนองได้เร็วขึ้นผ่าน Prompt Caching",
    ragTitle: "🔍 RAG Mode Active (ค้นหาเซกเมนต์)",
    ragDesc: "คู่มือความรู้ของแอดมินมีขนาดใหญ่เกินเกณฑ์ ระบบสลับมาสืบค้นเฉพาะ 5 ส่วนที่เกี่ยวข้องที่สุดจากฐานข้อมูล ChromaDB มาตอบแบบไดนามิกเพื่อประหยัด Token",
    
    citationsHeader: "เอกสารความรู้อ้างอิง (Citations)",
    noCitations: "ไม่มีแหล่งข้อมูลอ้างอิงส่งกลับในบทสนทนานี้",
    pageLabel: "หน้า",
    
    imagesHeader: "ภาพอ้างอิงประกอบ (Attached Graphics)",
    noImages: "ไม่มีภาพประกอบตรงกับข้อมูลที่ค้นพบ",
    imgLabel: "ภาพประกอบ",
    imgLoadError: "ไม่สามารถโหลดภาพได้",
    sendMessage: "ส่งข้อความ"
  },
  en: {
    welcomeAssistant: "Hello! Welcome to the AI Business Assistant sandbox. You can try asking questions about services, prices, promotions, or try making a booking to test the system flow.",
    chatError: "Failed to receive chat response",
    systemFail: "❌ Sorry, the system is temporarily offline:",
    thinking: "🤖 Assistant is thinking...",
    
    title: "Chat Sandbox",
    subtitle: "Interact with the AI chatbot to test its behavior and RAG/CAG retrieval response in real time.",
    
    chatHeader: "Sandbox Chatbot",
    inputPlaceholder: "Ask a question like: When are you open? or Book a slot tomorrow at 2 PM...",
    
    diagnosticHeader: "Retrieval Status",
    cagTitle: "⚡ CAG Mode Active (100% Context Loaded)",
    cagDesc: "The business documents are compact. The system loaded the entire manual into the context window directly for maximum accuracy and speed via Prompt Caching.",
    ragTitle: "🔍 RAG Mode Active (ChromaDB Vector Search)",
    ragDesc: "The business manual is large. The system dynamically retrieves the top 5 most relevant segments from ChromaDB to save tokens.",
    
    citationsHeader: "Citations",
    noCitations: "No citations returned for this conversation.",
    pageLabel: "page",
    
    imagesHeader: "Attached Graphics",
    noImages: "No graphics match the retrieved information.",
    imgLabel: "Graphics",
    imgLoadError: "Failed to load graphic",
    sendMessage: "Send message"
  }
};

const ChatSandbox = ({ tenantId, lang }) => {
  const t = translations[lang || 'th'];
  const [messages, setMessages] = useState(() => [
    { role: 'assistant', content: translations[lang || 'th'].welcomeAssistant }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresHuman, setRequiresHuman] = useState(false);
  const [diagnostic, setDiagnostic] = useState({
    mode: 'cag',
    citations: [],
    images: []
  });
  
  const chatEndRef = useRef(null);
  const sessionId = `admin_sandbox_${tenantId}`;

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sync initial message on language change if it is the only message
  useEffect(() => {
    setMessages((current) => (
      current.length === 1 && (current[0].content === translations.th.welcomeAssistant || current[0].content === translations.en.welcomeAssistant)
        ? [{ role: 'assistant', content: t.welcomeAssistant }]
        : current
    ));
  }, [t.welcomeAssistant]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim() || loading) return;

    const userText = inputMsg.trim();
    setInputMsg('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);
    setRequiresHuman(false);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_message: userText,
          session_id: sessionId,
          tenant_id: tenantId
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || t.chatError);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.ai_response, images: data.images || [] }]);
      setRequiresHuman(data.requires_human || false);
      
      setDiagnostic({
        mode: data.mode || 'rag',
        citations: data.citations || [],
        images: data.images || []
      });
      
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `${t.systemFail} ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in text-left h-full p-6 md:p-8 w-full max-w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">{t.title}</h1>
        <p className="text-sm text-default-400 mt-1">{t.subtitle}</p>
      </div>

      {/* Two Columns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1.5fr] gap-6" style={{ height: 'calc(100vh - 210px)' }}>
        
        {/* Left Column: Chat Bubble Area */}
        <Card className="bg-content1/20 backdrop-blur-md border border-divider shadow-md rounded-2xl flex flex-col h-full overflow-hidden">
          {/* Chat Header */}
          <div className="px-5 py-4 border-b border-divider flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-success rounded-full animate-pulse"></span>
            <h3 className="text-sm font-semibold text-foreground">
              {t.chatHeader}
            </h3>
            <span className="text-xs text-default-400 ml-auto font-mono">
              ID: {sessionId}
            </span>
          </div>

          {/* Bubbles List */}
          <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-default-50/30">
            {messages.flatMap((msg, idx) => {
              // Mirror real LINE behaviour: assistant replies with '---' become multiple bubbles
              if (msg.role !== 'user' && typeof msg.content === 'string' && msg.content.includes('---')) {
                const parts = msg.content.split('---').map(p => p.trim()).filter(Boolean);
                return parts.map((part, pIdx) => ({
                  key: `${idx}-${pIdx}`,
                  role: msg.role,
                  content: part,
                  images: pIdx === parts.length - 1 ? msg.images : undefined
                }));
              }
              return [{ key: `${idx}`, role: msg.role, content: msg.content, images: msg.images }];
            }).map((msg) => (
              <div
                key={msg.key}
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed whitespace-pre-line shadow-md ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-primary to-indigo-700 text-white rounded-2xl rounded-tr-sm'
                      : 'bg-content1/60 backdrop-blur-sm text-foreground border border-divider rounded-2xl rounded-tl-sm'
                  }`}
                >
                  <div>{msg.content}</div>
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.images.map((imgUrl, imgIdx) => (
                        <div key={imgIdx} className="relative group rounded-lg overflow-hidden border border-divider max-w-[180px] max-h-[110px] bg-slate-100 dark:bg-slate-900">
                          <img 
                            src={imgUrl} 
                            alt="Attachment" 
                            className="w-full h-full object-cover max-w-[180px] max-h-[110px] hover:opacity-90 transition-opacity cursor-pointer"
                            onClick={() => window.open(imgUrl, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-content1/60 backdrop-blur-sm border border-divider text-default-400 rounded-2xl rounded-tl-sm px-5 py-3 text-xs">
                  {t.thinking}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Human Intervention Required Banner */}
          {requiresHuman && (
            <div className="bg-red-500/10 border-t border-divider text-red-500 text-xs font-bold px-5 py-3 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <span>{lang === 'th' ? 'AI ยกเคสนี้ให้เจ้าหน้าที่ — บน LINE บอทจะหยุดตอบจนกว่าแอดมินจะปลุก AI' : 'AI handed this off to a human — on LINE the bot pauses until an admin resumes it.'}</span>
              </div>
              <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                {lang === 'th' ? 'ต้องการผู้ช่วยตอบ' : 'Intervention Needed'}
              </span>
            </div>
          )}

          {/* Chat Form Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-divider bg-default-50/50 flex gap-3">
            <Input
              type="text"
              placeholder={t.inputPlaceholder}
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button 
              type="submit" 
              color="primary" 
              isIconOnly 
              aria-label={t.sendMessage}
              title={t.sendMessage}
              disabled={loading || !inputMsg.trim()} 
              className="w-12 h-12 rounded-xl cursor-pointer"
            >
              <Send size={18} />
            </Button>
          </form>
        </Card>

        {/* Right Column: AI Diagnostics */}
        <Card className="bg-content1/20 backdrop-blur-md border border-divider shadow-md rounded-2xl p-6 flex flex-col gap-6 h-full overflow-y-auto">
          <CardContent className="p-0 flex flex-col gap-6">
            {/* Section 1: Active Mode Indicator */}
            <div>
              <h4 className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">
                {t.diagnosticHeader}
              </h4>
              
              {diagnostic.mode === 'cag' ? (
                <div className="bg-success/5 border border-success/25 rounded-xl p-4 flex gap-3 shadow-sm shadow-success/10">
                  <Zap size={24} className="text-success shrink-0 drop-shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{t.cagTitle}</h3>
                    <p className="text-xs text-default-400 leading-relaxed">
                      {t.cagDesc}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1A365D]/5 border border-cyan-500/20 rounded-xl p-4 flex gap-3 shadow-sm">
                  <Search size={24} className="text-cyan-500 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{t.ragTitle}</h3>
                    <p className="text-xs text-default-400 leading-relaxed">
                      {t.ragDesc}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Citations */}
            <div>
              <h4 className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">
                {t.citationsHeader}
              </h4>
              
              {diagnostic.citations.length === 0 ? (
                <div className="py-5 border border-dashed border-divider rounded-xl text-center text-default-400 text-xs">
                  {t.noCitations}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {diagnostic.citations.map((cite, idx) => (
                    <div
                      key={idx}
                      className="bg-default-50/50 border border-divider rounded-xl p-3 text-xs"
                    >
                      <div className="flex items-center gap-2 text-cyan-500 font-medium mb-2">
                        <FileText size={14} />
                        <span>{cite.document_name} ({t.pageLabel} {cite.page_number})</span>
                      </div>
                      <p className="text-default-400 italic leading-relaxed">
                        "{cite.text_snippet}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Extracted Images */}
            <div>
              <h4 className="text-xs text-default-400 font-semibold uppercase tracking-wider mb-3">
                {t.imagesHeader}
              </h4>
              
              {diagnostic.images.length === 0 ? (
                <div className="py-5 border border-dashed border-divider rounded-xl text-center text-default-400 text-xs">
                  {t.noImages}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {diagnostic.images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="bg-black border border-divider rounded-xl overflow-hidden h-[120px] relative"
                    >
                      <img
                        src={imgUrl}
                        alt="Ref Image"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('[data-img-fallback]');
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[9px] text-cyan-400 flex items-center gap-1">
                        <ImageIcon size={10} />
                        {t.imgLabel}
                      </div>
                      {/* Fallback box if image fails to load */}
                      <div data-img-fallback className="hidden w-full h-full items-center justify-center text-default-400 text-[11px] text-center p-2">
                        ⚠️ {t.imgLoadError} <br />
                        {imgUrl}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatSandbox;
