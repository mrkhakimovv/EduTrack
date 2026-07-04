import { useState, useEffect } from 'react';
import { Group, DAY_NAMES } from '../lib/store';
import { cn } from '../lib/utils';
import { X } from 'lucide-react';

interface GroupModalProps {
  initialData?: Group | null;
  onClose: () => void;
  onSave: (group: Omit<Group, "id">) => void;
}

export function GroupModal({ initialData, onClose, onSave }: GroupModalProps) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [createdAt, setCreatedAt] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setTime(initialData.time);
      setDays(initialData.days);
      setMonthlyPayment(initialData.monthlyPayment?.toString() || "");
      if (initialData.createdAt) {
        setCreatedAt(initialData.createdAt.split('T')[0]);
      }
    }
  }, [initialData]);

  const toggleDay = (d: number) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    
    // Convert YYYY-MM-DD back to an ISO string or just store it.
    // Assuming createdAt in store can be a simple date string, but for consistency we can append the time.
    let createdIso = createdAt;
    if (createdAt.length === 10) {
      // It's just a date, append current time to make it valid ISO if needed, or keep it.
      // But standard createdAt is ISO string. 
      createdIso = new Date(createdAt + 'T12:00:00Z').toISOString();
    }
    
    onSave({ 
      name: name.trim(), 
      time, 
      days,
      monthlyPayment: monthlyPayment ? parseInt(monthlyPayment.replace(/\D/g, ''), 10) : undefined,
      createdAt: createdIso
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md glass-modal rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {initialData ? "Guruhni tahrirlash" : "Guruh yaratish"}
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1 ml-1">Guruh nomi *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Masalan: Ingliz tili - Beginners"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1 ml-1">Oylik to'lov summasi</label>
            <input
              type="text"
              value={monthlyPayment}
              onChange={e => setMonthlyPayment(e.target.value)}
              placeholder="Masalan: 300000"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1 ml-1">Dars vaqti</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50 [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1 ml-1">Guruh ochilgan sana (Yaratilish sanasi)</label>
            <input
              type="date"
              value={createdAt}
              onChange={e => setCreatedAt(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50 [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2 ml-1">Dars kunlari</label>
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((day, idx) => {
                const isActive = days.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                      isActive 
                        ? "bg-primary/20 border-primary/50 text-primary" 
                        : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 transition-colors">
            Bekor qilish
          </button>
          <button 
            onClick={handleSave} 
            disabled={!name.trim()}
            className="px-6 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {initialData ? "Saqlash" : "Yaratish"}
          </button>
        </div>
      </div>
    </div>
  );
}
