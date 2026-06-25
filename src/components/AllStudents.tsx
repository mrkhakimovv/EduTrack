import { useMemo, useState } from 'react';
import { AppData, formatSum } from '../lib/store';
import { Search, X, Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { cn } from '../lib/utils';

interface AllStudentsProps {
  data: AppData;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

export function AllStudents({ data, onClose, onEdit, onDelete, onArchive }: AllStudentsProps) {
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'faol' | 'arxiv'>('faol');

  const uniqueSchools = useMemo(() => {
    const schools = new Set<string>();
    data.students.forEach(s => {
      if (s.school) schools.add(s.school);
    });
    return Array.from(schools).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  }, [data.students]);

  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    data.students.forEach(s => {
      if (s.grade) grades.add(s.grade);
    });
    return Array.from(grades).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  }, [data.students]);

  const filteredStudents = useMemo(() => {
    let result = data.students.filter(s => !s.deletedAt && (activeTab === 'faol' ? !s.archived : s.archived));
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(s => s.fullName.toLowerCase().includes(lower));
    }
    if (schoolFilter !== 'all') {
      result = result.filter(s => s.school === schoolFilter);
    }
    if (gradeFilter !== 'all') {
      result = result.filter(s => s.grade === gradeFilter);
    }
    return result;
  }, [search, schoolFilter, gradeFilter, data.students, activeTab]);

  const activeCount = data.students.filter(s => !s.deletedAt && !s.archived).length;
  const archivedCount = data.students.filter(s => !s.deletedAt && s.archived).length;

  return (
    <div className="fixed inset-0 z-[60] bg-sys-base/95 backdrop-blur-md overflow-y-auto w-full h-full">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 sticky top-0 py-4 bg-sys-base/80 backdrop-blur z-10 border-b border-white/10 gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <h2 className="text-2xl font-bold text-white">O'quvchilar</h2>
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

        <div className="flex flex-col md:flex-row gap-4 mb-8 max-w-4xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <input
              type="text"
              placeholder="O'quvchini izlash..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg shadow-xl shadow-black/20"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={schoolFilter}
              onChange={e => setSchoolFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 [&>option]:bg-sys-base"
            >
              <option value="all">Barcha maktablar</option>
              {uniqueSchools.map(school => (
                <option key={school} value={school}>{school}-maktab</option>
              ))}
            </select>
            <select
              value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 [&>option]:bg-sys-base"
            >
              <option value="all">Barcha sinflar</option>
              {uniqueGrades.map(grade => (
                <option key={grade} value={grade}>{grade}-sinf</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.length === 0 ? (
            <div className="col-span-full py-16 text-center text-white/40 text-lg">
              {activeTab === 'faol' ? "Faol o'quvchilar yo'q" : "Arxivlangan o'quvchilar yo'q"}
            </div>
          ) : (
            filteredStudents.map(student => (
              <div key={student.id} className={cn("glass-card rounded-2xl p-5 hover:bg-white/[0.04] transition-colors group", student.archived && "opacity-70")}>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-white/90">{student.fullName}</h3>
                  {deletingId === student.id ? (
                    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-2 py-1">
                      <span className="text-xs text-destructive font-medium">O'chirish aniqmi?</span>
                      <button onClick={() => onDelete(student.id)} className="text-xs bg-destructive text-white px-2 py-0.5 rounded hover:bg-destructive/90 font-medium">
                        Ha
                      </button>
                      <button onClick={() => setDeletingId(null)} className="text-xs bg-white/10 text-white px-2 py-0.5 rounded hover:bg-white/20 font-medium tracking-wide">
                        Yo'q
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 transition-opacity">
                      <button onClick={() => onEdit(student.id)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors" title="Tahrirlash">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => onArchive(student.id)} 
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
                  {student.phone && <div className="flex gap-2"><span>📞</span> <a href={`tel:${student.phone.replace(/[^0-9+]/g, '')}`} className="text-white/80 hover:text-white hover:underline transition-colors">{student.phone}</a></div>}
                  {student.school && <div className="flex gap-2"><span>🏫</span> <span className="text-white/80">{student.school} {student.grade && `(${student.grade})`}</span></div>}
                  <div className="flex gap-2"><span>📅</span> <span>{student.joinDate} dan beri</span></div>
                  <div className="flex gap-2"><span>💰</span> <span className="text-white/90 font-medium">{formatSum(student.monthlyPayment)} / oy</span></div>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
                  {student.groupIds.map(gid => {
                    const g = data.groups.find(x => x.id === gid);
                    return g ? (
                      <span key={gid} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded border border-primary/20">
                        {g.name}
                      </span>
                    ) : null;
                  })}
                  {student.groupIds.length === 0 && (
                    <span className="text-xs text-white/30 italic">Guruhsiz</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
