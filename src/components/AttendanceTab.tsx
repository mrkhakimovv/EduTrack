import { useMemo, useState, FormEvent } from 'react';
import { AppData, getLessonDates, getDebtAmount, DAY_NAMES_SHORT, Student, getGroupFinancialStats, formatSum, getExpectedPayment, formatMonthKey, PaymentRecord, hasStudentPendingPayment } from '../lib/store';
import { cn } from '../lib/utils';
import { ChevronDown, Users, ChevronRight, ArrowLeft, Archive, Wallet, TrendingUp, AlertCircle, CreditCard, Banknote, CheckCircle2, X, UserPlus, Sparkles, GraduationCap, Clock, ArrowRightLeft } from 'lucide-react';

export interface ParsedTemplateStudent {
  fullName: string;
  phone: string;
  monthlyPayment: number;
  usedGroupDefault?: boolean;
  raw: string;
  isValid: boolean;
  error?: string;
}

export function parseStudentTemplate(input: string, defaultGroupPayment: number = 0): ParsedTemplateStudent[] {
  if (!input || !input.trim()) return [];

  const bracketMatches = input.match(/\[(.*?)\]/gs);
  let rawBlocks: string[] = [];

  if (bracketMatches && bracketMatches.length > 0) {
    rawBlocks = bracketMatches.map(b => b.trim().replace(/^\[\s*/, '').replace(/\s*\]$/, '').trim());
  } else {
    rawBlocks = input.split('\n').map(l => l.trim()).filter(Boolean);
  }

  return rawBlocks.map(block => {
    const parts = block.split(';').map(p => {
      let cleaned = p.trim();
      if (cleaned.startsWith('+')) cleaned = cleaned.slice(1).trim();
      while (cleaned.startsWith('(') && cleaned.endsWith(')')) {
        cleaned = cleaned.slice(1, -1).trim();
      }
      return cleaned;
    });

    if (parts.length < 2) {
      return {
        fullName: parts[0] || '',
        phone: '',
        monthlyPayment: 0,
        raw: block,
        isValid: false,
        error: "Kamida Ism Familiya va telefon raqam kiritilishi kerak"
      };
    }

    const fullName = parts[0].trim();
    const phone = (parts[1] || '').trim();
    const rawAmountPart = parts[2] !== undefined ? parts[2].trim() : '';
    const amountStr = rawAmountPart.replace(/[^\d]/g, '');
    const parsedPayment = amountStr ? parseInt(amountStr, 10) : 0;

    if (!fullName) {
      return { fullName: '', phone, monthlyPayment: 0, raw: block, isValid: false, error: "Ism Familiya kiritilmagan" };
    }

    let monthlyPayment = parsedPayment;
    let usedGroupDefault = false;

    if (isNaN(monthlyPayment) || monthlyPayment <= 0) {
      if (defaultGroupPayment > 0) {
        monthlyPayment = defaultGroupPayment;
        usedGroupDefault = true;
      } else if (rawAmountPart === '0' || rawAmountPart === '') {
        monthlyPayment = 0;
        usedGroupDefault = true;
      } else {
        return {
          fullName,
          phone,
          monthlyPayment: 0,
          raw: block,
          isValid: false,
          error: "To'lov summasi noto'g'ri kiritilgan (guruh uchun ham oylik to'lov belgilanmagan)"
        };
      }
    }

    return {
      fullName,
      phone,
      monthlyPayment,
      usedGroupDefault,
      raw: block,
      isValid: true
    };
  });
}

interface AttendanceTabProps {
  data: AppData;
  monthKey: string;
  year: number;
  month: number; // 0-11
  setAttendance: (groupId: string, monthKey: string, studentId: string, date: string, status: "present" | "absent" | undefined) => void;
  toggleArchiveStudent: (id: string) => void;
  updateStudent: (id: string, updates: any) => void;
  addPayment?: (payment: Omit<PaymentRecord, "id" | "date">) => void;
  addStudent?: (student: Omit<Student, "id" | "createdAt">) => void | Promise<void>;
  teachers?: any[];
  onEditGroup?: (id: string) => void;
}

export function AttendanceTab({ data, monthKey, year, month, setAttendance, toggleArchiveStudent, updateStudent, addPayment, addStudent, teachers = [], onEditGroup }: AttendanceTabProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [payingStudent, setPayingStudent] = useState<Student | null>(null);
  const [amountInput, setAmountInput] = useState<string>("");
  const [waiveRemaining, setWaiveRemaining] = useState<boolean>(false);
  const [paymentType, setPaymentType] = useState<"Naqd" | "Karta">("Naqd");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string>("");

  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [templateInput, setTemplateInput] = useState<string>("");
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);

  const [movingStudent, setMovingStudent] = useState<Student | null>(null);
  const [selectedMoveGroupIds, setSelectedMoveGroupIds] = useState<string[]>([]);

  const group = data.groups.find(g => g.id === selectedGroupId);

  const groupDefaultPayment = useMemo(() => {
    if (group?.monthlyPayment && group.monthlyPayment > 0) {
      return group.monthlyPayment;
    }
    const groupStudents = data.students.filter(
      s => !s.deletedAt && !s.archived && s.groupIds?.includes(selectedGroupId)
    );
    for (const st of groupStudents) {
      const grpPrice = st.groupPricing?.[selectedGroupId]?.monthly;
      if (grpPrice && grpPrice > 0) return grpPrice;
      if (st.monthlyPayment && st.monthlyPayment > 0) return st.monthlyPayment;
    }
    return 0;
  }, [group, data.students, selectedGroupId]);

  const parsedTemplateStudents = useMemo(() => {
    return parseStudentTemplate(templateInput, groupDefaultPayment);
  }, [templateInput, groupDefaultPayment]);

  const validTemplateStudents = useMemo(() => {
    return parsedTemplateStudents.filter(s => s.isValid);
  }, [parsedTemplateStudents]);

  const openPaymentModal = (student: Student) => {
    setPayingStudent(student);
    const debt = getDebtAmount(student, monthKey, data.payments);
    if (debt > 0) {
      setAmountInput(debt.toString());
    } else {
      const expected = getExpectedPayment(student, monthKey);
      setAmountInput(expected > 0 ? expected.toString() : "");
    }
    setWaiveRemaining(false);
    setPaymentType("Naqd");
    setPaymentNote("");
  };

  const handleConfirmPayment = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!payingStudent || !amountInput || !addPayment) return;
    const amount = parseInt(amountInput.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount <= 0) return;

    const currentDebt = getDebtAmount(payingStudent, monthKey, data.payments);
    const standardAmount = currentDebt > 0 ? currentDebt : getExpectedPayment(payingStudent, monthKey);
    const remainingDiff = standardAmount > 0 && amount < standardAmount ? (standardAmount - amount) : 0;

    const noteText = paymentNote.trim() ? `${paymentType} - ${paymentNote.trim()}` : paymentType;

    addPayment({
      studentId: payingStudent.id,
      amount,
      ...(waiveRemaining && remainingDiff > 0 ? { waivedAmount: remainingDiff } : {}),
      month: monthKey,
      note: noteText
    });

    setToastMessage(
      waiveRemaining && remainingDiff > 0
        ? `${payingStudent.fullName} uchun ${formatSum(amount)} qabul qilindi (${formatSum(remainingDiff)} chegirma)!`
        : `${payingStudent.fullName} uchun ${formatSum(amount)} to'lov qabul qilindi!`
    );
    setTimeout(() => setToastMessage(""), 3500);

    setPayingStudent(null);
    setAmountInput("");
    setWaiveRemaining(false);
    setPaymentNote("");
  };

  const handleSaveTemplateStudents = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!addStudent || !selectedGroupId || validTemplateStudents.length === 0) return;
    setIsSavingTemplate(true);
    try {
      for (const s of validTemplateStudents) {
        const newStudent: Omit<Student, "id" | "createdAt"> = {
          fullName: s.fullName,
          phone: s.phone,
          parentPhone: s.phone,
          school: "",
          grade: "",
          groupIds: [selectedGroupId],
          joinDate: `${monthKey}-01`,
          firstMonthPayment: s.monthlyPayment,
          monthlyPayment: s.monthlyPayment,
          groupPricing: {
            [selectedGroupId]: {
              monthly: s.monthlyPayment,
              firstMonth: s.monthlyPayment
            }
          }
        };
        await addStudent(newStudent);
      }
      setToastMessage(`${validTemplateStudents.length} ta o'quvchi muvaffaqiyatli qo'shildi!`);
      setTimeout(() => setToastMessage(""), 3500);
      setShowTemplateModal(false);
      setTemplateInput("");
    } catch (err) {
      console.error("Error creating students from template:", err);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const lessonDates = useMemo(() => {
    if (!group) return [];
    return getLessonDates(group, year, month);
  }, [group, year, month]);

  const openMoveStudentModal = (student: Student) => {
    setMovingStudent(student);
    setSelectedMoveGroupIds([...(student.groupIds || [])]);
  };

  const toggleMoveGroupSelection = (groupId: string) => {
    setSelectedMoveGroupIds(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      }
      return [...prev, groupId];
    });
  };

  const handleConfirmMoveStudent = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!movingStudent || selectedMoveGroupIds.length === 0) return;

    const oldGroupIds = movingStudent.groupIds || [];
    const newGroupIds = selectedMoveGroupIds;

    // Preserve student's exact financial figures so moving groups never alters debt or payments
    let currentTotalMonthly = movingStudent.monthlyPayment || 0;
    let currentTotalFirstMonth = movingStudent.firstMonthPayment || 0;

    if (movingStudent.groupPricing && Object.keys(movingStudent.groupPricing).length > 0) {
      let sumMonthly = 0;
      let sumFirst = 0;
      let hasMatched = false;
      for (const gid of oldGroupIds) {
        const p = movingStudent.groupPricing[gid];
        if (p) {
          hasMatched = true;
          sumMonthly += p.monthly || 0;
          sumFirst += p.firstMonth || 0;
        }
      }
      if (hasMatched) {
        currentTotalMonthly = sumMonthly;
        currentTotalFirstMonth = sumFirst;
      }
    }

    const newGroupPricing: Record<string, { monthly: number; firstMonth: number }> = {};
    if (newGroupIds.length === 1) {
      newGroupPricing[newGroupIds[0]] = {
        monthly: currentTotalMonthly,
        firstMonth: currentTotalFirstMonth
      };
    } else {
      const keptGroupIds = newGroupIds.filter(id => oldGroupIds.includes(id) && movingStudent.groupPricing?.[id]);
      const addedGroupIds = newGroupIds.filter(id => !keptGroupIds.includes(id));
      let keptMonthlySum = 0;
      let keptFirstSum = 0;

      keptGroupIds.forEach(id => {
        const p = movingStudent.groupPricing![id];
        newGroupPricing[id] = { monthly: p.monthly, firstMonth: p.firstMonth };
        keptMonthlySum += p.monthly;
        keptFirstSum += p.firstMonth;
      });

      if (addedGroupIds.length > 0) {
        const remMonthly = Math.max(0, currentTotalMonthly - keptMonthlySum);
        const remFirst = Math.max(0, currentTotalFirstMonth - keptFirstSum);
        const perAddedMonthly = Math.round(remMonthly / addedGroupIds.length);
        const perAddedFirst = Math.round(remFirst / addedGroupIds.length);

        addedGroupIds.forEach((id, idx) => {
          const isLast = idx === addedGroupIds.length - 1;
          newGroupPricing[id] = {
            monthly: isLast ? Math.max(0, remMonthly - perAddedMonthly * idx) : perAddedMonthly,
            firstMonth: isLast ? Math.max(0, remFirst - perAddedFirst * idx) : perAddedFirst
          };
        });
      }
    }

    updateStudent(movingStudent.id, {
      groupIds: newGroupIds,
      monthlyPayment: currentTotalMonthly,
      firstMonthPayment: currentTotalFirstMonth,
      groupPricing: newGroupPricing
    });

    const targetGroupNames = data.groups
      .filter(g => newGroupIds.includes(g.id))
      .map(g => g.name)
      .join(", ");

    setToastMessage(`${movingStudent.fullName} -> ${targetGroupNames} guruhiga biriktirildi!`);
    setTimeout(() => setToastMessage(""), 3500);
    setMovingStudent(null);
  };

  const studentsInGroup = useMemo(() => {
    return data.students.filter(s => {
      if (s.deletedAt) return false;
      if (s.archived) return false;
      return Boolean(s.groupIds?.includes(selectedGroupId));
    });
  }, [data.students, selectedGroupId]);

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

  const totalGroupsConfirmed = useMemo(() => {
    let sum = 0;
    groupsStatsMap.forEach(stat => {
      sum += stat.confirmedAmount;
    });
    return sum;
  }, [groupsStatsMap]);

  const totalGroupsPending = useMemo(() => {
    let sum = 0;
    groupsStatsMap.forEach(stat => {
      sum += stat.pendingAmount;
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

  const getTeacherInfo = (g: any) => {
    if (g?.teacherName && g.teacherName.trim()) {
      return { name: g.teacherName.trim(), isAssigned: true };
    }
    if (g?.teacherId) {
      const match = teachers.find(t => t.uid === g.teacherId || t.id === g.teacherId || t.teacherId === g.teacherId);
      if (match?.fullName) {
        return { name: match.fullName, isAssigned: true };
      }
    }
    // Fallback: If center currently has exactly 1 teacher, auto-fallback to that teacher
    if (teachers && teachers.length === 1 && teachers[0]?.fullName) {
      return { name: teachers[0].fullName, isAssigned: true };
    }
    return { name: "Biriktirilmagan", isAssigned: false };
  };

  if (activeGroups.length === 0) {
    return <div className="text-center text-white/50 py-8">Ushbu o'qituvchi uchun hali guruhlar yo'q</div>;
  }

  if (!selectedGroupId || !group) {
    return (
      <div className="flex flex-col gap-5 h-full p-4 sm:p-6 overflow-y-auto custom-scrollbar glass-card md:bg-transparent md:border-none md:backdrop-filter-none rounded-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white/90">Guruhni tanlang</h2>
            <p className="text-xs text-white/50 mt-0.5">Davomat va to'lovlar statistikasini ko'rish uchun guruh ustiga bosing</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Markaz tomonidan tasdiqlangan va tasdiqlanmagan summa */}
            <div className="flex items-center gap-2 sm:gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs">
              <div>
                <span className="text-white/40 flex items-center gap-1 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  Tasdiqlangan:
                </span>
                <span className="font-bold text-emerald-400">{formatSum(totalGroupsConfirmed)}</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div>
                <span className="text-white/40 flex items-center gap-1 text-[10px]">
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                  Tasdiqlanmagan:
                </span>
                <span className={cn("font-bold", totalGroupsPending > 0 ? "text-amber-400" : "text-white/70")}>
                  {formatSum(totalGroupsPending)}
                </span>
              </div>
            </div>

            {/* Jami yig'ilgan va Jami qolgan summa */}
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 select-none">
          {activeGroups.map(g => {
            const gStats = groupsStatsMap.get(g.id) || getGroupFinancialStats(g, data.students, data.payments, monthKey);
            const effectiveDays = (g.days && g.days.length > 0) ? g.days : [1, 2, 3, 4, 5, 6];
            const daysStr = effectiveDays.map(d => DAY_NAMES_SHORT[d]).join('-');

            return (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className="glass-card hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-2xl p-4 sm:p-5 text-left transition-all flex flex-col justify-between group shadow-lg shadow-black/10 gap-3"
              >
                <div className="flex items-start justify-between gap-3 w-full">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{g.name}</h3>
                      {g.time && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/80 font-medium">
                          {g.time}
                        </span>
                      )}
                      {(() => {
                        const tInfo = getTeacherInfo(g);
                        return (
                          <span
                            onClick={(e) => {
                              if (onEditGroup) {
                                e.stopPropagation();
                                onEditGroup(g.id);
                              }
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border transition-all cursor-pointer shadow-sm",
                              tInfo.isAssigned
                                ? "bg-purple-500/20 border-purple-500/35 text-purple-200 hover:bg-purple-500/30"
                                : "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20"
                            )}
                            title={tInfo.isAssigned ? `Mas'ul o'qituvchi: ${tInfo.name} (O'zgartirish uchun bosing)` : "O'qituvchi biriktirish uchun bosing"}
                          >
                            <GraduationCap className={cn("w-3.5 h-3.5 shrink-0", tInfo.isAssigned ? "text-purple-300" : "text-amber-400")} />
                            <span>{tInfo.name}</span>
                          </span>
                        );
                      })()}
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
      <div className="p-3.5 sm:p-4 md:p-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 border-b border-white/5 shrink-0 pt-4 md:pt-6">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={() => setSelectedGroupId("")} 
              className="p-2 border border-white/10 bg-white/5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-bold text-white/90 truncate">
                  {group?.name} <span className="text-white/40 text-xs sm:text-base font-normal ml-1">{group?.time}</span>
                </h2>
                {group && (() => {
                  const tInfo = getTeacherInfo(group);
                  return (
                    <span
                      onClick={() => {
                        if (onEditGroup && group) {
                          onEditGroup(group.id);
                        }
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-medium border transition-all cursor-pointer shadow-sm",
                        tInfo.isAssigned
                          ? "bg-purple-500/20 border-purple-500/35 text-purple-200 hover:bg-purple-500/30"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20"
                      )}
                      title="O'qituvchini o'zgartirish yoki biriktirish"
                    >
                      <GraduationCap className={cn("w-3.5 h-3.5 shrink-0", tInfo.isAssigned ? "text-purple-300" : "text-amber-400")} />
                      <span className="truncate max-w-[140px] sm:max-w-none">O'qituvchi: {tInfo.name}</span>
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs sm:text-sm text-white/50">
                {lessonDates.length} ta dars • {studentsInGroup.length} ta o'quvchi
              </p>
            </div>
          </div>

          {/* Mobile O'quvchi qo'shish button */}
          <button
            type="button"
            onClick={() => {
              setTemplateInput("");
              setShowTemplateModal(true);
            }}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/25 border border-emerald-400/30 shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span>+ O'quvchi</span>
          </button>
        </div>

        {/* Desktop O'quvchi qo'shish (shablon) button */}
        <div className="hidden md:flex items-center">
          <button
            type="button"
            onClick={() => {
              setTemplateInput("");
              setShowTemplateModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/25 border border-emerald-400/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>O'quvchi qo'shish</span>
          </button>
        </div>

        <div className="grid grid-cols-4 sm:flex sm:flex-wrap items-center gap-2 sm:gap-5 bg-white/[0.03] sm:bg-transparent p-2.5 sm:p-0 rounded-xl border border-white/5 sm:border-none">
          {selectedGroupStats && (
            <>
              <div className="text-left sm:text-center">
                <div className="text-emerald-400 font-bold text-xs sm:text-base truncate">
                  {formatSum(selectedGroupStats.confirmedAmount)}
                </div>
                <div className="text-[9px] sm:text-[10px] text-emerald-400/80 uppercase font-medium tracking-wider truncate">
                  Tasdiqlangan
                </div>
              </div>

              <div className="text-left sm:text-center">
                <div className={cn(
                  "font-bold text-xs sm:text-base truncate",
                  selectedGroupStats.pendingAmount > 0 ? "text-amber-400" : "text-white/60"
                )}>
                  {formatSum(selectedGroupStats.pendingAmount)}
                </div>
                <div className={cn(
                  "text-[9px] sm:text-[10px] uppercase font-medium tracking-wider truncate",
                  selectedGroupStats.pendingAmount > 0 ? "text-amber-400/80" : "text-white/40"
                )}>
                  Tasdiqlanmagan
                </div>
              </div>

              <div className="w-px h-7 bg-white/10 hidden sm:block" />

              <div className="text-left sm:text-center">
                <div className="text-emerald-400 font-bold text-xs sm:text-lg truncate">
                  {formatSum(selectedGroupStats.collectedAmount)}
                </div>
                <div className="text-[9px] sm:text-[10px] text-emerald-400/80 uppercase font-medium tracking-wider truncate">
                  Yig'ilgan
                </div>
              </div>

              <div className="text-left sm:text-center">
                <div className={cn(
                  "font-bold text-xs sm:text-lg truncate",
                  selectedGroupStats.remainingAmount > 0 ? "text-rose-400" : "text-white/60"
                )}>
                  {formatSum(selectedGroupStats.remainingAmount)}
                </div>
                <div className={cn(
                  "text-[9px] sm:text-[10px] uppercase font-medium tracking-wider truncate",
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
                <th className="p-3 sm:p-4 border-b border-white/5 font-medium sticky left-0 z-40 glass-card max-w-[175px] sm:max-w-none">Ism Familiya</th>
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
                const hasPending = hasStudentPendingPayment(student.id, monthKey, data.payments);
                
                return (
                  <tr key={student.id} className="hover:bg-white/5 transition-colors group/row">
                    <td className="p-2.5 sm:p-4 flex items-center justify-between sticky left-0 z-20 bg-sys-base group-hover/row:bg-sys-hover transition-colors border-r border-white/5 md:border-none shadow-[1px_0_0_rgba(255,255,255,0.05)] max-w-[175px] sm:max-w-none">
                      <div 
                        onClick={() => openPaymentModal(student)}
                        className="flex flex-col cursor-pointer group/student flex-1 min-w-0 pr-1 sm:pr-2 py-1 rounded-xl hover:bg-white/[0.08] px-2 -ml-2 transition-all select-none"
                        title="Ushbu oy uchun to'lov qabul qilish"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={cn(
                            "text-xs sm:text-sm font-semibold transition-colors group-hover/student:text-primary truncate",
                            hasPending
                              ? "text-amber-300"
                              : isDebtor
                              ? "debt-glow text-white"
                              : "text-emerald-400"
                          )}>
                            {student.fullName}
                          </span>
                          <CreditCard className={cn(
                            "h-3.5 w-3.5 transition-colors shrink-0",
                            hasPending
                              ? "text-amber-400"
                              : !isDebtor
                              ? "text-emerald-400/70"
                              : "text-white/30 group-hover/student:text-primary"
                          )} />
                        </div>
                        {hasPending ? (
                          <span className="text-[10px] text-amber-400 font-semibold tracking-tight mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/35">
                              <Clock className="w-2.5 h-2.5" />
                              Kutilmoqda (Tasdiqlanmagan)
                            </span>
                            {isDebtor && (
                              <span className="text-rose-400">
                                ({new Intl.NumberFormat("uz-UZ").format(debt)} so'm qoldiq)
                              </span>
                            )}
                          </span>
                        ) : isDebtor ? (
                          <span className="text-[10px] text-destructive font-medium tracking-tight mt-0.5 flex items-center gap-1.5">
                            <span>{new Intl.NumberFormat("uz-UZ").format(debt)} so'm qarz</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-destructive/15 text-rose-300 font-semibold group-hover/student:bg-destructive/30 transition-colors">
                              To'lash
                            </span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-semibold tracking-tight mt-0.5 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              To'langan
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 font-semibold opacity-0 group-hover/student:opacity-100 transition-opacity">
                              + To'lov
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openMoveStudentModal(student);
                          }}
                          className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white/40 hover:text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                          title="O'quvchini ko'chirish (guruhini o'zgartirish)"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleArchiveStudent(student.id);
                          }}
                          className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Arxivlash"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    {lessonDates.map(date => {
                      const checkDate = new Date(date).getTime();
                      const checkMonth = date.slice(0, 7);
                      const joinMonth = (student.joinDate || '').slice(0, 7);
                      let isActive = Boolean(student.groupIds?.includes(selectedGroupId));
                      
                      if (joinMonth && checkMonth < joinMonth) isActive = false;
                      if (student.deletedAt && checkDate > new Date(student.deletedAt).getTime()) isActive = false;
                      if (student.archived && student.archivedAt && checkDate > new Date(student.archivedAt).getTime()) isActive = false;

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
                    <span className="text-xs text-white/50">To'lov holati:</span>
                    {hasStudentPendingPayment(payingStudent.id, monthKey, data.payments) ? (
                      <span className="text-xs font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/35">
                        Kutilmoqda (Markaz tasdiqlamagan)
                      </span>
                    ) : getDebtAmount(payingStudent, monthKey, data.payments) > 0 ? (
                      <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                        {formatSum(getDebtAmount(payingStudent, monthKey, data.payments))} qarz
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        To'liq to'langan (Tasdiqlangan)
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
                {(() => {
                  const currentDebt = getDebtAmount(payingStudent, monthKey, data.payments);
                  const standardAmount = currentDebt > 0 ? currentDebt : getExpectedPayment(payingStudent, monthKey);
                  const enteredAmount = parseInt(amountInput.replace(/\D/g, ''), 10) || 0;
                  const remainingDiff = standardAmount > 0 && enteredAmount > 0 && enteredAmount < standardAmount
                    ? (standardAmount - enteredAmount)
                    : 0;

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                        <label className="text-xs font-medium text-white/60">To'lov summasi (so'm)</label>
                        {currentDebt > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setAmountInput(currentDebt.toString());
                              setWaiveRemaining(false);
                            }}
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
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            setAmountInput(val);
                            const num = parseInt(val, 10) || 0;
                            if (num >= standardAmount || num <= 0) {
                              setWaiveRemaining(false);
                            }
                          }}
                          onWheel={e => e.currentTarget.blur()}
                          placeholder="0"
                          required
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 sm:py-3 text-base sm:text-lg font-bold text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-white/40">
                          so'm
                        </span>
                      </div>

                      {/* Chegirma + waive checkbox */}
                      {remainingDiff > 0 && (
                        <div
                          onClick={() => setWaiveRemaining(prev => !prev)}
                          className={cn(
                            "mt-2.5 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer select-none transition-all",
                            waiveRemaining
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/15"
                          )}
                        >
                          <div className="flex flex-col min-w-0">
                            {!waiveRemaining ? (
                              <>
                                <span className="text-xs font-bold text-rose-400">
                                  Chegirma: {formatSum(remainingDiff)}
                                </span>
                                <span className="text-[10px] text-white/50">
                                  Belgilansa chegirma sifatida o'chiriladi (qarz bo'lib qolmaydi)
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-xs font-bold text-emerald-400">
                                  Chegirma: {formatSum(remainingDiff)} (0 so'm qarz)
                                </span>
                                <span className="text-[10px] text-white/50">
                                  {formatSum(remainingDiff)} chegirma qilindi va qarzdorlikka kiritilmaydi
                                </span>
                              </>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setWaiveRemaining(prev => !prev);
                            }}
                            className={cn(
                              "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all",
                              waiveRemaining
                                ? "bg-emerald-500 border-emerald-400 text-white shadow-sm shadow-emerald-500/30"
                                : "bg-black/30 border-rose-400/50 text-transparent hover:border-rose-400"
                            )}
                            title="Chegirma sifatida belgilash"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

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

      {/* Template Student Modal */}
      {showTemplateModal && (
        <div 
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setShowTemplateModal(false)}
        >
          <div 
            className="glass-card border border-white/15 bg-sys-base rounded-2xl sm:rounded-3xl w-full max-w-lg my-auto shadow-2xl relative flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 sm:pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">Shablon orqali o'quvchi qo'shish</h3>
                  <p className="text-xs text-white/50">{group?.name} guruhi uchun</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplateStudents} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
                {/* Format guide banner */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white/70">Kiritish tartibi (shablon):</span>
                    <button
                      type="button"
                      onClick={() => setTemplateInput("[+(Ism Familiya);+(+998901234567);+(300000)]")}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Namuna qo'yish
                    </button>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 select-all break-all">
                    [+(Ism Familiya);+(telefon raqam);+(oylik to'lov summasi)]
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Bir yoki bir nechta o'quvchini ketma-ket qatorlarda kiritishingiz mumkin. Kiritilgan o'quvchilar ushbu guruhga avtomatik qo'shiladi va barcha imkoniyatlar (davomat, to'lovlar, qarz hisobi) to'liq ishlaydi.
                  </p>
                </div>

                {/* Input Textarea */}
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">
                    O'quvchi ma'lumotlari matni
                  </label>
                  <textarea
                    value={templateInput}
                    onChange={e => setTemplateInput(e.target.value)}
                    rows={4}
                    placeholder={`[+(Xurramov Eldor);+(+998901234567);+(300000)]\n[+(Karimov Sardor);+(+998912345678);+(350000)]`}
                    className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-sm text-white font-mono placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all custom-scrollbar resize-y min-h-[90px]"
                  />
                </div>

                {/* Live Preview List */}
                {parsedTemplateStudents.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/60 px-0.5">
                      <span>Tanib olingan o'quvchilar ({validTemplateStudents.length}/{parsedTemplateStudents.length}):</span>
                    </div>

                    <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                      {parsedTemplateStudents.map((s, idx) => (
                        <div 
                          key={idx}
                          className={cn(
                            "rounded-xl p-3 border text-xs flex items-center justify-between gap-3 transition-colors",
                            s.isValid 
                              ? "bg-emerald-500/5 border-emerald-500/20 text-white" 
                              : "bg-rose-500/5 border-rose-500/20 text-rose-300"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {s.isValid ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate">
                                {s.fullName || "(Nomsiz)"}
                              </div>
                              <div className="text-[11px] text-white/50 truncate">
                                {s.phone ? `Tel: ${s.phone}` : "Tel: kiritilmagan"}
                              </div>
                              {!s.isValid && s.error && (
                                <div className="text-[10px] text-rose-400 mt-0.5">{s.error}</div>
                              )}
                            </div>
                          </div>

                          {s.isValid && (
                            <div className="text-right shrink-0">
                              <div className="font-bold text-emerald-400">{formatSum(s.monthlyPayment)}</div>
                              <div className="text-[10px] text-white/40">
                                {s.usedGroupDefault ? "guruh to'lovi (avto)" : "oylik to'lov"}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-4 sm:p-5 pt-3 border-t border-white/10 shrink-0 bg-sys-base/95 backdrop-blur-md flex items-center gap-2 sm:gap-3 rounded-b-2xl sm:rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-medium text-xs sm:text-sm transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={validTemplateStudents.length === 0 || isSavingTemplate}
                  className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  {isSavingTemplate ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Saqlash {validTemplateStudents.length > 0 ? `(${validTemplateStudents.length} ta)` : ''}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Student to Another Group Modal */}
      {movingStudent && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setMovingStudent(null)}
        >
          <div
            className="glass-card border border-white/15 bg-sys-base rounded-2xl sm:rounded-3xl w-full max-w-md my-auto shadow-2xl relative flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 sm:pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight truncate">
                    O'quvchini ko'chirish
                  </h3>
                  <p className="text-xs text-white/50 truncate">
                    {movingStudent.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMovingStudent(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmMoveStudent} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-xs text-white/70 leading-relaxed">
                  O'quvchi hozirda biriktirilgan guruhlar <span className="text-emerald-400 font-semibold">yashil</span> rangda belgilangan. Hozirgi guruhni o'chirib, yangi guruhni tanlashingiz mumkin — barcha to'lov va qarzdorlik hisob-kitoblari o'zgarishsiz saqlanadi.
                </div>

                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider px-0.5">
                    Barcha guruhlar ({activeGroups.length})
                  </label>

                  <div className="space-y-2">
                    {activeGroups.map(g => {
                      const isSelected = selectedMoveGroupIds.includes(g.id);
                      const wasOriginallyInGroup = (movingStudent.groupIds || []).includes(g.id);
                      const effectiveDays = (g.days && g.days.length > 0) ? g.days : [1, 2, 3, 4, 5, 6];
                      const daysStr = effectiveDays.map(d => DAY_NAMES_SHORT[d]).join('-');

                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleMoveGroupSelection(g.id)}
                          className={cn(
                            "w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer select-none",
                            isSelected
                              ? "bg-emerald-500/20 border-emerald-500/50 text-white shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-400/40"
                              : "bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08] hover:border-white/20"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all",
                                isSelected
                                  ? "bg-emerald-500 border-emerald-400 text-white shadow-sm shadow-emerald-500/30"
                                  : "bg-black/30 border-white/20 text-transparent"
                              )}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn("font-bold text-sm truncate", isSelected ? "text-emerald-300" : "text-white")}>
                                  {g.name}
                                </span>
                                {g.time && (
                                  <span className={cn(
                                    "text-[11px] px-2 py-0.5 rounded-md font-medium",
                                    isSelected ? "bg-emerald-500/25 text-emerald-200" : "bg-white/10 text-white/60"
                                  )}>
                                    {g.time}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-white/50 mt-0.5">
                                {daysStr}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isSelected && wasOriginallyInGroup && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold">
                                Hozirgi guruh
                              </span>
                            )}
                            {isSelected && !wasOriginallyInGroup && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold">
                                Yangi guruh
                              </span>
                            )}
                            {!isSelected && wasOriginallyInGroup && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-semibold">
                                O'chirilmoqda
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedMoveGroupIds.length === 0 && (
                    <p className="text-xs text-rose-400 font-medium px-1 pt-1">
                      Kamida bitta guruh tanlanishi kerak!
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 sm:p-5 pt-3 border-t border-white/10 shrink-0 bg-sys-base/95 backdrop-blur-md flex items-center gap-2 sm:gap-3 rounded-b-2xl sm:rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setMovingStudent(null)}
                  className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-medium text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={selectedMoveGroupIds.length === 0}
                  className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Saqlash</span>
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
