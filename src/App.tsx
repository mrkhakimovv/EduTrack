import { useState } from 'react';
import { useAppData } from './hooks/use-app-data';
import { Header } from './components/Header';
import { MonthSelector } from './components/MonthSelector';
import { ActionTabs, TabId } from './components/ActionTabs';
import { AttendanceTab } from './components/AttendanceTab';
import { PaymentTab } from './components/PaymentTab';
import { DebtorsTab } from './components/DebtorsTab';
import { BlacklistTab } from './components/BlacklistTab';
import { StatsTab } from './components/StatsTab';
import { GroupModal } from './components/GroupModal';
import { StudentModal } from './components/StudentModal';
import { AllStudents } from './components/AllStudents';
import { AllGroups } from './components/AllGroups';

export default function App() {
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
      updateGroup(id, { archived: isArchiving, archivedAt: isArchiving ? new Date().toISOString() : undefined });
    }
  };

  const toggleArchiveStudent = (id: string) => {
    const student = data.students.find(s => s.id === id);
    if (student) {
      const isArchiving = !student.archived;
      updateStudent(id, { archived: isArchiving, archivedAt: isArchiving ? new Date().toISOString() : undefined });
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
        <div className="flex flex-col md:flex-row gap-6 h-full">
          <div className="w-full md:w-72 flex flex-col gap-6 shrink-0">
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
                />
              )}
              {activeTab === 'payment' && (
                <PaymentTab 
                  data={activeData} 
                  monthKey={monthKey} 
                  addPayment={addPayment} 
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

      <footer className="h-12 glass-card border-t border-white/5 flex items-center px-4 sm:px-8 text-[11px] text-white/30 justify-between shrink-0">
        <div>Tizim holati: <span className="text-emerald-500">Onlayn</span></div>
        <div className="hidden sm:flex gap-6 uppercase tracking-wider">
          <span>Barcha o'quvchilar: {activeData.students.length}</span>
          <span>Shu oygi tushum: {activeData.payments.filter(p => p.month === monthKey).reduce((s, p) => s + p.amount, 0).toLocaleString('uz-UZ')} so'm</span>
        </div>
      </footer>
    </div>
  );
}

