import { useState, useEffect } from 'react';
import { Group, DAY_NAMES } from '../lib/store';
import { cn } from '../lib/utils';
import { X, User } from 'lucide-react';

interface GroupModalProps {
  initialData?: Group | null;
  teachers?: any[];
  defaultTeacherId?: string;
  canSelectTeacher?: boolean;
  onClose: () => void;
  onSave: (group: Omit<Group, "id">) => void;
}

export function GroupModal({
  initialData,
  teachers = [],
  defaultTeacherId,
  canSelectTeacher = false,
  onClose,
  onSave
}: GroupModalProps) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [createdAt, setCreatedAt] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setTime(initialData.time);
      setDays(initialData.days && initialData.days.length > 0 ? initialData.days : [1, 3, 5]);
      setMonthlyPayment(initialData.monthlyPayment?.toString() || "");
      
      const existingTId =
        initialData.teacherId ||
        (defaultTeacherId && defaultTeacherId !== 'all' && defaultTeacherId !== 'none' ? defaultTeacherId : "") ||
        (teachers.length > 0 ? (teachers[0].uid || teachers[0].id) : "");
      setTeacherId(existingTId);
      const matched = teachers.find(t => (t.uid || t.id) === existingTId);
      const existingTName = initialData.teacherName || matched?.fullName || "";
      setTeacherName(existingTName);

      if (initialData.createdAt) {
        setCreatedAt(initialData.createdAt.split('T')[0]);
      }
    } else {
      setDays([1, 3, 5]);
      if (defaultTeacherId && defaultTeacherId !== 'all' && defaultTeacherId !== 'none') {
        const matched = teachers.find(t => (t.uid || t.id) === defaultTeacherId);
        if (matched) {
          setTeacherId(matched.uid || matched.id);
          setTeacherName(matched.fullName);
          return;
        }
      }
      if (teachers.length > 0) {
        setTeacherId(teachers[0].uid || teachers[0].id);
        setTeacherName(teachers[0].fullName);
      }
    }
  }, [initialData, teachers, defaultTeacherId]);

  const toggleDay = (d: number) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleTeacherChange = (tId: string) => {
    setTeacherId(tId);
    if (!tId) {
      setTeacherName("");
    } else {
      const selected = teachers.find(t => t.uid === tId || t.id === tId);
      setTeacherName(selected ? selected.fullName : "");
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    
    let createdIso = createdAt;
    if (createdAt.length === 10) {
      createdIso = new Date(createdAt + 'T12:00:00Z').toISOString();
    }

    let finalTeacherId = teacherId;
    if (!finalTeacherId && teachers.length > 0) {
      finalTeacherId = (defaultTeacherId && defaultTeacherId !== 'all' && defaultTeacherId !== 'none')
        ? defaultTeacherId
        : (teachers[0].uid || teachers[0].id);
    }

    let finalTeacherName = teacherName;
    if (finalTeacherId) {
      const selected = teachers.find(t => t.uid === finalTeacherId || t.id === finalTeacherId);
      if (selected) finalTeacherName = selected.fullName;
    }
    
    onSave({ 
      name: name.trim(), 
      time, 
      days: days.length > 0 ? days : [1, 2, 3, 4, 5, 6],
      monthlyPayment: monthlyPayment ? parseInt(monthlyPayment.replace(/\D/g, ''), 10) : undefined,
      teacherId: finalTeacherId || undefined,
      teacherName: finalTeacherName || undefined,
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

          {canSelectTeacher && teachers.length > 0 && (
            <div>
              <label className="block text-sm text-white/70 mb-1 ml-1">Mas'ul o'qituvchi *</label>
              <div className="relative">
                <User className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  value={teacherId}
                  onChange={e => handleTeacherChange(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-primary/50 text-sm [color-scheme:dark]"
                >
                  {teachers.map(t => (
                    <option key={t.uid || t.id} value={t.uid || t.id}>
                      {t.fullName} ({t.subject || "O'qituvchi"})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-white/70 mb-1 ml-1">Oylik to'lov summasi</label>
            <input
              type="text"
              value={monthlyPayment}
              onChange={e => setMonthlyPayment(e.target.value.replace(/\D/g, ''))}
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
