import { useMemo, useState, FormEvent } from 'react';
import { AppData, getLessonDates, getDebtAmount, DAY_NAMES_SHORT, Student, getGroupFinancialStats, formatSum, getExpectedPayment, formatMonthKey, PaymentRecord } from '../lib/store';
import { cn } from '../lib/utils';
import { ChevronDown, Users, ChevronRight, ArrowLeft, Archive, Wallet, TrendingUp, AlertCircle, CreditCard, Banknote, CheckCircle2, X } from 'lucide-react';


interface AttendanceTabProps {
  data: AppData;
  monthKey: string;
  year: number;
  month: number; // 0-11
  setAttendance: (groupId: string, monthKey: string, studentId: string, date: string, status: "present" | "absent" | undefined) => void;
  toggleArchiveStudent: (id: string) => void;
  updateStudent: (id: string, updates: any) => void;
  addPayment?: (payment: Omit<PaymentRecord, "id" | "date">) => void;
}

export function AttendanceTab({ data, monthKey, year, month, setAttendance, toggleArchiveStudent, updateStudent, addPayment }: AttendanceTabProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [payingStudent, setPayingStudent] = useState<Student | null>(null);
  const [amountInput, setAmountInput] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"Naqd" | "Karta">("Naqd");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string>("");

  const openPaymentModal = (student: Student) => {
    setPayingStudent(student);
    const debt = getDebtAmount(student, monthKey, data.payments);
    if (debt > 0) {
      setAmountInput(debt.toString());
    } else {
      const expected = getExpectedPayment(student, monthKey);
      setAmountInput(expected > 0 ? expected.toString() : "");
    }
    setPaymentType("Naqd");
    setPaymentNote("");
  };

  const handleConfirmPayment = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!payingStudent || !amountInput || !addPayment) return;
    const amount = parseInt(amountInput.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount <= 0) return;

    const noteText = paymentNote.trim() ? `${paymentType} - ${paymentNote.trim()}` : paymentType;

    addPayment({
      studentId: payingStudent.id,
      amount,
      month: monthKey,
      note: noteText
    });

    setToastMessage(`${payingStudent.fullName} uchun ${formatSum(amount)} to'lov qabul qilindi!`);
    setTimeout(() => setToastMessage(""), 3500);

    setPayingStudent(null);
    setAmountInput("");
    setPaymentNote("");
  };


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
                    <td className="p-3 sm:p-4 flex items-center justify-between sticky left-0 z-20 bg-sys-base group-hover/row:bg-sys-hover transition-colors border-r border-white/5 md:border-none shadow-[1px_0_0_rgba(255,255,255,0.05)]">
                      <div 
                        onClick={() => openPaymentModal(student)}
                        className="flex flex-col cursor-pointer group/student flex-1 pr-2 py-1 rounded-xl hover:bg-white/[0.08] px-2 -ml-2 transition-all select-none"
                        title="Ushbu oy uchun to'lov qabul qilish"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-sm font-semibold transition-colors group-hover/student:text-primary",
                            isDebtor ? "debt-glow text-white" : "text-white/90"
                          )}>
                            {student.fullName}
                          </span>
                          <CreditCard className="h-3.5 w-3.5 text-white/30 group-hover/student:text-primary transition-colors shrink-0" />
                        </div>
                        {isDebtor ? (
                          <span className="text-[10px] text-destructive font-medium tracking-tight mt-0.5 flex items-center gap-1.5">
                            <span>{new Intl.NumberFormat("uz-UZ").format(debt)} so'm qarz</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-destructive/15 text-rose-300 font-semibold group-hover/student:bg-destructive/30 transition-colors">
                              To'lash
                            </span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-accent font-medium tracking-tight mt-0.5 flex items-center gap-1.5">
                            <span>To'langan</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-accent/15 text-accent font-semibold opacity-0 group-hover/student:opacity-100 transition-opacity">
                              + To'lov
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleArchiveStudent(student.id);
                          }}
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

      {/* Quick Payment Modal */}
      {payingStudent && (
        <div 
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setPayingStudent(null)}
        >
          <div 
            className="glass-card border border-white/15 bg-sys-base rounded-2xl sm:rounded-3xl w-full max-w-md my-auto shadow-2xl relative flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 sm:pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">To'lovni qabul qilish</h3>
                  <p className="text-xs text-white/50">{formatMonthKey(monthKey)} oyi uchun</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayingStudent(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
                {/* Student Info Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 sm:p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-white/50 shrink-0">O'quvchi:</span>
                    <span className="text-sm font-bold text-white text-right truncate">{payingStudent.fullName}</span>
                  </div>
                  {group && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white/50 shrink-0">Guruh:</span>
                      <span className="text-xs font-medium text-white/80 text-right truncate">{group.name} ({group.time || 'Vaqtsiz'})</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-xs text-white/50">Qarzdorlik holati:</span>
                    {getDebtAmount(payingStudent, monthKey, data.payments) > 0 ? (
                      <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                        {formatSum(getDebtAmount(payingStudent, monthKey, data.payments))} qarz
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        To'liq to'langan
                      </span>
                    )}
                  </div>
                </div>

                {/* Payment Type Selection */}
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5 sm:mb-2">To'lov turi</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentType("Naqd")}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all",
                        paymentType === "Naqd"
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-500/10"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Naqd</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType("Karta")}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all",
                        paymentType === "Karta"
                          ? "bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-md shadow-blue-500/10"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Karta</span>
                    </button>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <label className="text-xs font-medium text-white/60">To'lov summasi (so'm)</label>
                    {getDebtAmount(payingStudent, monthKey, data.payments) > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmountInput(getDebtAmount(payingStudent, monthKey, data.payments).toString())}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        To'liq qarz summasi
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={amountInput}
                      onChange={e => setAmountInput(e.target.value.replace(/\D/g, ''))}
                      onWheel={e => e.currentTarget.blur()}
                      placeholder="0"
                      required
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 sm:py-3 text-base sm:text-lg font-bold text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-white/40">
                      so'm
                    </span>
                  </div>
                </div>

                {/* Optional Note */}
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5 sm:mb-2">Izoh (ixtiyoriy)</label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={e => setPaymentNote(e.target.value)}
                    placeholder="Masalan: oktyabr oyi to'lovi"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 sm:py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 sm:p-5 pt-3 border-t border-white/10 shrink-0 bg-sys-base/95 backdrop-blur-md flex items-center gap-2 sm:gap-3 rounded-b-2xl sm:rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setPayingStudent(null)}
                  className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-medium text-xs sm:text-sm transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={!amountInput || parseInt(amountInput, 10) <= 0}
                  className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Qabul qilish</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[130] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl shadow-black/40 flex items-center gap-3 border border-emerald-400/30 animate-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-200" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
