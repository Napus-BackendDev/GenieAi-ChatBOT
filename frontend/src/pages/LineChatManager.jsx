import { useState, useEffect, useRef } from 'react';
import { Search, Phone, Video, MoreVertical, Paperclip, Mic, Send, CheckCheck, Edit, Filter, User, Bot, Smile } from 'lucide-react';
import { Button } from '@heroui/react';

const STICKER_LIST = [
  { packageId: "446", stickerId: "1988", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/1988/android/sticker.png" },
  { packageId: "446", stickerId: "1989", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/1989/android/sticker.png" },
  { packageId: "446", stickerId: "1990", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/1990/android/sticker.png" },
  { packageId: "446", stickerId: "1991", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/1991/android/sticker.png" },
  { packageId: "446", stickerId: "1992", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/1992/android/sticker.png" },
  { packageId: "446", stickerId: "1993", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/1993/android/sticker.png" },
  { packageId: "446", stickerId: "1994", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/1994/android/sticker.png" },
  { packageId: "446", stickerId: "1995", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/1995/android/sticker.png" },
  
  { packageId: "789", stickerId: "10855", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/10855/android/sticker.png" },
  { packageId: "789", stickerId: "10856", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/10856/android/sticker.png" },
  { packageId: "789", stickerId: "10857", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/10857/android/sticker.png" },
  { packageId: "789", stickerId: "10858", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/10858/android/sticker.png" },
  { packageId: "789", stickerId: "10859", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/10859/android/sticker.png" },
  { packageId: "789", stickerId: "10860", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/10860/android/sticker.png" },
  { packageId: "789", stickerId: "10861", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/10861/android/sticker.png" },
  { packageId: "789", stickerId: "10862", preview: "https://stickershop.line-scdn.net/stickershop/v1/sticker/10862/android/sticker.png" }
];

const translations = {
  th: {
    search: "ค้นหา...",
    activeNow: "ใช้งานอยู่ตอนนี้",
    typeMessage: "พิมพ์ข้อความ...",
    noSessions: "ไม่พบข้อมูลแชท",
    noChatSelected: "เลือกแชทเพื่อเริ่มสนทนา",
    selectAChat: "กรุณาเลือกผู้ติดต่อจากรายการด้านซ้ายเพื่อดูข้อความ",
    replyError: "ส่งข้อความไม่สำเร็จ",
    loadError: "โหลดข้อมูลล้มเหลว",
    activeText: "กำลังใช้งาน",
    today: "วันนี้",
    yesterday: "เมื่อวาน"
  },
  en: {
    search: "search",
    activeNow: "Active now",
    typeMessage: "Type a message",
    noSessions: "No chat sessions found",
    noChatSelected: "Select a chat to start messaging",
    selectAChat: "Please select a contact from the list on the left to view messages.",
    replyError: "Failed to send message",
    loadError: "Failed to load chats",
    activeText: "Active",
    today: "Today",
    yesterday: "Yesterday"
  }
};

const LineChatManager = ({ tenantId, lang }) => {
  const t = translations[lang || 'th'];
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [togglingAI, setTogglingAI] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const chatEndRef = useRef(null);

  const fetchSessions = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/chat/sessions?tenant_id=${tenantId || 'default'}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        
        // Update selected session details if it's currently selected
        if (selectedSession) {
          const updated = data.find(s => s.id === selectedSession.id);
          if (updated) {
            setSelectedSession(updated);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching chat sessions:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSessions(true);
  }, [tenantId]);

  // Polling every 5 seconds to get new LINE messages
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSessions(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedSession]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedSession?.history]);

  const handleSendSticker = async (packageId, stickerId) => {
    setShowStickers(false);
    if (!selectedSession || sending) return;
    
    const stickerPayload = `[[STICKER:${packageId}:${stickerId}]]`;
    setSending(true);
    
    const optimisticMessage = { role: 'assistant', content: stickerPayload, timestamp: new Date().toISOString() };
    const updatedHistory = [...(selectedSession.history || []), optimisticMessage];
    
    setSelectedSession(prev => ({
      ...prev,
      lastMessage: "ส่งสติกเกอร์ LINE",
      time: "Active now",
      history: updatedHistory
    }));

    setSessions(prev => prev.map(s => {
      if (s.id === selectedSession.id) {
        return {
          ...s,
          lastMessage: "ส่งสติกเกอร์ LINE",
          time: "Active now",
          history: updatedHistory
        };
      }
      return s;
    }));

    try {
      const res = await fetch('/api/chat/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: selectedSession.id,
          message: stickerPayload,
          tenant_id: tenantId || 'default'
        })
      });

      if (!res.ok) {
        throw new Error(t.replyError);
      }

      // A sticker toggles the AI on/off — reflect the new state the backend returns
      // so the "Human mode" pill and banner update immediately.
      const data = await res.json().catch(() => ({}));
      if (typeof data.requires_human === 'boolean') {
        const paused = data.requires_human;
        setSelectedSession(prev => (prev ? { ...prev, requires_human: paused } : prev));
        setSessions(prev => prev.map(s => (s.id === selectedSession.id ? { ...s, requires_human: paused } : s)));
      }

      fetchSessions(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleSelectSession = async (session) => {
    setSelectedSession(session);
    setShowStickers(false);
    // Clear unread in frontend state immediately to feel snappy
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, unread: 0 } : s));
    
    // Call backend to clear unread key in Redis
    try {
      await fetch('/api/chat/clear-unread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id })
      });
    } catch (err) {
      console.error("Failed to clear unread:", err);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedSession || sending) return;

    const messageContent = replyText.trim();
    setReplyText('');
    setSending(true);

    // Optimistically update the UI to keep it ultra-fast
    const optimisticMessage = { role: 'assistant', content: messageContent, timestamp: new Date().toISOString() };
    const updatedHistory = [...(selectedSession.history || []), optimisticMessage];
    
    setSelectedSession(prev => ({
      ...prev,
      lastMessage: messageContent,
      time: "Active now",
      history: updatedHistory
    }));

    setSessions(prev => prev.map(s => {
      if (s.id === selectedSession.id) {
        return {
          ...s,
          lastMessage: messageContent,
          time: "Active now",
          history: updatedHistory
        };
      }
      return s;
    }));

    try {
      const res = await fetch('/api/chat/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: selectedSession.id,
          message: messageContent,
          tenant_id: tenantId || 'default'
        })
      });

      if (!res.ok) {
        throw new Error(t.replyError);
      }
      
      // Refresh database status in background
      fetchSessions(false);
    } catch (err) {
      console.error(err);
      // Revert optimistic update or show error bubble
      const errorMsg = { role: 'system', content: `❌ ${t.replyError}: ${err.message}` };
      setSelectedSession(prev => ({
        ...prev,
        history: [...prev.history, errorMsg]
      }));
    } finally {
      setSending(false);
    }
  };

  // Pause (human mode) or resume the AI for the selected conversation
  const setAIMode = async (paused) => {
    if (!selectedSession || togglingAI) return;
    setTogglingAI(true);

    // Optimistic UI update
    setSelectedSession(prev => (prev ? { ...prev, requires_human: paused } : prev));
    setSessions(prev => prev.map(s => (s.id === selectedSession.id ? { ...s, requires_human: paused } : s)));

    try {
      const res = await fetch(paused ? '/api/chat/pause' : '/api/chat/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: selectedSession.id, tenant_id: tenantId || 'default' })
      });
      if (!res.ok) throw new Error('Failed to toggle AI mode');
      fetchSessions(false);
    } catch (err) {
      console.error('Failed to toggle AI mode:', err);
      // Revert on failure
      setSelectedSession(prev => (prev ? { ...prev, requires_human: !paused } : prev));
      setSessions(prev => prev.map(s => (s.id === selectedSession.id ? { ...s, requires_human: !paused } : s)));
    } finally {
      setTogglingAI(false);
    }
  };

  // Filter sessions by search query
  const filteredSessions = sessions.filter(session => {
    const nameMatch = session.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const msgMatch = session.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || msgMatch;
  });

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-slate-50/50 dark:bg-slate-950/20 font-sans border-t border-slate-100 dark:border-white/5 animate-fade-in text-left">
      
      {/* LEFT COLUMN: Chat List */}
      <div className="w-[360px] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-white/5 h-full shrink-0">
        
        {/* Search header area */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-lg font-bold text-[#1A365D] dark:text-white">
              {lang === 'th' ? 'ข้อความแชท' : 'Messages'}
            </h2>
            <div className="flex items-center gap-1">
              <Button size="sm" isIconOnly variant="light" className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Edit size={16} />
              </Button>
              <Button size="sm" isIconOnly variant="light" className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Filter size={16} />
              </Button>
            </div>
          </div>

          <div className="relative flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-white/10 rounded-xl px-3 py-2 w-full transition-all focus-within:border-[#2B6CB0]">
            <Search size={16} className="text-[#1A365D]/40 dark:text-slate-400 mr-2" />
            <input
              type="text"
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-[#1A365D] dark:text-white placeholder:text-slate-400 outline-none w-full border-none p-0"
            />
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent border-[#2B6CB0]"></div>
              <span className="text-xs font-semibold">Loading chats...</span>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-xs font-medium">
              {t.noSessions}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isSelected = selectedSession?.id === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={`p-4 flex gap-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-all relative ${
                    isSelected ? 'bg-[#E6F4F8]/60 dark:bg-slate-800 border-l-3 border-[#2B6CB0]' : ''
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={session.avatar}
                      alt={session.name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-100 dark:border-white/10"
                      onError={(e) => {
                        e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${session.id}`;
                      }}
                    />
                    {session.time === "Active now" && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-white dark:border-slate-900"></span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-[#2B6CB0] dark:text-cyan-400' : 'text-[#1A365D] dark:text-white'}`}>
                        {session.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-1">
                        {session.time}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-relaxed">
                        {session.lastMessage}
                      </p>
                      {session.unread && session.unread > 0 ? (
                        <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white font-extrabold text-[9px] px-1 shrink-0 ml-1.5 shadow-sm shadow-rose-500/20">
                          {session.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Chat Room */}
      {selectedSession ? (
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/20 h-full">
          
          {/* Active Chat Header */}
          <div className="h-16 border-b border-slate-200/60 dark:border-white/5 bg-white dark:bg-slate-900 px-5 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-3.5">
              <img
                src={selectedSession.avatar}
                alt={selectedSession.name}
                className="w-9 h-9 rounded-full object-cover border border-slate-100 dark:border-white/10"
                onError={(e) => {
                  e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedSession.id}`;
                }}
              />
              <div className="text-left">
                <h3 className="text-xs font-bold text-[#1A365D] dark:text-white leading-tight">
                  {selectedSession.name}
                </h3>
                <span className="text-[10px] text-success font-semibold flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                  {t.activeNow}
                </span>
              </div>
            </div>

            {/* Who is replying to the customer right now (clear status, not a button) */}
            <div
              className={`hidden sm:flex items-center gap-2 px-3.5 h-8 rounded-full text-[11px] font-bold border ${
                selectedSession.requires_human
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                  : 'bg-[#38A169]/10 text-[#38A169] border-[#38A169]/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${selectedSession.requires_human ? 'bg-amber-500' : 'bg-[#38A169] animate-pulse'}`}></span>
              {selectedSession.requires_human
                ? (lang === 'th' ? '🙋 แอดมินกำลังตอบลูกค้า' : '🙋 Admin is replying')
                : (lang === 'th' ? '🤖 AI กำลังตอบลูกค้า' : '🤖 AI is replying')}
            </div>

            <div className="flex items-center gap-1.5">
              {/* AI on/off toggle for this conversation */}
              <button
                type="button"
                onClick={() => setAIMode(!selectedSession.requires_human)}
                disabled={togglingAI}
                title={selectedSession.requires_human
                  ? (lang === 'th' ? 'AI หยุดอยู่ — กดเพื่อปลุก AI' : 'AI paused — click to resume')
                  : (lang === 'th' ? 'AI ทำงานอยู่ — กดเพื่อรับเรื่องเอง' : 'AI active — click to take over')}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-bold border transition-all cursor-pointer disabled:opacity-60 ${
                  selectedSession.requires_human
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20'
                    : 'bg-[#38A169]/10 text-[#38A169] border-[#38A169]/30 hover:bg-[#38A169]/20'
                }`}
              >
                <Bot size={13} />
                {selectedSession.requires_human
                  ? (lang === 'th' ? 'โหมดคนดูแล' : 'Human mode')
                  : (lang === 'th' ? 'AI ทำงาน' : 'AI active')}
              </button>
              <Button size="sm" isIconOnly variant="light" className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Phone size={16} />
              </Button>
              <Button size="sm" isIconOnly variant="light" className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Video size={16} />
              </Button>
              <Button size="sm" isIconOnly variant="light" className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <MoreVertical size={16} />
              </Button>
            </div>
          </div>
          
          {/* Human mode banner: AI is paused, admin is handling this chat */}
          {selectedSession.requires_human && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">🙋</span>
                <span>{lang === 'th' ? 'AI หยุดชั่วคราว — คุณกำลังดูแลเคสนี้เอง' : 'AI paused — you are handling this conversation.'}</span>
              </div>
              <button
                type="button"
                onClick={() => setAIMode(false)}
                disabled={togglingAI}
                className="flex items-center gap-1.5 text-[11px] bg-[#38A169] hover:bg-[#38A169]/90 text-white px-3 py-1 rounded-full font-extrabold shadow-sm shrink-0 cursor-pointer transition-colors disabled:opacity-60"
              >
                <Bot size={12} />
                {lang === 'th' ? 'ปลุก AI ให้ทำงานต่อ' : 'Resume AI'}
              </button>
            </div>
          )}

          {/* Conversation history bubbles */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 bg-default-50/10">
            {selectedSession.history && selectedSession.history.flatMap((msg, idx) => {
              const isAssistant = msg.role === 'assistant';
              const isSystem = msg.role === 'system';
              
              if (isSystem) {
                return [{
                  key: `system-${idx}`,
                  role: msg.role,
                  content: msg.content
                }];
              }

              if (isAssistant && msg.content.includes('---')) {
                return msg.content.split('---').map((part, pIdx) => ({
                  key: `assistant-${idx}-${pIdx}`,
                  role: msg.role,
                  content: part.trim()
                })).filter(item => item.content);
              }

              return [{
                key: `msg-${idx}`,
                role: msg.role,
                content: msg.content
              }];
            }).map((msg) => {
              const isAssistant = msg.role === 'assistant';
              const isSystem = msg.role === 'system';
              
              if (isSystem) {
                return (
                  <div key={msg.key} className="flex justify-center my-1.5">
                    <span className="bg-danger/10 text-danger border border-danger/25 text-[10px] px-3.5 py-1 rounded-full font-bold">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.key}
                  className={`flex w-full ${isAssistant ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex flex-col max-w-[70%] ${isAssistant ? 'items-end' : 'items-start'}`}>
                    {msg.content.startsWith('[[STICKER:') && msg.content.endsWith(']]') ? (
                      (() => {
                        const parts = msg.content.substring(10, msg.content.length - 2).split(':');
                        const stickerId = parts[1];
                        return (
                          <img 
                            src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`}
                            alt="LINE Sticker"
                            className="w-24 h-24 object-contain my-1 hover:scale-105 transition-transform"
                          />
                        );
                      })()
                    ) : (
                      <div
                        className={`px-4 py-3 text-xs leading-relaxed whitespace-pre-line shadow-sm border ${
                          isAssistant
                            ? 'bg-[#E9D8FD] dark:bg-purple-950/80 text-purple-950 dark:text-purple-100 border-purple-200/50 dark:border-purple-900/30 rounded-2xl rounded-tr-none text-left'
                            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200/50 dark:border-white/5 rounded-2xl rounded-tl-none text-left'
                        }`}
                      >
                        {msg.content}
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Message Composer Box */}
          <form onSubmit={handleSendReply} className="p-4 border-t border-slate-200/60 dark:border-white/5 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0 relative">
            {showStickers && (
              <div className="absolute bottom-16 left-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-4 shadow-xl w-64 max-h-60 overflow-y-auto z-50 animate-fade-in text-left">
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{lang === 'th' ? 'สติกเกอร์ LINE' : 'LINE Stickers'}</h4>
                <div className="grid grid-cols-4 gap-2">
                  {STICKER_LIST.map((stk, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendSticker(stk.packageId, stk.stickerId)}
                      className="hover:scale-110 active:scale-95 transition-transform p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <img src={stk.preview} alt="Sticker Preview" className="w-8 h-8 object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <Button 
              type="button"
              size="sm" 
              isIconOnly 
              variant="light" 
              onClick={() => setShowStickers(!showStickers)}
              className={`hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${showStickers ? 'text-[#2B6CB0]' : 'text-slate-400'}`}
            >
              <Smile size={18} />
            </Button>
            
            <input
              type="text"
              placeholder={t.typeMessage}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              disabled={sending}
              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-[#1A365D] dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#2B6CB0]"
            />

            <Button
              type="submit"
              color="primary"
              isIconOnly
              disabled={sending || !replyText.trim()}
              className="w-10 h-10 rounded-xl cursor-pointer bg-[#2B6CB0] hover:bg-[#2B6CB0]/90 font-bold shadow-md shadow-[#2B6CB0]/15 shrink-0"
            >
              <Send size={15} />
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/20 dark:bg-slate-950/10 p-8">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-white/5 flex items-center justify-center mb-4 text-[#2B6CB0]/65 dark:text-cyan-400/65 shadow-inner">
            <User size={30} />
          </div>
          <h3 className="text-sm font-bold text-[#1A365D]/80 dark:text-white/80 mb-1">
            {t.noChatSelected}
          </h3>
          <p className="text-xs text-slate-400 text-center max-w-sm">
            {t.selectAChat}
          </p>
        </div>
      )}
    </div>
  );
};

export default LineChatManager;
