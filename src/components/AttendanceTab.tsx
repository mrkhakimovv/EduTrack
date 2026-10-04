import { useMemo, useState } from 'react';
import { AppData, getLessonDates, getDebtAmount, DAY_NAMES_SHORT, Student, getGroupFinancialStats, formatSum } from '../lib/store';
import { cn } from '../lib/utils';
import { ChevronDown, Users, ChevronRight, ArrowLeft, Archive, Wallet, TrendingUp, AlertCircle } from 'lucide-react';


interface AttendanceTabProps {
  data: AppData;
  monthKey: string;
  year: number;
  month: number; // 0-11
  setAttendance: (groupId: string, monthKey: string, studentId: string, date: string, status: "present" | "absent" | undefined) => void;
  toggleArchiveStudent: (id: string) => void;
  updateStudent: (id: string, updates: any) => void;
}

export function AttendanceTab({ data, monthKey, year, month, setAttendance, toggleArchiveStudent, updateStudent }: AttendanceTabProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");


  const group = data.groups.find(g => g.id === selectedGroupId);
  
  const lessonDates = useMemo(() => {
    if (!group) return [];
    return getLessonDates(group, year, month);
  }, [group, year, month]);

  const studentsInGroup = useMemo(() => {
    return data.students.filter(s => {
      if (s.deletedAt) return false;
      if (s.archived) return false;
      if (s.groupIds?.includes(selectedGroupId)) return true;
      if (s.history && s.history.length > 0) {
        const parts = monthKey.split('-');
        if (parts.length === 2) {
          const mYear = parseInt(parts[0], 10);
          const mMonthIndex = parseInt(parts[1], 10) - 1;
          const monthStartDateTs = new Date(mYear, mMonthIndex, 1).getTime();
          const monthEndDateTs = new Date(mYear, mMonthIndex + 1, 0, 23, 59, 59, 999).getTime();
          const historyInMonth = s.history.filter(h => {
            const time = new Date(h.updatedAt).getTime();
            return time >= monthStartDateTs && time <= monthEndDateTs;
          });
          if (historyInMonth.some(h => h.groupIds?.includes(selectedGroupId))) return true;
        }
      }
      return false;
    });
  }, [data.students, selectedGroupId, monthKey]);

  const toggleAttendance = (studentId: string, date: string, currentStatus: "present" | "absent" | undefined) => {
    if (!selectedGroupId) return;
    
    let nextStatus: "present" | "absent" | undefined = "present";
    if (currentStatus === "present") nextStatus = "absent";
    else if (currentStatus === "absent") nextStatus = undefined;

    setAttendance(selectedGroupId, monthKey, studentId, date, nextStatus);
  };

  const activeGroups = data.groups.filter(g => !g.deletedAt && !g.archived);

  // Group stats calculation for all active groups
  const groupsStatsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getGroupFinancialStats>>();
    activeGroups.forEach(g => {
      map.set(g.id, getGroupFinancialStats(g, data.students, data.payments, monthKey));
    });
    return map;
  }, [activeGroups, data.students, data.payments, monthKey]);

  const totalGroupsCollected = useMemo(() => {
    let sum = 0;
    groupsStatsMap.forEach(stat => {
      sum += stat.collectedAmount;
    });
    return sum;
  }, [groupsStatsMap]);

  const totalGroupsRemaining = useMemo(() => {
    let sum = 0;
    groupsStatsMap.forEach(stat => {
      sum += stat.remainingAmount;
    });
    return sum;
  }, [groupsStatsMap]);

  const selectedGroupStats = useMemo(() => {
    if (!group) return null;
    return groupsStatsMap.get(group.id) || getGroupFinancialStats(group, data.students, data.payments, monthKey);
  }, [group, groupsStatsMap, data.students, data.payments, monthKey]);

  if (activeGroups.length === 0) {
    return <div className="text-center text-white/50 py-8">Hali guruhlar yo'q</div>;
  }

  if (!selectedGroupId) {
    return (
      <div className="flex flex-col gap-5 h-full p-4 sm:p-6 overflow-y-auto custom-scrollbar glass-card md:bg-transparent md:border-none md:backdrop-filter-none rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white/90">Guruhni tanlang</h2>
            <p className="text-xs text-white/50 mt-0.5">Davomat va to'lovlar statistikasini ko'rish uchun guruh ustiga bosing</p>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs">
            <div>
              <span className="text-white/40 block text-[10px]">Jami yig'ilgan:</span>
              <span className="font-bold text-emerald-400">{formatSum(totalGroupsCollected)}</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div>
              <span className="text-white/40 block text-[10px]">Jami qolgan:</span>
              <span className={cn("font-bold", totalGroupsRemaining > 0 ? "text-rose-400" : "text-white/70")}>
                {formatSum(totalGroupsRemaining)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 select-none">
          {activeGroups.map(g => {
            const gStats = groupsStatsMap.get(g.id) || getGroupFinancialStats(g, data.students, data.payments, monthKey);
            const daysStr = g.days.map(d => DAY_NAMES_SHORT[d]).join('-');

            return (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className="glass-card hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-2xl p-4 sm:p-5 text-left transition-all flex flex-col justify-between group shadow-lg shadow-black/10 gap-3"
              >
                <div className="flex items-start justify-between gap-3 w-full">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{g.name}</h3>
                      {g.time && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/80 font-medium">
                          {g.time}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      {daysStr} • {gStats.totalStudents} ta o'quvchi
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary text-white/60 transition-colors shrink-0">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>

                {/* Group Collected and Remaining Statistics */}
                <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 w-full">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex flex-col">
                    <span className="text-[11px] text-emerald-400/80 font-medium">Yig'ilgan summa</span>
                    <span className="text-sm sm:text-base font-bold text-emerald-400 mt-0.5">
                      {formatSum(gStats.collectedAmount)}
                    </span>
                  </div>
                  <div className={cn(
                    "rounded-xl p-2.5 flex flex-col border",
                    gStats.remainingAmount > 0 
                      ? "bg-rose-500/10 border-rose-500/20" 
                      : "bg-white/5 border-white/10"
                  )}>
                    <span className={cn(
                      "text-[11px] font-medium",
                      gStats.remainingAmount > 0 ? "text-rose-400/80" : "text-white/40"
                    )}>
                      Qolgan summa
                    </span>
                    <span className={cn(
                      "text-sm sm:text-base font-bold mt-0.5",
                      gStats.remainingAmount > 0 ? "text-rose-400" : "text-white/70"
                    )}>
                      {formatSum(gStats.remainingAmount)}
                    </span>
                  </div>
                </div>

                {/* Mini progress bar */}
                <div className="w-full">
                  <div className="flex justify-between items-center text-[10px] text-white/40 mb-1">
                    <span>Yig'ish darajasi</span>
                    <span className={cn(
                      "font-semibold",
                      gStats.paidPercentage === 100 ? "text-emerald-400" : "text-white/70"
                    )}>
                      {gStats.paidPercentage}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        gStats.paidPercentage === 100 ? "bg-emerald-400" : "bg-primary"
                      )}
                      style={{ width: `${gStats.paidPercentage}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const attendanceRecord = data.attendance[`${selectedGroupId}_${monthKey}`] || {};

  // Stats calculation
  const totalCells = lessonDates.length * studentsInGroup.length;
  let totalPresent = 0;
  if(totalCells > 0) {
    studentsInGroup.forEach(s => {
      lessonDates.forEach(d => {
        const status = attendanceRecord[s.id]?.[d];
        if (status === 'present') totalPresent++;
      });
    });
  }
  const attendancePercent = totalCells === 0 ? 0 : Math.round((totalPresent / totalCells) * 100);

  return (
    <div className={cn(
      "flex flex-col h-full",
      selectedGroupId ? "fixed inset-0 z-[100] h-[100dvh] bg-sys-base md:static md:h-full md:z-auto md:bg-transparent" : ""
    )}>
      <div className="p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 shrink-0 pt-6 md:pt-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedGroupId("")} 
            className="p-2 border border-white/5 bg-white/5 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-white/90">
              {group?.name} <span className="text-white/40 text-base font-normal ml-2">{group?.time}</span>
            </h2>
            <p className="text-sm text-white/50">
              {lessonDates.length} ta dars • {studentsInGroup.length} ta o'quvchi
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {selectedGroupStats && (
            <>
              <div className="text-left sm:text-center">
                <div className="text-emerald-400 font-bold text-base sm:text-lg">
                  {formatSum(selectedGroupStats.collectedAmount)}
                </div>
                <div className="text-[10px] text-emerald-400/80 uppercase font-medium tracking-wider">
                  Yig'ilgan
                </div>
              </div>

              <div className="text-left sm:text-center">
                <div className={cn(
                  "font-bold text-base sm:text-lg",
                  selectedGroupStats.remainingAmount > 0 ? "text-rose-400" : "text-white/60"
                )}>
                  {formatSum(selectedGroupStats.remainingAmount)}
                </div>
                <div className={cn(
                  "text-[10px] uppercase font-medium tracking-wider",
                  selectedGroupStats.remainingAmount > 0 ? "text-rose-400/80" : "text-white/40"
                )}>
                  Qolgan
                </div>
              </div>
            </>
          )}

          <div className="text-center pl-2 border-l border-white/10 hidden sm:block">
            <div className="text-[#10b981] font-bold text-lg">{attendancePercent}%</div>
            <div className="text-[10px] text-white/40 uppercase font-medium mt-0.5 tracking-wider">Davomat</div>
          </div>
          <div className="text-center hidden sm:block">
            <div className="text-[#ef4444] font-bold text-lg">
              {studentsInGroup.filter(s => getDebtAmount(s, monthKey, data.payments) > 0).length}
            </div>
            <div className="text-[10px] text-white/40 uppercase font-medium mt-0.5 tracking-wider">Qarzdor</div>
          </div>
        </div>
      </div>

      {lessonDates.length === 0 ? (
        <div className="text-center text-white/50 py-8">Bu oyda tanlangan guruh uchun dars kunlari yo'q</div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap border-collapse min-w-max">
            <thead className="sticky top-0 z-30 glass-card shadow-[0_1px_0_rgba(255,255,255,0.05)]">
              <tr className="text-[11px] text-white/40 uppercase tracking-wider">
                <th className="p-4 border-b border-white/5 font-medium sticky left-0 z-40 glass-card">Ism Familiya</th>
                {lessonDates.map(date => (
                  <th key={date} className="p-2 border-b border-white/5 text-center w-10">
                    <div className="font-bold text-white/90">{new Date(date).getDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {studentsInGroup.length === 0 && (
                <tr>
                  <td colSpan={lessonDates.length + 1} className="py-8 text-center text-white/40">
                    Guruhda o'quvchilar yo'q
                  </td>
                </tr>
              )}
              {studentsInGroup.map(student => {
                const debt = getDebtAmount(student, monthKey, data.payments);
                const isDebtor = debt > 0;
                
                return (
                  <tr key={student.id} className="hover:bg-white/5 transition-colors group/row">
                    <td className="p-4 flex items-center justify-between sticky left-0 z-20 bg-sys-base group-hover/row:bg-sys-hover transition-colors border-r border-white/5 md:border-none shadow-[1px_0_0_rgba(255,255,255,0.05)]">
                      <div className="flex flex-col">
                        <span className={cn("text-sm font-medium", isDebtor ? "debt-glow text-white" : "text-white/90")}>
                          {student.fullName}
                        </span>
                        {isDebtor ? (
                          <span className="text-[10px] text-destructive font-medium tracking-tight mt-0.5">
                            {new Intl.NumberFormat("uz-UZ").format(debt)} so'm qarz
                          </span>
                        ) : (
                          <span className="text-[10px] text-accent font-medium tracking-tight mt-0.5">
                            To'langan
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => toggleArchiveStudent(student.id)}
                          className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                          title="Arxivlash"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    {lessonDates.map(date => {
                      const checkDate = new Date(date).getTime();
                      const joinDate = new Date(student.joinDate).getTime();
                      let isActive = true;
                      
                      if (checkDate < joinDate) isActive = false;
                      if (student.deletedAt && checkDate > new Date(student.deletedAt).getTime()) isActive = false;
                      if (student.archived && student.archivedAt && checkDate > new Date(student.archivedAt).getTime()) isActive = false;
                      
                      if (isActive && student.history && student.history.length > 0) {
                        const endOfDayTs = new Date(`${date}T23:59:59.999Z`).getTime();
                        const editsAfterDate = student.history.filter(h => new Date(h.updatedAt).getTime() > endOfDayTs);
                        editsAfterDate.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
                        if (editsAfterDate.length > 0) {
                          isActive = editsAfterDate[0].groupIds?.includes(selectedGroupId);
                        } else {
                          isActive = student.groupIds?.includes(selectedGroupId);
                        }
                      } else if (isActive && (!student.history || student.history.length === 0)) {
                        isActive = student.groupIds?.includes(selectedGroupId);
                      }

                      const status = attendanceRecord[student.id]?.[date];
                      
                      return (
                        <td key={date} className="p-2 text-center">
                          {isActive ? (
                            <button
                              onClick={() => toggleAttendance(student.id, date, status)}
                              className={cn(
                                "w-8 h-8 rounded-[6px] flex items-center justify-center text-[13px] font-bold transition-all mx-auto select-none",
                                status === 'present' ? "bg-[#10b98133] text-[#10b981] border border-[#10b9814d]" :
                                status === 'absent' ? "bg-[#ef444433] text-[#ef4444] border border-[#ef44444d]" :
                                "bg-white/5 text-transparent border border-transparent hover:bg-white/10 hover:text-white/20"
                              )}
                            >
                              {status === 'present' ? '+' : status === 'absent' ? '-' : ''}
                            </button>
                          ) : (
                            <div className="w-8 h-8 mx-auto flex items-center justify-center">
                              <div className="w-2 h-0.5 bg-white/10 rounded-full"></div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}


    </div>
  );
}
