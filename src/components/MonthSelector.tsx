import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { MONTH_NAMES } from '../lib/store';
import { cn } from '../lib/utils';

interface MonthSelectorProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

export function MonthSelector({ year, month, onYearChange, onMonthChange }: MonthSelectorProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const handlePrevMonth = () => {
    if (month === 0) {
      onYearChange(year - 1);
      onMonthChange(11);
    } else {
      onMonthChange(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      onYearChange(year + 1);
      onMonthChange(0);
    } else {
      onMonthChange(month + 1);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-3.5 md:p-5 flex flex-col gap-3 md:gap-4">
      <div className="flex items-center justify-between">
        {/* Desktop title */}
        <h3 className="hidden md:block text-sm font-semibold text-white/70">{year} - Yil va oy tanlash</h3>

        {/* Mobile compact month/year stepper */}
        <div className="flex md:hidden items-center gap-1.5 flex-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white/80 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMobileExpanded(prev => !prev)}
            className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600/20 border border-blue-500/40 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>{MONTH_NAMES[month]} {year}</span>
            {mobileExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-white/60 shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-white/60 shrink-0" />
            )}
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white/80 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Year stepper (shown on desktop or when mobile grid is expanded) */}
        <div className={cn("gap-1 items-center", mobileExpanded ? "flex ml-2" : "hidden md:flex")}>
          <button
            type="button"
            onClick={() => onYearChange(year - 1)}
            className="p-1 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title="Oldingi yil"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="md:hidden text-xs font-semibold text-white/70 px-1">{year}</span>
          <button
            type="button"
            onClick={() => onYearChange(year + 1)}
            className="p-1 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title="Keyingi yil"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Months grid (Always visible on md+, collapsible on mobile) */}
      <div className={cn("flex-col gap-4", mobileExpanded ? "flex" : "hidden md:flex")}>
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, idx) => {
            const isActive = idx === month;
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onMonthChange(idx);
                  setMobileExpanded(false);
                }}
                className={cn(
                  "py-1.5 px-2 text-[11px] md:text-[10px] rounded-lg transition-all duration-200 cursor-pointer",
                  isActive
                    ? "border border-blue-500/50 bg-blue-600/30 font-bold text-white"
                    : "border border-white/10 hover:bg-white/5 text-white/80"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

