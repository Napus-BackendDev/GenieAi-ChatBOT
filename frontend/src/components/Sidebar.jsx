import { LayoutDashboard, CalendarCheck, MessageSquare, LogOut, Store, Settings, HelpCircle, Users, Tag, Grid, MessageCircle, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { Button } from '@heroui/react';

const Sidebar = ({ activeTab, setActiveTab, user, onLogout, lang, isCollapsed, setIsCollapsed, hasIntervention }) => {
  const menuNames = {
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
      support: 'ช่วยเหลือ',
      logout: 'ออกจากระบบ'
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
      support: 'Support',
      logout: 'Log Out'
    }
  }[lang || 'th'];

  const menuItems = [
    { id: 'overview', name: menuNames.overview, icon: LayoutDashboard },
    { id: 'analytics', name: menuNames.analytics, icon: BarChart3 },
    { id: 'service', name: menuNames.service, icon: Grid },
    { id: 'info', name: menuNames.info, icon: Settings },
    { id: 'promotions', name: menuNames.promotions, icon: Tag },
    { id: 'faq', name: menuNames.faq, icon: HelpCircle },
    { id: 'staff', name: menuNames.staff, icon: Users },
    { id: 'bookings', name: menuNames.bookings, icon: CalendarCheck },
    { id: 'chat', name: menuNames.chat, icon: MessageCircle },
    { id: 'sandbox', name: menuNames.sandbox, icon: MessageSquare },
  ];

  return (
    <aside 
      className={`h-screen sticky top-0 flex flex-col bg-gradient-to-b from-[#1A365D] to-[#0F2038] text-white border-none shadow-xl z-20 shrink-0 transition-all duration-300 relative ${
        isCollapsed ? 'w-20 px-2 py-6' : 'w-[260px] p-6'
      }`}
    >
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 bg-[#2B6CB0] hover:bg-[#2b6cb0d0] border border-white/20 rounded-full w-6 h-6 flex items-center justify-center shadow-lg text-white cursor-pointer z-30 transition-transform duration-300 hover:scale-110"
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
      
      {/* Brand Header */}
      <div className={`flex items-center mb-10 px-2 relative ${isCollapsed ? 'justify-center' : 'gap-3 group'}`}>
        <div className="relative shrink-0">
          <div className="bg-white/10 rounded-xl w-10 h-10 flex items-center justify-center border border-white/15 text-cyan-400 shadow-sm">
            <Store size={20} className="text-cyan-400" />
          </div>
        </div>
        {!isCollapsed && (
          <div className="transition-opacity duration-300 overflow-hidden truncate">
            <h2 className="font-extrabold text-sm leading-tight text-white truncate w-[130px]">
              {user?.company_name || 'My Business'}
            </h2>
            <span className="text-[10px] font-bold text-cyan-400 tracking-wide uppercase">
              {user?.business_type || 'AI Assistant'}
            </span>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className={`flex flex-col gap-1.5 flex-1 ${isCollapsed ? 'items-center' : ''}`}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const showWarning = item.id === 'chat' && hasIntervention;
          return (
            <Button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              variant="light"
              isIconOnly={isCollapsed}
              className={`${isCollapsed ? 'w-11' : 'w-full'} min-w-0 h-11 rounded-xl text-sm transition-all duration-300 relative group cursor-pointer ${
                isCollapsed ? "justify-center px-0" : "justify-start gap-4 px-4"
              } ${
                isActive
                  ? "bg-[#2B6CB0] text-white font-bold shadow-md shadow-[#2B6CB0]/20"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title={isCollapsed ? item.name : ""}
            >
              {isCollapsed ? (
                <div className="relative flex items-center justify-center">
                  <Icon 
                    size={18} 
                    className={`${isActive ? "text-white animate-pulse" : "text-white/50 group-hover:text-cyan-400 transition-colors"} shrink-0`} 
                  />
                  {showWarning && (
                    <span 
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-extrabold text-white animate-bounce w-3.5 h-3.5 shadow-md border border-white/20"
                      title="Intervention Required"
                    >
                      !
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center w-full relative">
                  <Icon 
                    size={18} 
                    className={`${isActive ? "text-white animate-pulse" : "text-white/50 group-hover:text-cyan-400 transition-colors"} shrink-0`} 
                  />
                  <span className="relative z-10 ml-4">{item.name}</span>
                  {showWarning && (
                    <span 
                      className="ml-auto rounded-full bg-red-500 flex items-center justify-center text-[10px] font-extrabold text-white animate-bounce w-[18px] h-[18px] shrink-0 shadow-md border border-white/20"
                      title="Intervention Required"
                    >
                      !
                    </span>
                  )}
                </div>
              )}
            </Button>
          );
        })}
      </nav>

      {/* Footer / Settings, Support & Logout */}
      <div className={`pt-5 border-t border-white/10 flex flex-col gap-1.5 shrink-0 ${isCollapsed ? 'items-center' : ''}`}>
        
        {/* Settings button */}
        <Button
          onClick={() => setActiveTab('settings')}
          variant="light"
          isIconOnly={isCollapsed}
          className={`${isCollapsed ? 'w-11' : 'w-full'} min-w-0 h-11 rounded-xl text-sm transition-all duration-300 cursor-pointer group ${
            isCollapsed ? "justify-center px-0" : "justify-start gap-4 px-4"
          } ${
            activeTab === 'settings'
              ? "bg-[#2B6CB0] text-white font-bold shadow-md shadow-[#2B6CB0]/20"
              : "text-white/70 hover:text-white hover:bg-white/10"
          }`}
          title={isCollapsed ? menuNames.settings : ""}
        >
          <Settings size={18} className={`${activeTab === 'settings' ? "text-white" : "text-white/50 group-hover:text-cyan-400"} transition-colors`} />
          {!isCollapsed && <span>{menuNames.settings}</span>}
        </Button>

        {/* Support button */}
        <Button
          onClick={() => setActiveTab('sandbox')}
          variant="light"
          isIconOnly={isCollapsed}
          className={`${isCollapsed ? 'w-11' : 'w-full'} min-w-0 h-11 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 cursor-pointer group ${
            isCollapsed ? "justify-center px-0" : "justify-start gap-4 px-4"
          }`}
          title={isCollapsed ? menuNames.support : ""}
        >
          <HelpCircle size={18} className="text-white/50 group-hover:text-cyan-400 transition-colors" />
          {!isCollapsed && <span>{menuNames.support}</span>}
        </Button>

        {/* Logout button */}
        <Button
          onClick={onLogout}
          variant="light"
          isIconOnly={isCollapsed}
          className={`${isCollapsed ? 'w-11' : 'w-full'} min-w-0 h-11 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all duration-300 cursor-pointer group mt-2 ${
            isCollapsed ? "justify-center px-0" : "justify-start gap-4 px-4"
          }`}
          title={isCollapsed ? menuNames.logout : ""}
        >
          <LogOut size={18} className="text-red-400/80 group-hover:text-red-400 transition-colors" />
          {!isCollapsed && <span>{menuNames.logout}</span>}
        </Button>
      </div>

    </aside>
  );
};

export default Sidebar;
