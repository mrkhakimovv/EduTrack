import { useState, useEffect } from 'react';
import { useAppData } from './hooks/use-app-data';
import { useAuth } from './components/FirebaseAuthProvider';
import { db } from './lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { AlertTriangle, User, Building2, Users } from 'lucide-react';
import { Header } from './components/Header';
import { MonthSelector } from './components/MonthSelector';
import { ActionTabs, TabId } from './components/ActionTabs';
import { AttendanceTab } from './components/AttendanceTab';
import { PaymentTab } from './components/PaymentTab';
import { DebtorsTab } from './components/DebtorsTab';
import { BlacklistTab } from './components/BlacklistTab';
import { StatsTab } from './components/StatsTab';
import { SettingsTab } from './components/SettingsTab';
import { GroupModal } from './components/GroupModal';
import { StudentModal } from './components/StudentModal';
import { AllStudents } from './components/AllStudents';
import { AllGroups } from './components/AllGroups';
import { TeachersManagementModal } from './components/TeachersManagementModal';

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

  // Listen to teachers for the center if center_admin or teacher
  useEffect(() => {
    const targetCenterId = appUser?.role === 'center_admin' ? appUser.uid : appUser?.centerId;
    if (targetCenterId) {
      const q = query(
        collection(db, 'users'),
        where('centerId', '==', targetCenterId),
        where('role', '==', 'teacher')
      );
      const unsub = onSnapshot(q, (snap) => {
        setTeachersList(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      }, (e) => {
        console.warn("Could not load teachers in App:", e);
      });
      return () => unsub();
    } else if (appUser?.role === 'teacher') {
      setTeachersList([{
        uid: appUser.uid,
        id: appUser.uid,
        fullName: appUser.fullName,
        subject: appUser.subject
      }]);
    } else {
      setTeachersList([]);
    }
  }, [appUser?.role, appUser?.uid, appUser?.centerId, appUser?.fullName, appUser?.subject]);

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

  if (!data) {
    return (
      <div className="gradient-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const monthEndDateTs = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).getTime();
  const monthStartDateTs = new Date(selectedYear, selectedMonth, 1).getTime();

  // Compute historically accurate groups for the selected month
  const activeGroups = data.groups
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
  const activeStudents = data.students
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

  const monthArchivedStudentsCount = data.students.filter(s => {
    const createdTs = new Date(s.createdAt).getTime();
    if (createdTs > monthEndDateTs) return false;
    if (s.deletedAt && new Date(s.deletedAt).getTime() < monthStartDateTs) return false;
    if (s.archived && s.archivedAt && new Date(s.archivedAt).getTime() < monthEndDateTs) return true;
    return false;
  }).length;
  
  const activeData = {
    ...data,
    students: activeStudents,
    groups: activeGroups,
    payments: data.payments,
  };

  // Wrappers for modals
  const openCreateGroup = () => { setEditGroupObj(null); setShowGroupModal(true); };
  const openEditGroup = (id: string) => { setEditGroupObj(data.groups.find(g => g.id === id)); setShowGroupModal(true); };
  
  const openCreateStudent = () => { setEditStudentObj(null); setShowStudentModal(true); };
  const openEditStudent = (id: string) => { setEditStudentObj(data.students.find(s => s.id === id)); setShowStudentModal(true); };

  const handleSaveGroup = (groupData: any) => {
    if (editGroupObj) updateGroup(editGroupObj.id, groupData);
    else addGroup(groupData);
    setShowGroupModal(false);
  };

  const handleSaveStudent = (studentData: any) => {
    if (editStudentObj) updateStudent(editStudentObj.id, studentData);
    else addStudent(studentData);
    setShowStudentModal(false);
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
        <div className="flex flex-col md:flex-row gap-6 h-full">
          <div className="w-full md:w-72 flex flex-col gap-6 shrink-0">
            <div className="glass-card rounded-2xl p-4 flex flex-col gap-3 border border-white/10">
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
                  className="w-full mt-0.5 py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-400/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>O'qituvchilarni boshqarish ({teachersList.length})</span>
                </button>
              )}
            </div>
            
            <MonthSelector 
              year={selectedYear}
              month={selectedMonth}
              onYearChange={setSelectedYear}
              onMonthChange={setSelectedMonth}
            />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <ActionTabs activeTab={activeTab} onTabChange={setActiveTab}>
              {activeTab === 'attendance' && (
                <AttendanceTab 
                  data={activeData} 
                  monthKey={monthKey} 
                  year={selectedYear}
                  month={selectedMonth}
                  setAttendance={setAttendance} 
                  toggleArchiveStudent={toggleArchiveStudent}
                  updateStudent={updateStudent}
                  addPayment={addPayment}
                  addStudent={addStudent}
                  teachers={teachersList}
                  onEditGroup={openEditGroup}
                />
              )}
              {activeTab === 'payment' && (
                <PaymentTab 
                  data={activeData} 
                  monthKey={monthKey} 
                  addPayment={addPayment} 
                  onClose={() => setActiveTab('attendance')}
                />
              )}
              {activeTab === 'debtors' && (
                <DebtorsTab 
                  data={activeData} 
                  monthKey={monthKey} 
                  addPayment={addPayment} 
                />
              )}
              {activeTab === 'blacklist' && (
                <BlacklistTab 
                  data={activeData} 
                  monthKey={monthKey} 
                  addPayment={addPayment} 
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
          onClose={() => setShowGroupModal(false)}
          onSave={handleSaveGroup}
        />
      )}

      {showStudentModal && (
        <StudentModal
          initialData={editStudentObj}
          groups={data.groups.filter(g => !g.deletedAt && !g.archived)}
          onClose={() => setShowStudentModal(false)}
          onSave={handleSaveStudent}
        />
      )}

      {showAllStudents && (
        <AllStudents
          data={data}
          onClose={() => setShowAllStudents(false)}
          onEdit={(id) => { setShowAllStudents(false); openEditStudent(id); }}
          onDelete={deleteStudent}
          onArchive={toggleArchiveStudent}
        />
      )}

      {showAllGroups && (
        <AllGroups
          data={data}
          teachers={teachersList}
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
