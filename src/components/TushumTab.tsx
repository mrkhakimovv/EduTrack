import { useMemo, useState } from 'react';
import {
  AppData,
  PaymentRecord,
  formatSum,
  formatDateTime,
  formatMonthKey,
  isPaymentPending
} from '../lib/store';
import {
  Wallet,
  CheckCircle2,
  Clock,
  GraduationCap,
  Bell,
  Search,
  Check,
  CheckCheck,
  Users,
  Sparkles,
  Filter
} from 'lucide-react';
import { cn } from '../lib/utils';

interface TushumTabProps {
  data: AppData;
  monthKey: string;
  teachers: any[];
  centerId?: string;
  updatePayment: (id: string, updates: Partial<PaymentRecord>) => Promise<void> | void;
}

interface TeacherRevenueStat {
  teacherId: string;
  teacherName: string;
  subject?: string;
  acceptedAmount: number;
  pendingAmount: number;
  totalAmount: number;
  acceptedCount: number;
  pendingCount: number;
  groupsCount: number;
}

export function TushumTab({
  data,
  monthKey,
  teachers = [],
  centerId,
  updatePayment
}: TushumTabProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted'>('all');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptingAll, setAcceptingAll] = useState(false);

  // Map teacher ID -> teacher info
  const teacherMap = useMemo(() => {
    const map = new Map<string, { id: string; fullName: string; subject?: string }>();
    teachers.forEach(t => {
      const id = t.uid || t.id;
      if (id) {
        map.set(id, {
          id,
          fullName: t.fullName || "O'qituvchi",
          subject: t.subject
        });
      }
    });
    // Also check groups for any teacher references
    data.groups.forEach(g => {
      if (g.teacherId && !map.has(g.teacherId)) {
        map.set(g.teacherId, {
          id: g.teacherId,
          fullName: g.teacherName || "O'qituvchi"
        });
      }
    });
    return map;
  }, [teachers, data.groups]);

  // Helper to resolve which teacher collected or owns a payment
  const resolvePaymentTeacher = useCallbackPaymentTeacher(data, teacherMap, centerId);

  // Filter payments for the selected month
  const monthPayments = useMemo(() => {
    return data.payments
      .filter(p => p.month === monthKey)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.payments, monthKey]);

  // Enrich payments with student, group, teacher, and pending/accepted status
  const enrichedPayments = useMemo(() => {
    return monthPayments.map(p => {
      const student = data.students.find(s => s.id === p.studentId);
      const studentGroups = data.groups.filter(g => student?.groupIds?.includes(g.id));
      const teacherInfo = resolvePaymentTeacher(p, student, studentGroups);
      const isPending = isPaymentPending(p);

      return {
        payment: p,
        student,
        studentName: student?.fullName || "Noma'lum o'quvchi",
        groupNames: studentGroups.map(g => g.name).join(', '),
        teacherId: teacherInfo.id,
        teacherName: teacherInfo.fullName,
        teacherSubject: teacherInfo.subject,
        isPending
      };
    });
  }, [monthPayments, data.students, data.groups, resolvePaymentTeacher]);

  // Compute overall totals for the month
  const overallStats = useMemo(() => {
    let acceptedAmount = 0;
    let pendingAmount = 0;
    let acceptedCount = 0;
    let pendingCount = 0;

    enrichedPayments.forEach(item => {
      if (item.isPending) {
        pendingAmount += item.payment.amount;
        pendingCount++;
      } else {
        acceptedAmount += item.payment.amount;
        acceptedCount++;
      }
    });

    return {
      acceptedAmount,
      pendingAmount,
      totalAmount: acceptedAmount + pendingAmount,
      acceptedCount,
      pendingCount,
      totalCount: acceptedCount + pendingCount
    };
  }, [enrichedPayments]);

  // Compute per-teacher statistics
  const teacherStatsList = useMemo(() => {
    const statsById = new Map<string, TeacherRevenueStat>();

    // Initialize with all registered teachers of the center
    teachers.forEach(t => {
      const id = t.uid || t.id;
      if (!id) return;
      const groupsCount = data.groups.filter(
        g => !g.deletedAt && !g.archived && g.teacherId === id
      ).length;

      statsById.set(id, {
        teacherId: id,
        teacherName: t.fullName || "O'qituvchi",
        subject: t.subject,
        acceptedAmount: 0,
        pendingAmount: 0,
        totalAmount: 0,
        acceptedCount: 0,
        pendingCount: 0,
        groupsCount
      });
    });

    // Aggregate payments into each teacher's bucket
    enrichedPayments.forEach(item => {
      const tId = item.teacherId || 'center_direct';
      if (!statsById.has(tId)) {
        const groupsCount = data.groups.filter(
          g => !g.deletedAt && !g.archived && g.teacherId === tId
        ).length;
        statsById.set(tId, {
          teacherId: tId,
          teacherName: item.teacherName,
          subject: item.teacherSubject,
          acceptedAmount: 0,
          pendingAmount: 0,
          totalAmount: 0,
          acceptedCount: 0,
          pendingCount: 0,
          groupsCount
        });
      }

      const st = statsById.get(tId)!;
      if (item.isPending) {
        st.pendingAmount += item.payment.amount;
        st.pendingCount += 1;
      } else {
        st.acceptedAmount += item.payment.amount;
        st.acceptedCount += 1;
      }
      st.totalAmount = st.acceptedAmount + st.pendingAmount;
    });

    return Array.from(statsById.values()).sort((a, b) => {
      if (b.pendingAmount !== a.pendingAmount) return b.pendingAmount - a.pendingAmount;
      return b.totalAmount - a.totalAmount;
    });
  }, [teachers, data.groups, enrichedPayments]);

  // Filtered notifications list
  const filteredNotifications = useMemo(() => {
    return enrichedPayments.filter(item => {
      if (statusFilter === 'pending' && !item.isPending) return false;
      if (statusFilter === 'accepted' && item.isPending) return false;
      if (selectedTeacherFilter !== 'all' && item.teacherId !== selectedTeacherFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchStudent = item.studentName.toLowerCase().includes(q);
        const matchTeacher = item.teacherName.toLowerCase().includes(q);
        const matchGroup = item.groupNames.toLowerCase().includes(q);
        if (!matchStudent && !matchTeacher && !matchGroup) return false;
      }
      return true;
    });
  }, [enrichedPayments, statusFilter, selectedTeacherFilter, searchQuery]);

  const handleAcceptPayment = async (paymentId: string) => {
    setAcceptingId(paymentId);
    try {
      await updatePayment(paymentId, {
        centerStatus: 'accepted',
        acceptedAt: new Date().toISOString()
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleAcceptTeacherPayments = async (teacherId: string) => {
    const pendingItems = enrichedPayments.filter(
      item => item.isPending && item.teacherId === teacherId
    );
    if (pendingItems.length === 0) return;

    setAcceptingAll(true);
    try {
      const nowIso = new Date().toISOString();
      await Promise.all(
        pendingItems.map(item =>
          updatePayment(item.payment.id, {
            centerStatus: 'accepted',
            acceptedAt: nowIso
          })
        )
      );
    } finally {
      setAcceptingAll(false);
    }
  };

  const handleAcceptAllPending = async () => {
    const pendingItems = enrichedPayments.filter(item => item.isPending);
    if (pendingItems.length === 0) return;

    setAcceptingAll(true);
    try {
      const nowIso = new Date().toISOString();
      await Promise.all(
        pendingItems.map(item =>
          updatePayment(item.payment.id, {
            centerStatus: 'accepted',
            acceptedAt: nowIso
          })
        )
      );
    } finally {
      setAcceptingAll(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar p-4 sm:p-6">
      {/* Top Header & Month Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>O'quv markaz tushumlari</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 font-medium">
                {formatMonthKey(monthKey)}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-white/50">
              O'qituvchilar tomonidan qabul qilingan to'lovlar xabarnomasi va tasdiqlash bo'limi
            </p>
          </div>
        </div>

        {overallStats.pendingCount > 0 && (
          <button
            type="button"
            onClick={handleAcceptAllPending}
            disabled={acceptingAll}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/25 transition-all shrink-0 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Barchasini tasdiqlash ({overallStats.pendingCount} ta)</span>
          </button>
        )}
      </div>

      {/* 3 Main Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        {/* Accepted Revenue (Green) */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2 shadow-lg shadow-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-emerald-300/90">
              Tasdiqlangan summa (Markazda)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 tracking-tight">
            {formatSum(overallStats.acceptedAmount)}
          </div>
          <div className="flex items-center justify-between text-xs text-emerald-300/70 pt-1 border-t border-emerald-500/15">
            <span>Tasdiqlangan to'lovlar:</span>
            <span className="font-bold text-emerald-300">{overallStats.acceptedCount} ta</span>
          </div>
        </div>

        {/* Unaccepted / Pending Revenue (Yellow) */}
        <div className="bg-amber-500/10 border border-amber-500/35 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2 shadow-lg shadow-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-amber-300/90">
              Tasdiqlanmagan summa (Kutilmoqda)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-400 tracking-tight">
            {formatSum(overallStats.pendingAmount)}
          </div>
          <div className="flex items-center justify-between text-xs text-amber-300/70 pt-1 border-t border-amber-500/15">
            <span>Tasdiqlash kutilmoqda:</span>
            <span className="font-bold text-amber-300">{overallStats.pendingCount} ta</span>
          </div>
        </div>

        {/* Total Collected Revenue */}
        <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-blue-300/90">
              Jami kiritilgan tushum
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {formatSum(overallStats.totalAmount)}
          </div>
          <div className="flex items-center justify-between text-xs text-blue-300/70 pt-1 border-t border-blue-500/15">
            <span>Jami to'lovlar soni:</span>
            <span className="font-bold text-blue-300">{overallStats.totalCount} ta</span>
          </div>
        </div>
      </div>

      {/* Per-Teacher Revenue Breakdown */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-400" />
            <h3 className="text-base sm:text-lg font-bold text-white">
              O'qituvchilar kesimida tushum statistikasi
            </h3>
          </div>
          {selectedTeacherFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedTeacherFilter('all')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
            >
              Barcha o'qituvchilarni ko'rsatish
            </button>
          )}
        </div>

        {teacherStatsList.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white/40 text-sm">
            O'quv markazga biriktirilgan o'qituvchilar yoki to'lovlar topilmadi
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teacherStatsList.map(tStat => {
              const isSelected = selectedTeacherFilter === tStat.teacherId;
              const acceptedPercent =
                tStat.totalAmount > 0
                  ? Math.round((tStat.acceptedAmount / tStat.totalAmount) * 100)
                  : 0;

              return (
                <div
                  key={tStat.teacherId}
                  onClick={() =>
                    setSelectedTeacherFilter(
                      isSelected ? 'all' : tStat.teacherId
                    )
                  }
                  className={cn(
                    "rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 cursor-pointer",
                    isSelected
                      ? "bg-purple-500/15 border-purple-400/50 shadow-lg shadow-purple-950/30"
                      : tStat.pendingAmount > 0
                      ? "bg-amber-500/[0.06] border-amber-500/30 hover:bg-amber-500/10"
                      : "bg-white/5 border-white/10 hover:bg-white/[0.08]"
                  )}
                >
                  {/* Teacher Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-sm shrink-0">
                        {tStat.teacherName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-white text-sm sm:text-base truncate">
                          {tStat.teacherName}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {tStat.subject && (
                            <span className="text-[10px] px-2 py-0.2 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                              {tStat.subject}
                            </span>
                          )}
                          <span className="text-[11px] text-white/40">
                            {tStat.groupsCount} ta guruh
                          </span>
                        </div>
                      </div>
                    </div>

                    {tStat.pendingCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {tStat.pendingCount} ta kutilmoqda
                      </span>
                    ) : tStat.acceptedCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Tasdiqlangan
                      </span>
                    ) : null}
                  </div>

                  {/* Accepted vs Unaccepted Amounts */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                    {/* Tasdiqlangan summa (Green) */}
                    <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-2.5 flex flex-col">
                      <span className="text-[10px] text-emerald-300/80 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Tasdiqlangan
                      </span>
                      <span className="font-bold text-emerald-400 text-xs sm:text-sm mt-1 truncate">
                        {formatSum(tStat.acceptedAmount)}
                      </span>
                      <span className="text-[10px] text-emerald-300/60 mt-0.5">
                        {tStat.acceptedCount} ta to'lov
                      </span>
                    </div>

                    {/* Tasdiqlanmagan summa (Yellow) */}
                    <div
                      className={cn(
                        "rounded-xl p-2.5 flex flex-col border",
                        tStat.pendingAmount > 0
                          ? "bg-amber-500/15 border-amber-500/35"
                          : "bg-white/5 border-white/10"
                      )}
                    >
                      <span
                        className={cn(
                          "text-[10px] font-medium flex items-center gap-1",
                          tStat.pendingAmount > 0 ? "text-amber-300" : "text-white/40"
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            tStat.pendingAmount > 0 ? "bg-amber-400" : "bg-white/30"
                          )}
                        />
                        Tasdiqlanmagan
                      </span>
                      <span
                        className={cn(
                          "font-bold text-xs sm:text-sm mt-1 truncate",
                          tStat.pendingAmount > 0 ? "text-amber-400" : "text-white/50"
                        )}
                      >
                        {formatSum(tStat.pendingAmount)}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] mt-0.5",
                          tStat.pendingAmount > 0 ? "text-amber-300/70" : "text-white/30"
                        )}
                      >
                        {tStat.pendingCount} ta to'lov
                      </span>
                    </div>
                  </div>

                  {/* Progress & Quick Confirm Button */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-white/50 mb-1">
                        <span>Jami: {formatSum(tStat.totalAmount)}</span>
                        <span className="text-emerald-400 font-semibold">{acceptedPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-amber-500/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                          style={{ width: `${acceptedPercent}%` }}
                        />
                      </div>
                    </div>

                    {tStat.pendingCount > 0 && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleAcceptTeacherPayments(tStat.teacherId);
                        }}
                        disabled={acceptingAll}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                        title="Shu o'qituvchining barcha kutilayotgan to'lovlarini tasdiqlash"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Tasdiqlash</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="w-full h-px bg-white/10 shrink-0" />

      {/* Payment Notifications List */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="text-base sm:text-lg font-bold text-white">
              To'lov xabarnomalari
            </h3>
            {overallStats.pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-black">
                {overallStats.pendingCount} ta yangi
              </span>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                statusFilter === 'all'
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              )}
            >
              Barchasi ({overallStats.totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer",
                statusFilter === 'pending'
                  ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20"
                  : "bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20"
              )}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Tasdiqlanmagan ({overallStats.pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('accepted')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer",
                statusFilter === 'accepted'
                  ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20"
                  : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20"
              )}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Tasdiqlangan ({overallStats.acceptedCount})
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="O'quvchi ism-familiyasi, o'qituvchi yoki guruh bo'yicha izlash..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white/40 text-sm">
            Tanlangan filtr bo'yicha to'lov xabarnomalari topilmadi
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredNotifications.map(item => {
              const { payment: p, studentName, groupNames, teacherName, isPending } = item;
              const isAcceptingThis = acceptingId === p.id;

              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-2xl p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                    isPending
                      ? "bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/15 shadow-md shadow-amber-950/20"
                      : "bg-emerald-500/10 border-emerald-500/35 hover:bg-emerald-500/15 shadow-md shadow-emerald-950/10"
                  )}
                >
                  {/* Left: Student & Teacher Notification Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border",
                        isPending
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                          : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      )}
                    >
                      {isPending ? (
                        <Clock className="w-5 h-5" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-sm sm:text-base font-bold truncate",
                            isPending ? "text-amber-200" : "text-emerald-200"
                          )}
                        >
                          {studentName}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold border",
                            isPending
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          )}
                        >
                          {isPending
                            ? "Tasdiqlanmagan (Sariq)"
                            : "Tasdiqlangan (Yashil)"}
                        </span>
                      </div>

                      {/* Notification message about which teacher accepted the payment */}
                      <p className="text-xs sm:text-sm text-white/85 mt-1">
                        <span className="text-white/50">To'lovni qabul qildi: </span>
                        <span className="font-semibold text-purple-300">
                          🎓 {teacherName}
                        </span>
                        {groupNames && (
                          <span className="text-white/60">
                            {" "}• Guruh: <strong className="text-white/80">{groupNames}</strong>
                          </span>
                        )}
                      </p>

                      {/* Meta tags: Date, Note (Naqd/Karta), AcceptedAt */}
                      <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[11px] text-white/50">
                        <span>Kiritilgan vaqt: {p.date ? formatDateTime(p.date) : "-"}</span>
                        {p.note && (
                          <>
                            <span>•</span>
                            <span className="px-2 py-0.2 rounded bg-white/10 text-white/80 font-semibold uppercase text-[10px]">
                              {p.note}
                            </span>
                          </>
                        )}
                        {!isPending && p.acceptedAt && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-300/80">
                              Markaz tasdiqladi: {formatDateTime(p.acceptedAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Confirm Action */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 shrink-0">
                    <div className="flex flex-col sm:items-end">
                      <span
                        className={cn(
                          "text-base sm:text-lg font-extrabold",
                          isPending ? "text-amber-400" : "text-emerald-400"
                        )}
                      >
                        {formatSum(p.amount)}
                      </span>
                      <span className="text-[10px] text-white/50">
                        {formatMonthKey(p.month)} uchun
                      </span>
                    </div>

                    {isPending ? (
                      <button
                        type="button"
                        onClick={() => handleAcceptPayment(p.id)}
                        disabled={isAcceptingThis || acceptingAll}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isAcceptingThis ? "Tasdiqlanmoqda..." : "Tasdiqlash"}</span>
                      </button>
                    ) : (
                      <div className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Tasdiqlandi</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function useCallbackPaymentTeacher(
  data: AppData,
  teacherMap: Map<string, { id: string; fullName: string; subject?: string }>,
  centerId?: string
) {
  return useMemo(() => {
    return (
      p: PaymentRecord,
      student: AppData['students'][number] | undefined,
      studentGroups: AppData['groups']
    ): { id: string; fullName: string; subject?: string } => {
      // 1. Direct teacherId on payment (if not the center admin itself)
      if (p.teacherId && p.teacherId !== centerId) {
        const known = teacherMap.get(p.teacherId);
        if (known) return known;
        if (p.teacherName) {
          return { id: p.teacherId, fullName: p.teacherName };
        }
      }

      // 2. From student's assigned group teacher
      for (const grp of studentGroups) {
        if (grp.teacherId && grp.teacherId !== centerId) {
          const known = teacherMap.get(grp.teacherId);
          if (known) return known;
          if (grp.teacherName) {
            return { id: grp.teacherId, fullName: grp.teacherName };
          }
        }
      }

      // 3. From student's teacherId
      if (student?.teacherId && student.teacherId !== centerId) {
        const known = teacherMap.get(student.teacherId);
        if (known) return known;
        if (student.teacherName) {
          return { id: student.teacherId, fullName: student.teacherName };
        }
      }

      // 4. Fallback if entered directly by learning center administration
      return {
        id: 'center_direct',
        fullName: p.teacherName || "Markaz ma'muriyati"
      };
    };
  }, [teacherMap, centerId]);
}
