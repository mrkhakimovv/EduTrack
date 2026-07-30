import { useState, useEffect } from 'react';
import { Student, Group } from '../lib/store';
import { cn } from '../lib/utils';
import { X, Check } from 'lucide-react';

interface StudentModalProps {
  initialData?: Student | null;
  groups: Group[];
  onClose: () => void;
  onSave: (student: Omit<Student, "id" | "createdAt">) => void;
}

export function StudentModal({ initialData, groups, onClose, onSave }: StudentModalProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupPricing, setGroupPricing] = useState<Record<string, { monthly: string, firstMonth: string }>>({});

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.fullName);
      setPhone(initialData.phone);
      setParentPhone(initialData.parentPhone);
      setSchool(initialData.school);
      setGrade(initialData.grade);
      setGroupIds(initialData.groupIds || []);
      setJoinDate(initialData.joinDate);
      
      if (initialData.groupPricing) {
        const pricing: Record<string, { monthly: string, firstMonth: string }> = {};
        for (const k in initialData.groupPricing) {
          pricing[k] = {
            monthly: initialData.groupPricing[k].monthly.toString(),
            firstMonth: initialData.groupPricing[k].firstMonth.toString()
          };
        }
        setGroupPricing(pricing);
      } else {
        // Fallback for older students without groupPricing
        const pricing: Record<string, { monthly: string, firstMonth: string }> = {};
        // If they have only 1 group, give it all to that group.
        // If more, just distribute it evenly or give the global to every group as a fallback (they can edit it).
        const monthlyPerGroup = Math.round(initialData.monthlyPayment / Math.max(1, (initialData.groupIds || []).length));
        const firstMonthPerGroup = Math.round(initialData.firstMonthPayment / Math.max(1, (initialData.groupIds || []).length));
        (initialData.groupIds || []).forEach(gid => {
          pricing[gid] = {
            monthly: monthlyPerGroup.toString(),
            firstMonth: firstMonthPerGroup.toString()
          };
        });
        setGroupPricing(pricing);
      }
    }
  }, [initialData]);

  const handleSave = () => {
    if (!fullName.trim() || groupIds.length === 0) return;
    
    // Validate that all selected groups have pricing
    for (const gid of groupIds) {
      if (!groupPricing[gid]?.monthly) return;
    }

    const pricingOutput: Record<string, { monthly: number, firstMonth: number }> = {};
    for (const gid of groupIds) {
      pricingOutput[gid] = {
        monthly: parseInt(groupPricing[gid].monthly, 10) || 0,
        firstMonth: parseInt(groupPricing[gid].firstMonth, 10) || 0
      };
    }
    
    // calculate backward compatibility fields
    const totalFirstMonth = groupIds.reduce((sum, gid) => sum + pricingOutput[gid].firstMonth, 0);
    const totalMonthly = groupIds.reduce((sum, gid) => sum + pricingOutput[gid].monthly, 0);

    onSave({
      fullName: fullName.trim(),
      monthlyPayment: totalMonthly,
      phone,
      parentPhone,
      school,
      grade,
      groupIds,
      joinDate,
      firstMonthPayment: totalFirstMonth,
      groupPricing: pricingOutput
    });
  };

  const toggleGroup = (id: string) => {
    setGroupIds(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        return prev.filter(x => x !== id);
      } else {
        const group = groups.find(g => g.id === id);
        setGroupPricing(p => ({
          ...p,
          [id]: {
            monthly: group?.monthlyPayment ? group.monthlyPayment.toString() : "",
            firstMonth: "" // Will be entered string 0 if empty? better default to 0
          }
        }));
        return [...prev, id];
      }
    });
  };

  const updatePricing = (id: string, field: 'monthly' | 'firstMonth', value: string) => {
    setGroupPricing(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-modal rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
        <div className="sticky top-0 bg-sys-modal z-10 flex items-center justify-between xl:pt-2 mb-4 pb-2 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">
            {initialData ? "O'quvchini tahrirlash" : "O'quvchi qo'shish"}
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm text-white/70 mb-1 ml-1">Ism Familiya *</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1 ml-1">Telefon raqami</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1 ml-1">Ota-ona raqami</label>
            <input
              type="tel"
              value={parentPhone}
              onChange={e => setParentPhone(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-white/70 mb-1 ml-1">Maktab</label>
              <input
                type="text"
                value={school}
                onChange={e => setSchool(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1 ml-1">Sinf</label>
              <input
                type="text"
                value={grade}
                onChange={e => setGrade(e.target.value)}
                placeholder="Masalan: 9-A"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1 ml-1">Kelgan sana</label>
            <input
              type="date"
              value={joinDate}
              onChange={e => setJoinDate(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50 [color-scheme:dark]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm text-white/70 mb-2 ml-1">Guruhlar</label>
            <div className="flex flex-wrap gap-2">
              {groups.length === 0 ? (
                <span className="text-white/40 text-sm italic">Hali guruhlar yo'q</span>
              ) : (
                groups.map((group) => {
                  const isActive = groupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      onClick={() => toggleGroup(group.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                        isActive 
                          ? "bg-accent/20 border-accent/50 text-accent" 
                          : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                      )}
                    >
                      {isActive && <Check className="h-3.5 w-3.5" />}
                      {group.name}
                    </button>
                  )
                })
              )}
            </div>
            
            {groupIds.length > 0 && (
              <div className="mt-4 space-y-3">
                <label className="block text-sm text-white/70 ml-1">Tanlangan guruhlar uchun to'lov</label>
                {groupIds.map(gid => {
                  const group = groups.find(g => g.id === gid);
                  if (!group) return null;
                  const pricing = groupPricing[gid] || { monthly: "", firstMonth: "" };
                  
                  return (
                    <div key={gid} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col sm:flex-row gap-3">
                      <div className="sm:w-1/3 flex items-center shrink-0">
                        <span className="text-sm font-medium text-white/90 truncate">{group.name}</span>
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-white/50 mb-1 ml-1">Doimiy to'lov</label>
                          <input
                            type="number"
                            value={pricing.monthly}
                            onChange={e => updatePricing(gid, 'monthly', e.target.value)}
                            placeholder="Masalan: 300000"
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1 ml-1">Birinchi oy u-n</label>
                          <input
                            type="number"
                            value={pricing.firstMonth}
                            onChange={e => updatePricing(gid, 'firstMonth', e.target.value)}
                            placeholder="Masalan: 150000"
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 sticky bottom-0 bg-sys-modal pt-4 xl:pb-2 border-t border-white/5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 transition-colors">
            Bekor qilish
          </button>
          <button 
            onClick={handleSave} 
            disabled={!fullName.trim() || groupIds.length === 0}
            className="px-6 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-accent/20"
          >
            {initialData ? "Saqlash" : "Qo'shish"}
          </button>
        </div>
      </div>
    </div>
  );
}
