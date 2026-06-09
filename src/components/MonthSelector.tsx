import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTH_NAMES } from '../lib/store';
import { cn } from '../lib/utils';

interface MonthSelectorProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

export function MonthSelector({ year, month, onYearChange, onMonthChange }: MonthSelectorProps) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/70">{year} - Yil va oy tanlash</h3>
        <div className="flex gap-1">
          <button
            onClick={() => onYearChange(year - 1)}
            className="p-1 hover:bg-white/10 rounded-md transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onYearChange(year + 1)}
            className="p-1 hover:bg-white/10 rounded-md transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Months grid */}
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, idx) => {
            const isActive = idx === month;
            return (
              <button
                key={name}
                onClick={() => onMonthChange(idx)}
                className={cn(
                  "py-1.5 px-2 text-[10px] rounded-lg transition-all duration-200",
                  isActive
                    ? "border border-blue-500/50 bg-blue-600/30 font-bold"
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
