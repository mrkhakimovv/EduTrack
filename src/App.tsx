import { useState, useEffect, useMemo } from 'react';
import { useAppData } from './hooks/use-app-data';
import { useAuth } from './components/FirebaseAuthProvider';
import { db } from './lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { AlertTriangle, User, Building2, Users, GraduationCap, CheckCircle2, Clock } from 'lucide-react';
import { Header } from './components/Header';
import { MonthSelector } from './components/MonthSelector';
import { ActionTabs, TabId } from './components/ActionTabs';
import { AttendanceTab } from './components/AttendanceTab';
import { PaymentTab } from './components/PaymentTab';
import { DebtorsTab } from './components/DebtorsTab';
import { BlacklistTab } from './components/BlacklistTab';
import { TushumTab } from './components/TushumTab';
import { StatsTab } from './components/StatsTab';
import { SettingsTab } from './components/SettingsTab';
import { GroupModal } from './components/GroupModal';
import { StudentModal } from './components/StudentModal';
import { AllStudents } from './components/AllStudents';
import { AllGroups } from './components/AllGroups';
import { TeachersManagementModal } from './components/TeachersManagementModal';
import { isPaymentPending, formatSum } from './lib/store';
import { cn } from './lib/utils';

export default function App() {
  const { appUser } = useAuth();
  const {
    data,
    addGroup, updateGroup, deleteGroup,
    addStudent, updateStudent, deleteStudent,
    setAttendance,
    addPayment, updatePayment, deletePayment
  } = useAppData(appUser);

  const [activeTab, setActiveTab] = useState<TabId>('attendance');
  const [selectedTeacherAccountId, setSelectedTeacherAccountId] = useState<string>('');
  
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  
  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editGroupObj, setEditGroupObj] = useState<any>(null);

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editStudentObj, setEditStudentObj] = useState<any>(null);

  const [showAllStudents, setShowAllStudents] = useState(false);
  const [showAllGroups, setShowAllGroups] = useState(false);

  // Teachers management state for learning center admin
  const [showTeachersModal, setShowTeachersModal] = useState(false);
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [teachersList, setTeachersList] = useState<any[]>([]);

  // Listen to teachers for the center if center_admin; for a teacher account, only keep that teacher
  useEffect(() => {
    if (appUser?.role === 'center_admin') {
      const q = query(
        collection(db, 'users'),
        where('centerId', '==', appUser.uid),
        where('role', '==', 'teacher')
      );
      const unsub = onSnapshot(q, (snap) => {
        const loaded = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        loaded.sort((a: any, b: any) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        setTeachersList(loaded);
      }, (e) => {
        console.warn("Could not load teachers in App:", e);
      });
      return () => unsub();
    } else if (appUser?.role === 'teacher') {
      setTeachersList([{
        uid: appUser.uid,
        id: appUser.uid,
        fullName: appUser.fullName,
        subject: appUser.subject,
        teacherId: appUser.teacherId
      }]);
    } else {
      setTeachersList([]);
    }
  }, [appUser?.role, appUser?.uid, appUser?.fullName, appUser?.subject, appUser?.teacherId]);

  // Always select a specific teacher account when teachersList is available so teacher accounts never mix
  useEffect(() => {
    if (teachersList.length > 0) {
      const exists = teachersList.some(t => (t.uid || t.id) === selectedTeacherAccountId);
      if (!selectedTeacherAccountId || !exists) {
        setSelectedTeacherAccountId(teachersList[0].uid || teachersList[0].id);
      }
    } else {
      setSelectedTeacherAccountId('');
    }
  }, [teachersList, selectedTeacherAccountId]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'number') {
        activeEl.blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const monthEndDateTs = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).getTime();
  const monthStartDateTs = new Date(selectedYear, selectedMonth, 1).getTime();

  // Strict helper to determine if a group belongs to a specific teacher object
  const doesGroupBelongToTeacher = (g: any, teacherObj: any) => {
    if (!teacherObj) return false;
    const tId = teacherObj.uid || teacherObj.id;
    if (g.teacherId) {
      return g.teacherId === tId || Boolean(teacherObj.teacherId && g.teacherId === teacherObj.teacherId);
    }
    if (
      g.teacherName &&
      teacherObj.fullName &&
      g.teacherName.trim().toLowerCase() === teacherObj.fullName.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  };

  const selectedTeacherObj = useMemo(() => {
    if (!selectedTeacherAccountId) return teachersList[0] || null;
    return teachersList.find(t => (t.uid || t.id) === selectedTeacherAccountId) || teachersList[0] || null;
  }, [teachersList, selectedTeacherAccountId]);

  if (!data) {
    return (
      <div className="gradient-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Compute historically accurate groups for the selected month
  const allMonthGroups = data.groups
    .filter(g => {
      const createdTs = new Date(g.createdAt).getTime();
      if (createdTs > monthEndDateTs) return false;
      if (g.deletedAt && new Date(g.deletedAt).getTime() < monthStartDateTs) return false;
      if (g.archived && g.archivedAt && new Date(g.archivedAt).getTime() < monthStartDateTs) return false;
      return true;
    })
    .map(g => {
      let state = { ...g };
      if (state.history && state.history.length > 0) {
        const editsAfterMonth = state.history.filter(h => new Date(h.updatedAt).getTime() > monthEndDateTs);
        editsAfterMonth.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        if (editsAfterMonth.length > 0) {
          const revertState = editsAfterMonth[0];
          state.name = revertState.name;
          state.time = revertState.time;
          state.days = revertState.days;
          state.archived = revertState.archived;
          state.archivedAt = revertState.archivedAt;
          state.deletedAt = revertState.deletedAt;
        }
      }
      return state;
    });

  // Compute historically accurate students for the selected month
  const allMonthStudents = data.students
    .filter(s => {
      const createdTs = new Date(s.createdAt).getTime();
      if (createdTs > monthEndDateTs) return false;
      if (s.deletedAt && new Date(s.deletedAt).getTime() < monthStartDateTs) return false;
      if (s.archived && s.archivedAt && new Date(s.archivedAt).getTime() < monthStartDateTs) return false;
      return true;
    })
    .map(s => {
      let state = { ...s };
      if (state.history && state.history.length > 0) {
        const editsAfterMonth = state.history.filter(h => new Date(h.updatedAt).getTime() > monthEndDateTs);
        editsAfterMonth.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        if (editsAfterMonth.length > 0) {
          const revertState = editsAfterMonth[0];
          state.fullName = revertState.fullName;
          state.phone = revertState.phone;
          state.parentPhone = revertState.parentPhone;
          state.school = revertState.school;
          state.grade = revertState.grade;
          state.groupIds = revertState.groupIds;
          state.joinDate = revertState.joinDate;
          state.firstMonthPayment = revertState.firstMonthPayment;
          state.monthlyPayment = revertState.monthlyPayment;
          state.groupPricing = revertState.groupPricing;
          state.archived = revertState.archived;
          state.archivedAt = revertState.archivedAt;
          state.deletedAt = revertState.deletedAt;
        }
      }
      return state;
    });

  // Compute per-teacher summary stats for the left sidebar account cards
  const teacherAccountsSummary = teachersList.map(t => {
    const tId = t.uid || t.id;
    const tGroups = allMonthGroups.filter(g => !g.deletedAt && !g.archived && doesGroupBelongToTeacher(g, t));
    const tGroupIds = new Set(tGroups.map(g => g.id));
    const tStudents = allMonthStudents.filter(
      s =>
        !s.deletedAt &&
        !s.archived &&
        ((s.groupIds || []).some(gid => tGroupIds.has(gid)) || s.teacherId === tId)
    );
    const tStudentIds = new Set(tStudents.map(s => s.id));
    const tPayments = data.payments.filter(
      p =>
        p.month === monthKey &&
        (p.teacherId === tId || ((!p.teacherId || p.teacherId === appUser?.uid) && tStudentIds.has(p.studentId)))
    );
    const collectedAmount = tPayments.reduce((sum, p) => sum + p.amount, 0);
    const pendingCount = tPayments.filter(p => isPaymentPending(p)).length;

    return {
      teacher: t,
      id: tId,
      fullName: t.fullName || "O'qituvchi",
      subject: t.subject || "O'qituvchi",
      code: t.teacherId || t.login || "",
      groupsCount: tGroups.length,
      studentsCount: tStudents.length,
      collectedAmount,
      pendingCount
    };
  });

  // Strictly isolate groups, students, and payments per teacher account for center_admin
  const isCenterAdmin = appUser?.role === 'center_admin';

  const activeGroups = isCenterAdmin
    ? selectedTeacherObj
      ? allMonthGroups.filter(g => doesGroupBelongToTeacher(g, selectedTeacherObj))
      : []
    : allMonthGroups;

  const activeGroupIdsSet = new Set(activeGroups.map(g => g.id));

  const activeStudents = isCenterAdmin
    ? selectedTeacherObj
      ? allMonthStudents
          .filter(s => {
            const tId = selectedTeacherObj.uid || selectedTeacherObj.id;
            if ((s.groupIds || []).some(gid => activeGroupIdsSet.has(gid))) return true;
            if (s.teacherId === tId) return true;
            if (s.history && s.history.some(h => (h.groupIds || []).some(gid => activeGroupIdsSet.has(gid)))) {
              return true;
            }
            return false;
          })
          .map(s => {
            const filteredGroupIds = (s.groupIds || []).filter(gid => activeGroupIdsSet.has(gid));
            if (filteredGroupIds.length > 0 && filteredGroupIds.length !== (s.groupIds || []).length) {
              return {
                ...s,
                groupIds: filteredGroupIds
              };
            }
            return s;
          })
      : []
    : allMonthStudents;

  const activeStudentIdsSet = new Set(activeStudents.map(s => s.id));

  const activePayments = isCenterAdmin
    ? selectedTeacherObj
      ? data.payments.filter(p => {
          const tId = selectedTeacherObj.uid || selectedTeacherObj.id;
          if (p.teacherId === tId) return true;
          if ((!p.teacherId || p.teacherId === appUser?.uid) && activeStudentIdsSet.has(p.studentId)) {
            return true;
          }
          return false;
        })
      : []
    : data.payments;

  const monthArchivedStudentsCount = data.students.filter(s => {
    const createdTs = new Date(s.createdAt).getTime();
    if (createdTs > monthEndDateTs) return false;
    if (s.deletedAt && new Date(s.deletedAt).getTime() < monthStartDateTs) return false;
    if (isCenterAdmin) {
      if (!selectedTeacherObj) return false;
      const tId = selectedTeacherObj.uid || selectedTeacherObj.id;
      const belongs =
        (s.groupIds || []).some(gid => activeGroupIdsSet.has(gid)) || s.teacherId === tId;
      if (!belongs) return false;
    }
    if (s.archived && s.archivedAt && new Date(s.archivedAt).getTime() < monthEndDateTs) return true;
    return false;
  }).length;
  
  const activeData = {
    ...data,
    students: activeStudents,
    groups: activeGroups,
    payments: activePayments,
  };

  // Strictly scope full data for "Barcha o'quvchilar" and "Barcha guruhlar" modals to the selected teacher
  const scopedFullGroups = isCenterAdmin
    ? selectedTeacherObj
      ? data.groups.filter(g => doesGroupBelongToTeacher(g, selectedTeacherObj))
      : []
    : data.groups;
  const scopedFullGroupIds = new Set(scopedFullGroups.map(g => g.id));
  const scopedFullStudents = isCenterAdmin
    ? selectedTeacherObj
      ? data.students.filter(s => {
          const tId = selectedTeacherObj.uid || selectedTeacherObj.id;
          return (s.groupIds || []).some(gid => scopedFullGroupIds.has(gid)) || s.teacherId === tId;
        })
      : []
    : data.students;
  const scopedFullData = {
    ...data,
    groups: scopedFullGroups,
    students: scopedFullStudents,
    payments: activePayments
  };

  const pendingPaymentsCount = activePayments.filter(
    p => p.month === monthKey && isPaymentPending(p)
  ).length;

  // Wrappers for modals and teacher-scoped mutations
  const openCreateGroup = () => { setEditGroupObj(null); setShowGroupModal(true); };
  const openEditGroup = (id: string) => { setEditGroupObj(data.groups.find(g => g.id === id)); setShowGroupModal(true); };
  
  const openCreateStudent = () => { setEditStudentObj(null); setShowStudentModal(true); };
  const openEditStudent = (id: string) => { setEditStudentObj(data.students.find(s => s.id === id)); setShowStudentModal(true); };

  const handleSaveGroup = (groupData: any) => {
    const finalGroupData = { ...groupData };
    if (appUser?.role === 'teacher') {
      finalGroupData.teacherId = appUser.uid;
      finalGroupData.teacherName = appUser.fullName;
    } else if (appUser?.role === 'center_admin') {
      if (!finalGroupData.teacherId && selectedTeacherObj) {
        finalGroupData.teacherId = selectedTeacherObj.uid || selectedTeacherObj.id;
        finalGroupData.teacherName = selectedTeacherObj.fullName;
      }
      if (finalGroupData.teacherId) {
        const matchedTeacher = teachersList.find(t => (t.uid || t.id) === finalGroupData.teacherId);
        if (matchedTeacher && !finalGroupData.teacherName) {
          finalGroupData.teacherName = matchedTeacher.fullName;
        }
        setSelectedTeacherAccountId(finalGroupData.teacherId);
      }
    }

    if (editGroupObj) {
      updateGroup(editGroupObj.id, finalGroupData);
    } else {
      addGroup(finalGroupData);
    }
    setShowGroupModal(false);
  };

  const handleScopedAddStudent = (studentData: any) => {
    const finalStudentData = { ...studentData };
    if (!finalStudentData.teacherId && selectedTeacherObj) {
      finalStudentData.teacherId = selectedTeacherObj.uid || selectedTeacherObj.id;
      finalStudentData.teacherName = selectedTeacherObj.fullName;
    }
    return addStudent(finalStudentData);
  };

  const handleSaveStudent = (studentData: any) => {
    if (editStudentObj) updateStudent(editStudentObj.id, studentData);
    else handleScopedAddStudent(studentData);
    setShowStudentModal(false);
  };

  const handleScopedAddPayment = (paymentData: any) => {
    const finalPayment = { ...paymentData };
    if (!finalPayment.teacherId && selectedTeacherObj) {
      finalPayment.teacherId = selectedTeacherObj.uid || selectedTeacherObj.id;
      finalPayment.teacherName = selectedTeacherObj.fullName;
    }
    return addPayment(finalPayment);
  };

  const toggleArchiveGroup = (id: string) => {
    const group = data.groups.find(g => g.id === id);
    if (group) {
      const isArchiving = !group.archived;
      updateGroup(id, { archived: isArchiving, archivedAt: isArchiving ? new Date().toISOString() : null as any });
    }
  };

  const toggleArchiveStudent = (id: string) => {
    const student = data.students.find(s => s.id === id);
    if (student) {
      const isArchiving = !student.archived;
      updateStudent(id, { archived: isArchiving, archivedAt: isArchiving ? new Date().toISOString() : null as any });
    }
  };

  const activeTeacherIdKey = selectedTeacherObj ? (selectedTeacherObj.uid || selectedTeacherObj.id) : 'none';

  return (
    <div className="gradient-bg min-h-screen flex flex-col h-screen overflow-hidden">
      <Header 
        onCreateGroup={openCreateGroup}
        onAddStudent={openCreateStudent}
        onShowAllStudents={() => setShowAllStudents(true)}
        onShowAllGroups={() => setShowAllGroups(true)}
        onOpenTeachers={() => setShowTeachersModal(true)}
        onOpenAddTeacher={() => { setShowTeachersModal(true); setAddTeacherOpen(true); }}
        teachersCount={teachersList.length}
      />

      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-6 overflow-hidden max-w-[1400px] w-full mx-auto">
        {appUser && appUser.role !== 'admin' && !appUser.isUnlimited && !appUser.appPayments?.[`${new Date().getFullYear()}-${new Date().getMonth()}`] && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 w-full shrink-0 shadow-lg shadow-black/10">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-red-400 font-medium">To'lov haqida ogohlantirish</h4>
              <p className="text-white/70 text-sm mt-1">Siz joriy oy uchun dasturdan foydalanish to'lovini amalga oshirmadingiz. Iltimos, tez orada to'lovni amalga oshiring.</p>
            </div>
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
          <div className="w-full md:w-72 flex flex-col gap-4 shrink-0 h-full min-h-0 overflow-y-auto md:overflow-hidden custom-scrollbar">
            <div className="glass-card rounded-2xl p-4 flex flex-col gap-3 border border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  appUser?.role === 'center_admin' 
                    ? 'bg-blue-500/20 text-blue-400' 
                    : 'bg-primary/20 text-primary'
                }`}>
                  {appUser?.role === 'center_admin' ? (
                    <Building2 className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-white truncate mb-0.5">
                    {appUser?.centerName || appUser?.fullName || 'Foydalanuvchi'}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {appUser?.role === 'center_admin' ? (
                      <>
                        <span className="text-[10px] text-blue-300 font-semibold px-1.5 py-0.2 rounded bg-blue-500/20 border border-blue-500/30">
                          Markaz
                        </span>
                        <span className="text-[10px] text-white/50 font-mono tracking-wider">
                          {appUser.centerCode || 'CTR'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-white/70 truncate max-w-[120px]">{appUser?.fullName}</span>
                        <span className="text-[10px] text-white/40 font-mono">{appUser?.teacherId || 'N/A'}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {appUser?.role === 'center_admin' && (
                <button
                  type="button"
                  onClick={() => setShowTeachersModal(true)}
                  className="w-full mt-0.5 py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-400/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>O'qituvchilarni boshqarish ({teachersList.length})</span>
                </button>
              )}
            </div>
            
            <div className="shrink-0">
              <MonthSelector 
                year={selectedYear}
                month={selectedMonth}
                onYearChange={setSelectedYear}
                onMonthChange={setSelectedMonth}
              />
            </div>

            {/* Attached Teachers Account Selector Card (Below MonthSelector) */}
            {appUser?.role === 'center_admin' && (
              <div className="glass-card rounded-2xl p-3.5 flex flex-col gap-2.5 border border-white/10 flex-1 min-h-[180px] overflow-hidden mb-8">
                <div className="flex items-center justify-between px-0.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
                      O'qituvchilar ({teachersList.length})
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
                  {teacherAccountsSummary.length === 0 ? (
                    <div className="text-center py-6 px-2 text-xs text-white/40">
                      Hali o'qituvchilar biriktirilmagan
                    </div>
                  ) : (
                    teacherAccountsSummary.map(item => {
                      const isSelected = activeTeacherIdKey === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedTeacherAccountId(item.id)}
                          className={cn(
                            "w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer",
                            isSelected
                              ? "bg-purple-600/25 border-purple-400/60 shadow-lg shadow-purple-950/40 ring-1 ring-purple-400/40"
                              : "bg-white/[0.04] border-white/10 hover:bg-white/[0.09]"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border",
                                  isSelected
                                    ? "bg-purple-500/35 border-purple-300/60 text-purple-100"
                                    : "bg-purple-500/15 border-purple-500/25 text-purple-300"
                                )}
                              >
                                {item.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">
                                  {item.fullName}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] text-purple-300 font-medium truncate">
                                    {item.subject}
                                  </span>
                                  {item.code && (
                                    <span className="text-[9px] text-white/40 font-mono">
                                      {item.code}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {item.pendingCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {item.pendingCount}
                                </span>
                              )}
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-purple-300 shrink-0" />
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/10">
                            <span className="text-white/55">
                              {item.groupsCount} guruh • {item.studentsCount} o'quvchi
                            </span>
                            <span className="font-bold text-emerald-400">
                              {formatSum(item.collectedAmount)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div key={activeTeacherIdKey} className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Active Teacher Account Header Banner */}
            {appUser?.role === 'center_admin' && selectedTeacherObj && (
              <div className="mb-3 px-4 py-2.5 rounded-2xl bg-purple-600/20 border border-purple-400/40 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/30 border border-purple-300/40 flex items-center justify-center text-purple-200 font-bold text-xs shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div className="text-xs sm:text-sm text-white truncate">
                    <span className="font-bold text-purple-200">{selectedTeacherObj.fullName}</span>
                    {selectedTeacherObj.subject && (
                      <span className="text-purple-300/80"> ({selectedTeacherObj.subject})</span>
                    )}
                    <span className="text-white/60 hidden sm:inline">
                      {" "}— ushbu o'qituvchi akkauntining alohida guruhlari, to'lovlari va hisob-kitoblari
                    </span>
                  </div>
                </div>
                {selectedTeacherObj.teacherId && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-white/10 text-purple-200 font-mono text-xs font-semibold">
                    {selectedTeacherObj.teacherId}
                  </span>
                )}
              </div>
            )}

            <ActionTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isCenterAdmin={appUser?.role === 'center_admin'}
              pendingPaymentsCount={pendingPaymentsCount}
            >
              {activeTab === 'attendance' && (
                <AttendanceTab 
                  data={activeData} 
                  monthKey={monthKey} 
                  year={selectedYear}
                  month={selectedMonth}
                  setAttendance={setAttendance} 
                  toggleArchiveStudent={toggleArchiveStudent}
                  updateStudent={updateStudent}
                  addPayment={handleScopedAddPayment}
                  addStudent={handleScopedAddStudent}
                  teachers={selectedTeacherObj ? [selectedTeacherObj] : teachersList}
                  onEditGroup={openEditGroup}
                />
              )}
              {activeTab === 'payment' && (
                <PaymentTab 
                  data={activeData} 
                  monthKey={monthKey} 
                  addPayment={handleScopedAddPayment} 
                  onClose={() => setActiveTab('attendance')}
                />
              )}
              {activeTab === 'debtors' && (
                <DebtorsTab 
                  data={activeData} 
                  monthKey={monthKey} 
                  addPayment={handleScopedAddPayment} 
                />
              )}
              {activeTab === 'blacklist' && appUser?.role !== 'center_admin' && (
                <BlacklistTab 
                  data={activeData} 
                  monthKey={monthKey} 
                  addPayment={handleScopedAddPayment} 
                />
              )}
              {(activeTab === 'tushum' || (activeTab === 'blacklist' && appUser?.role === 'center_admin')) && (
                <TushumTab
                  data={activeData}
                  monthKey={monthKey}
                  teachers={selectedTeacherObj ? [selectedTeacherObj] : teachersList}
                  centerId={appUser?.uid}
                  updatePayment={updatePayment}
                />
              )}
              {activeTab === 'stats' && (
                <StatsTab 
                  data={activeData} 
                  monthKey={monthKey} 
                  updatePayment={updatePayment}
                  deletePayment={deletePayment}
                  archivedStudentsCount={monthArchivedStudentsCount}
                />
              )}
              {activeTab === 'settings' && (
                <SettingsTab />
              )}
            </ActionTabs>
          </div>
        </div>
      </main>

      {/* Overlays / Modals */}
      {showGroupModal && (
        <GroupModal
          initialData={editGroupObj}
          teachers={teachersList}
          defaultTeacherId={activeTeacherIdKey}
          canSelectTeacher={appUser?.role === 'center_admin'}
          onClose={() => setShowGroupModal(false)}
          onSave={handleSaveGroup}
        />
      )}

      {showStudentModal && (
        <StudentModal
          initialData={editStudentObj}
          groups={scopedFullGroups.filter(g => !g.deletedAt && !g.archived)}
          onClose={() => setShowStudentModal(false)}
          onSave={handleSaveStudent}
        />
      )}

      {showAllStudents && (
        <AllStudents
          data={scopedFullData}
          onClose={() => setShowAllStudents(false)}
          onEdit={(id) => { setShowAllStudents(false); openEditStudent(id); }}
          onDelete={deleteStudent}
          onArchive={toggleArchiveStudent}
        />
      )}

      {showAllGroups && (
        <AllGroups
          data={scopedFullData}
          teachers={selectedTeacherObj ? [selectedTeacherObj] : teachersList}
          onClose={() => setShowAllGroups(false)}
          onEdit={(id) => { setShowAllGroups(false); openEditGroup(id); }}
          onDelete={deleteGroup}
          onArchive={toggleArchiveGroup}
          onEditStudent={(id) => { setShowAllGroups(false); openEditStudent(id); }}
          onDeleteStudent={deleteStudent}
          onArchiveStudent={toggleArchiveStudent}
        />
      )}

      {/* Teachers Management Modal for Learning Center Admin */}
      {appUser?.role === 'center_admin' && (
        <TeachersManagementModal
          isOpen={showTeachersModal}
          onClose={() => { setShowTeachersModal(false); setAddTeacherOpen(false); }}
          data={data}
          initialAddOpen={addTeacherOpen}
        />
      )}

    </div>
  );
}
