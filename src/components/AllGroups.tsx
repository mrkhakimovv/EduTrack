import { useMemo, useState } from 'react';
import { AppData, DAY_NAMES_SHORT, formatSum } from '../lib/store';
import { X, Pencil, Trash2, Archive, ArchiveRestore, Upload, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

export interface AllGroupsProps {
  data: AppData;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onEditStudent: (id: string) => void;
  onDeleteStudent: (id: string) => void;
  onArchiveStudent: (id: string) => void;
}

export function AllGroups({ 
  data, 
  onClose, 
  onEdit, 
  onDelete, 
  onArchive, 
  onEditStudent,
  onDeleteStudent,
  onArchiveStudent
}: AllGroupsProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'faol' | 'arxiv'>('faol');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const filteredGroups = useMemo(() => {
    return data.groups.filter(g => !g.deletedAt && (activeTab === 'faol' ? !g.archived : g.archived));
  }, [data.groups, activeTab]);

  const activeCount = data.groups.filter(g => !g.deletedAt && !g.archived).length;
  const archivedCount = data.groups.filter(g => !g.deletedAt && g.archived).length;

  if (selectedGroupId) {
    const group = data.groups.find(g => g.id === selectedGroupId);
    if (!group) {
      setSelectedGroupId(null);
      return null;
    }

    const groupStudents = data.students.filter(s => !s.deletedAt && !s.archived && s.groupIds.includes(group.id));

    return (
      <div className="fixed inset-0 z-40 bg-sys-base/95 backdrop-blur-md overflow-y-auto w-full h-full">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-8 sticky top-0 py-4 bg-sys-base/80 backdrop-blur z-10 border-b border-white/10 gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedGroupId(null)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-white max-w-[200px] sm:max-w-xs truncate">{group.name}</h2>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-sm font-medium">{group.time}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-white/60">
                  <span>{groupStudents.length} ta o'quvchi</span>
                  <span className="hidden sm:inline">•</span>
                  <span>{formatSum(group.monthlyPayment)} / oy</span>
                  <span className="hidden sm:inline">•</span>
                  <div className="flex gap-1">
                    {group.days.map(d => (
                      <span key={d} className="px-1.5 py-0.5 rounded bg-white/5 text-[11px] uppercase tracking-wider">{DAY_NAMES_SHORT[d]}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white shrink-0">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupStudents.length === 0 ? (
              <div className="col-span-full py-16 text-center text-white/40 text-lg">
                Ushbu guruhda o'quvchilar yo'q
              </div>
            ) : (
              groupStudents.map(student => (
                <div key={student.id} className={cn("glass-card rounded-2xl p-5 hover:bg-white/[0.04] transition-colors group", student.archived && "opacity-70")}>
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg text-white/90">{student.fullName}</h3>
                    {deletingId === student.id ? (
                      <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-2 py-1">
                        <span className="text-xs text-destructive font-medium">O'chirish aniqmi?</span>
                        <button onClick={() => onDeleteStudent(student.id)} className="text-xs bg-destructive text-white px-2 py-0.5 rounded hover:bg-destructive/90 font-medium">
                          Ha
                        </button>
                        <button onClick={() => setDeletingId(null)} className="text-xs bg-white/10 text-white px-2 py-0.5 rounded hover:bg-white/20 font-medium tracking-wide">
                          Yo'q
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEditStudent(student.id)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors" title="Tahrirlash">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => onArchiveStudent(student.id)} 
                          className="p-1.5 text-white/40 hover:text-yellow-400 hover:bg-yellow-400/10 rounded transition-colors"
                          title={student.archived ? "Arxivdan chiqarish" : "Arxivlash"}
                        >
                          {student.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </button>
                        <button 
                          onClick={() => setDeletingId(student.id)} 
                          className="p-1.5 text-white/40 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-white/60 space-y-2 mb-4">
                    {student.phone && <div className="flex gap-2"><span>📞</span> <span className="text-white/80">{student.phone}</span></div>}
                    {student.school && <div className="flex gap-2"><span>🏫</span> <span className="text-white/80">{student.school} {student.grade && `(${student.grade})`}</span></div>}
                    <div className="flex gap-2"><span>📅</span> <span>{student.joinDate} dan beri</span></div>
                    <div className="flex gap-2"><span>💰</span> <span className="text-white/90 font-medium">{formatSum(student.monthlyPayment)} / oy</span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-sys-base/95 backdrop-blur-md overflow-y-auto w-full h-full">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 sticky top-0 py-4 bg-sys-base/80 backdrop-blur z-10 border-b border-white/10 gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <h2 className="text-2xl font-bold text-white">Guruhlar</h2>
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shrink-0">
              <button 
                onClick={() => setActiveTab('faol')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  activeTab === 'faol' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                )}
              >
                Faol ({activeCount})
              </button>
              <button 
                onClick={() => setActiveTab('arxiv')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  activeTab === 'arxiv' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                )}
              >
                Arxivlangan ({archivedCount})
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.length === 0 ? (
            <div className="col-span-full py-16 text-center text-white/40 text-lg">
              {activeTab === 'faol' ? "Faol guruhlar mavjud emas" : "Arxivlangan guruhlar mavjud emas"}
            </div>
          ) : (
            filteredGroups.map(group => {
              const studentsCount = data.students.filter(s => !s.deletedAt && !s.archived && s.groupIds.includes(group.id)).length;
              
              return (
                <div 
                  key={group.id} 
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, label, input')) return;
                    setSelectedGroupId(group.id);
                  }}
                  className={cn("glass-card rounded-2xl p-5 hover:bg-white/[0.04] cursor-pointer transition-colors group", group.archived && "opacity-70")}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-white/90">{group.name}</h3>
                      <p className="text-primary font-medium">{group.time || "Vaqt korsatilmagan"}</p>
                    </div>
                    {deletingId === group.id ? (
                      <div className="flex flex-col items-end gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-2 max-w-[200px]">
                        <span className="text-[11px] text-destructive font-medium text-right leading-tight">Guruhni o'chirish o'quvchilardan ham ushbu guruhni olib tashlaydi. Aniqmi?</span>
                        <div className="flex gap-2">
                          <button onClick={() => onDelete(group.id)} className="text-xs bg-destructive text-white px-2 py-1 rounded hover:bg-destructive/90 font-medium">
                            Ha
                          </button>
                          <button onClick={() => setDeletingId(null)} className="text-xs bg-white/10 text-white px-2 py-1 rounded hover:bg-white/20 font-medium">
                            Yo'q
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(group.id)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors" title="Tahrirlash">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => onArchive(group.id)} 
                          className="p-1.5 text-white/40 hover:text-yellow-400 hover:bg-yellow-400/10 rounded transition-colors"
                          title={group.archived ? "Arxivdan chiqarish" : "Arxivlash"}
                        >
                          {group.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </button>
                        <button 
                          onClick={() => setDeletingId(group.id)} 
                          className="p-1.5 text-white/40 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {group.days.map(d => (
                      <span key={d} className="px-2 py-0.5 bg-white/10 text-white/70 text-xs rounded border border-white/5 font-medium">
                        {DAY_NAMES_SHORT[d]}
                      </span>
                    ))}
                    {group.days.length === 0 && <span className="text-white/40 text-xs italic">Kunlar belgilanmagan</span>}
                  </div>

                  <div className="pt-4 border-t border-white/10 flex justify-between items-center text-sm">
                    <span className="text-white/50">O'quvchilar soni</span>
                    <span className="text-white/90 font-bold bg-white/10 px-2 py-0.5 rounded-md">{studentsCount}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
