import { useState } from 'react';
import { useAppData } from './hooks/use-app-data';
import { useAuth } from './components/FirebaseAuthProvider';
import { AlertTriangle, User } from 'lucide-react';
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

export default function App() {
  const { appUser } = useAuth();
  const {
    data,
    addGroup, updateGroup, deleteGroup,
    addStudent, updateStudent, deleteStudent,
    setAttendance,
    addPayment, updatePayment, deletePayment
  } = useAppData();

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

  const activeStudentIds = new Set(activeStudents.map(s => s.id));
  
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
            <div className="glass-card rounded-2xl p-4 flex items-center gap-3 border border-white/10">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white mb-0.5">{appUser?.fullName || 'Foydalanuvchi'}</span>
                <span className="text-[10px] text-white/50 font-mono tracking-widest uppercase">ID: {appUser?.teacherId || 'N/A'}</span>
              </div>
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
          onClose={() => setShowAllGroups(false)}
          onEdit={(id) => { setShowAllGroups(false); openEditGroup(id); }}
          onDelete={deleteGroup}
          onArchive={toggleArchiveGroup}
          onEditStudent={(id) => { setShowAllGroups(false); openEditStudent(id); }}
          onDeleteStudent={deleteStudent}
          onArchiveStudent={toggleArchiveStudent}
        />
      )}

    </div>
  );
}

