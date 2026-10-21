import { useMemo, useState } from 'react';
import { AppData, formatSum, DAY_NAMES_SHORT } from '../lib/store';
import { Search, X, Pencil, Trash2, Archive, ArchiveRestore, Layers, LayoutGrid, Phone, School, Calendar, Wallet, Users } from 'lucide-react';
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
  const [groupFilter, setGroupFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'faol' | 'arxiv'>('faol');
  const [viewMode, setViewMode] = useState<'grouped' | 'cards'>('grouped');

  const activeGroups = useMemo(() => {
    return data.groups
      .filter(g => !g.deletedAt && !g.archived)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [data.groups]);

  const uniqueSchools = useMemo(() => {
    const schools = new Set<string>();
    data.students.forEach(s => {
      if (s.school) schools.add(s.school);
    });
    return Array.from(schools).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [data.students]);

  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    data.students.forEach(s => {
      if (s.grade) grades.add(s.grade);
    });
    return Array.from(grades).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [data.students]);

  const filteredStudents = useMemo(() => {
    let result = data.students.filter(s => !s.deletedAt && (activeTab === 'faol' ? !s.archived : s.archived));
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(
        s =>
          s.fullName.toLowerCase().includes(lower) ||
          (s.phone && s.phone.includes(lower)) ||
          (s.parentPhone && s.parentPhone.includes(lower))
      );
    }
    if (schoolFilter !== 'all') {
      result = result.filter(s => s.school === schoolFilter);
    }
    if (gradeFilter !== 'all') {
      result = result.filter(s => s.grade === gradeFilter);
    }
    if (groupFilter !== 'all') {
      result = result.filter(s => (s.groupIds || []).includes(groupFilter));
    }
    return result.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [search, schoolFilter, gradeFilter, groupFilter, data.students, activeTab]);

  // Group students by their groups for the "Guruhlar kesimida" view
  const groupedSections = useMemo(() => {
    const sections: Array<{
      groupId: string;
      groupName: string;
      groupTime?: string;
      groupDays?: string;
      teacherName?: string;
      students: typeof filteredStudents;
    }> = [];

    const groupsToDisplay =
      groupFilter === 'all'
        ? activeGroups
        : activeGroups.filter(g => g.id === groupFilter);

    groupsToDisplay.forEach(g => {
      const studentsInGroup = filteredStudents.filter(s => (s.groupIds || []).includes(g.id));
      if (studentsInGroup.length > 0 || groupFilter === g.id) {
        sections.push({
          groupId: g.id,
          groupName: g.name,
          groupTime: g.time,
          groupDays: (g.days || []).map(d => DAY_NAMES_SHORT[d]).join('-'),
          teacherName: g.teacherName,
          students: studentsInGroup
        });
      }
    });

    // Also include students without an active group if groupFilter === 'all'
    if (groupFilter === 'all') {
      const activeGroupIds = new Set(activeGroups.map(g => g.id));
      const ungroupedStudents = filteredStudents.filter(
        s => !s.groupIds || s.groupIds.length === 0 || !s.groupIds.some(gid => activeGroupIds.has(gid))
      );
      if (ungroupedStudents.length > 0) {
        sections.push({
          groupId: 'ungrouped',
          groupName: "Guruhga biriktirilmagan o'quvchilar",
          students: ungroupedStudents
        });
      }
    }

    return sections;
  }, [activeGroups, filteredStudents, groupFilter]);

  const activeCount = data.students.filter(s => !s.deletedAt && !s.archived).length;
  const archivedCount = data.students.filter(s => !s.deletedAt && s.archived).length;

  return (
    <div className="fixed inset-0 z-[60] bg-sys-base/95 backdrop-blur-md overflow-y-auto w-full h-full">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 sticky top-0 py-4 bg-sys-base/90 backdrop-blur z-20 border-b border-white/10 gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-2xl font-bold text-white">Barcha o'quvchilar</h2>
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shrink-0">
              <button 
                onClick={() => setActiveTab('faol')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  activeTab === 'faol' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                )}
              >
                Faol ({activeCount})
              </button>
              <button 
                onClick={() => setActiveTab('arxiv')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  activeTab === 'arxiv' ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                )}
              >
                Arxivlangan ({archivedCount})
              </button>
            </div>

            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shrink-0">
              <button
                onClick={() => setViewMode('grouped')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer",
                  viewMode === 'grouped' ? "bg-blue-600 text-white shadow-sm" : "text-white/60 hover:text-white"
                )}
              >
                <Layers className="w-4 h-4" />
                <span>Guruhlar kesimida</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer",
                  viewMode === 'cards' ? "bg-blue-600 text-white shadow-sm" : "text-white/60 hover:text-white"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Kartochkalar</span>
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white cursor-pointer">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <input
              type="text"
              placeholder="O'quvchi ismi yoki telefon raqami bo'yicha izlash..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 text-base shadow-xl shadow-black/20"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 [&>option]:bg-sys-base"
            >
              <option value="all">Barcha guruhlar</option>
              {activeGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={schoolFilter}
              onChange={e => setSchoolFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 [&>option]:bg-sys-base"
            >
              <option value="all">Barcha maktablar</option>
              {uniqueSchools.map(school => (
                <option key={school} value={school}>{school}-maktab</option>
              ))}
            </select>
            <select
              value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 [&>option]:bg-sys-base"
            >
              <option value="all">Barcha sinflar</option>
              {uniqueGrades.map(grade => (
                <option key={grade} value={grade}>{grade}-sinf</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grouped by Group View ("Guruhlar kesimida") */}
        {viewMode === 'grouped' ? (
          groupedSections.length === 0 ? (
            <div className="py-16 text-center text-white/40 text-lg">
              {activeTab === 'faol' ? "Faol o'quvchilar topilmadi" : "Arxivlangan o'quvchilar topilmadi"}
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {groupedSections.map(section => (
                <div
                  key={section.groupId}
                  className="glass-card rounded-2xl border border-white/10 overflow-hidden shadow-xl"
                >
                  {/* Group Section Header */}
                  <div className="p-4 sm:p-5 bg-white/[0.04] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-lg font-bold text-white">{section.groupName}</h3>
                          {section.groupTime && (
                            <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-white/80 text-xs font-semibold">
                              {section.groupTime}
                            </span>
                          )}
                          {section.groupDays && (
                            <span className="text-xs text-white/50 font-medium">
                              {section.groupDays}
                            </span>
                          )}
                          {section.teacherName && (
                            <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium">
                              🎓 {section.teacherName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                      {section.students.length} ta o'quvchi
                    </span>
                  </div>

                  {/* Ordered Table of Students */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                      <thead>
                        <tr className="text-[11px] text-white/45 uppercase tracking-wider bg-black/20 border-b border-white/10">
                          <th className="py-3 px-4 w-12 text-center">#</th>
                          <th className="py-3 px-4">Ism Familiya</th>
                          <th className="py-3 px-4">O'quvchi telefoni</th>
                          <th className="py-3 px-4">Ota-ona telefoni</th>
                          <th className="py-3 px-4">Maktab va sinf</th>
                          <th className="py-3 px-4">Qo'shilgan sana</th>
                          <th className="py-3 px-4">Oylik to'lov</th>
                          <th className="py-3 px-4 text-right">Amallar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {section.students.map((student, idx) => {
                          const groupMonthly =
                            student.groupPricing && student.groupPricing[section.groupId]
                              ? student.groupPricing[section.groupId].monthly
                              : student.monthlyPayment;

                          return (
                            <tr
                              key={`${section.groupId}_${student.id}`}
                              className="hover:bg-white/[0.04] transition-colors"
                            >
                              <td className="py-3.5 px-4 text-center font-mono text-xs text-white/40">
                                {idx + 1}
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-white">
                                {student.fullName}
                              </td>
                              <td className="py-3.5 px-4 text-white/80 font-mono text-xs">
                                {student.phone ? (
                                  <a
                                    href={`tel:${student.phone.replace(/[^0-9+]/g, '')}`}
                                    className="hover:text-primary hover:underline"
                                  >
                                    {student.phone}
                                  </a>
                                ) : (
                                  <span className="text-white/30">—</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-white/80 font-mono text-xs">
                                {student.parentPhone ? (
                                  <a
                                    href={`tel:${student.parentPhone.replace(/[^0-9+]/g, '')}`}
                                    className="hover:text-primary hover:underline"
                                  >
                                    {student.parentPhone}
                                  </a>
                                ) : (
                                  <span className="text-white/30">—</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-white/75 text-xs">
                                {student.school ? `${student.school}-maktab` : "—"}
                                {student.grade ? ` (${student.grade})` : ""}
                              </td>
                              <td className="py-3.5 px-4 text-white/60 text-xs font-mono">
                                {student.joinDate || "—"}
                              </td>
                              <td className="py-3.5 px-4 font-bold text-emerald-400 text-xs">
                                {formatSum(groupMonthly || 0)}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {deletingId === student.id ? (
                                  <div className="inline-flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-2 py-1">
                                    <span className="text-xs text-destructive font-medium">O'chirilsinmi?</span>
                                    <button
                                      onClick={() => onDelete(student.id)}
                                      className="text-xs bg-destructive text-white px-2 py-0.5 rounded hover:bg-destructive/90 font-medium"
                                    >
                                      Ha
                                    </button>
                                    <button
                                      onClick={() => setDeletingId(null)}
                                      className="text-xs bg-white/10 text-white px-2 py-0.5 rounded hover:bg-white/20 font-medium"
                                    >
                                      Yo'q
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      onClick={() => onEdit(student.id)}
                                      className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                                      title="Tahrirlash"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => onArchive(student.id)}
                                      className="p-1.5 text-white/40 hover:text-yellow-400 hover:bg-yellow-400/10 rounded transition-colors cursor-pointer"
                                      title={student.archived ? "Arxivdan chiqarish" : "Arxivlash"}
                                    >
                                      {student.archived ? (
                                        <ArchiveRestore className="h-4 w-4" />
                                      ) : (
                                        <Archive className="h-4 w-4" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setDeletingId(student.id)}
                                      className="p-1.5 text-white/40 hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                                      title="O'chirish"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
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
                    {student.parentPhone && <div className="flex gap-2"><span>👪</span> <a href={`tel:${student.parentPhone.replace(/[^0-9+]/g, '')}`} className="text-white/80 hover:text-white hover:underline transition-colors">{student.parentPhone}</a></div>}
                    {student.school && <div className="flex gap-2"><span>🏫</span> <span className="text-white/80">{student.school}-maktab {student.grade && `(${student.grade})`}</span></div>}
                    <div className="flex gap-2"><span>📅</span> <span>{student.joinDate} dan beri</span></div>
                    <div className="flex gap-2"><span>💰</span> <span className="text-white/90 font-medium">{formatSum(student.monthlyPayment)} / oy</span></div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
                    {(student.groupIds || []).map(gid => {
                      const g = data.groups.find(x => x.id === gid);
                      return g ? (
                        <span key={gid} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded border border-primary/20">
                          {g.name}
                        </span>
                      ) : null;
                    })}
                    {(!student.groupIds || student.groupIds.length === 0) && (
                      <span className="text-xs text-white/30 italic">Guruhsiz</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
