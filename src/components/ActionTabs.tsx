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
    <div className="w-full flex-1 flex flex-col gap-6 overflow-hidden">
      <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const showPendingBadge = id === 'tushum' && pendingPaymentsCount > 0;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id.toString() as TabId)}
              className={cn(
                "flex whitespace-nowrap items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold transition-all shrink-0 cursor-pointer",
                isActive 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "bg-white/5 text-white/90 hover:bg-white/10"
              )}
            >
              <Icon className="h-4 w-4" />
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

      <div className={cn(
        "flex-1 rounded-3xl overflow-hidden flex flex-col mb-8",
        (activeTab === 'attendance' || activeTab === 'payment') ? "md:glass-card" : "glass-card"
      )}>
        {children}
      </div>
    </div>
  );
}
