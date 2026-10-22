import { ClipboardCheck, CreditCard, AlertTriangle, BarChart3, Ban, Settings, Wallet } from 'lucide-react';
import { cn } from '../lib/utils';
import { ReactNode } from 'react';

export type TabId = 'attendance' | 'payment' | 'debtors' | 'blacklist' | 'tushum' | 'stats' | 'settings';

interface ActionTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isCenterAdmin?: boolean;
  pendingPaymentsCount?: number;
  children: ReactNode;
}

export function ActionTabs({
  activeTab,
  onTabChange,
  isCenterAdmin = false,
  pendingPaymentsCount = 0,
  children
}: ActionTabsProps) {
  const tabs = [
    { id: 'attendance', label: 'Davomat', icon: ClipboardCheck },
    { id: 'payment', label: "To'lov", icon: CreditCard },
    { id: 'debtors', label: 'Qarzdorlar', icon: AlertTriangle },
    isCenterAdmin
      ? { id: 'tushum', label: 'Tushum', icon: Wallet }
      : { id: 'blacklist', label: "Qora ro'yxat", icon: Ban },
    { id: 'stats', label: 'Statistika', icon: BarChart3 },
    { id: 'settings', label: 'Sozlamalar', icon: Settings },
  ] as const;

  return (
    <div className="w-full flex-1 flex flex-col gap-3 sm:gap-6 md:overflow-hidden min-h-[420px]">
      {/* Top Horizontal Tab Bar */}
      <div className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-1.5 sm:pb-2 scrollbar-hide shrink-0">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const showPendingBadge = id === 'tushum' && pendingPaymentsCount > 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id.toString() as TabId)}
              className={cn(
                "flex whitespace-nowrap items-center gap-2 rounded-full px-4 sm:px-6 py-2 text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer",
                isActive 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "bg-white/5 text-white/90 hover:bg-white/10"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {showPendingBadge && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[11px] font-extrabold leading-tight">
                  {pendingPaymentsCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 rounded-2xl sm:rounded-3xl md:overflow-hidden flex flex-col mb-2 md:mb-8 glass-card">
        {children}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sys-base/95 backdrop-blur-xl border-t border-white/10 px-1.5 py-1.5 flex items-center justify-around shadow-2xl">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const showPendingBadge = id === 'tushum' && pendingPaymentsCount > 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id.toString() as TabId)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl transition-all flex-1 min-w-0 cursor-pointer",
                isActive
                  ? "text-blue-400 bg-blue-500/15 font-bold"
                  : "text-white/55 hover:text-white/85"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-[10px] leading-none truncate max-w-full">{label}</span>
              {showPendingBadge && (
                <span className="absolute top-1 right-2 px-1 min-w-[16px] h-4 rounded-full bg-amber-400 text-black text-[9px] font-extrabold flex items-center justify-center">
                  {pendingPaymentsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
