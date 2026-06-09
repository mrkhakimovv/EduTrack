import { useState, useEffect, useCallback } from 'react';
import { AppData, Group, Student, PaymentRecord, AttendanceRecord, generateId } from '../lib/store';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHelper';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

export function useAppData() {
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const uid = auth.currentUser.uid;
    const groupsRef = query(collection(db, 'groups'), where('userId', '==', uid));
    const studentsRef = query(collection(db, 'students'), where('userId', '==', uid));
    const paymentsRef = query(collection(db, 'payments'), where('userId', '==', uid));
    const attendanceRef = query(collection(db, 'attendance'), where('userId', '==', uid));

    let currentData: AppData = {
      groups: [],
      students: [],
      payments: [],
      attendance: {}
    };

    let groupsReady = false, studentsReady = false, paymentsReady = false, attendanceReady = false;
    
    const updateLocal = () => {
      if (groupsReady && studentsReady && paymentsReady && attendanceReady) {
        setData({ ...currentData });
      }
    };

    const unsubGroups = onSnapshot(groupsRef, (snap) => {
      currentData.groups = snap.docs.map(d => ({ ...(d.data() as Group), id: d.id }));
      groupsReady = true;
      updateLocal();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'groups'));

    const unsubStudents = onSnapshot(studentsRef, (snap) => {
      currentData.students = snap.docs.map(d => ({ ...(d.data() as Student), id: d.id }));
      studentsReady = true;
      updateLocal();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'students'));

    const unsubPayments = onSnapshot(paymentsRef, (snap) => {
      currentData.payments = snap.docs.map(d => ({ ...(d.data() as PaymentRecord), id: d.id }));
      paymentsReady = true;
      updateLocal();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'payments'));

    const unsubAttendance = onSnapshot(attendanceRef, (snap) => {
        const att: { [k: string]: AttendanceRecord } = {};
        snap.docs.forEach(d => {
            const docData = d.data();
            att[docData.groupId_month] = docData.records;
        });
        currentData.attendance = att;
        attendanceReady = true;
        updateLocal();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'attendance'));

    return () => {
      unsubGroups();
      unsubStudents();
      unsubPayments();
      unsubAttendance();
    };
  }, []);

  const addGroup = useCallback(async (group: Omit<Group, "id" | "createdAt">) => {
    if (!auth.currentUser) return;
    const newId = generateId();
    const docRef = doc(db, 'groups', newId);
    try {
      await setDoc(docRef, { ...group, userId: auth.currentUser.uid, createdAt: new Date().toISOString() });
    } catch (e) { handleFirestoreError(e, OperationType.CREATE, `groups/${newId}`); }
  }, []);

  const updateGroup = useCallback(async (id: string, updates: Partial<Omit<Group, "id" | "createdAt">>) => {
    if (!data || !auth.currentUser) return;
    const g = data.groups.find(x => x.id === id);
    if (!g) return;
    
    const isEditingHistoryFields = updates.name !== undefined || updates.time !== undefined || updates.days !== undefined || updates.archived !== undefined;
    let history = g.history || [];
    if (isEditingHistoryFields) {
      history = [...history, {
        updatedAt: new Date().toISOString(),
        name: g.name,
        time: g.time,
        days: g.days,
        monthlyPayment: g.monthlyPayment,
        archived: g.archived,
        archivedAt: g.archivedAt,
        deletedAt: g.deletedAt
      }];
    }
    
    try {
      await updateDoc(doc(db, 'groups', id), { ...updates, history });
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `groups/${id}`); }
  }, [data]);

  const deleteGroup = useCallback(async (id: string) => {
    if (!data || !auth.currentUser) return;
    const g = data.groups.find(x => x.id === id);
    if (!g) return;
    const history = [...(g.history || []), {
      updatedAt: new Date().toISOString(),
      name: g.name,
      time: g.time,
      days: g.days,
      monthlyPayment: g.monthlyPayment,
      archived: g.archived,
      archivedAt: g.archivedAt,
      deletedAt: g.deletedAt
    }];
    try {
      await updateDoc(doc(db, 'groups', id), { deletedAt: new Date().toISOString(), history });
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `groups/${id}`); }
  }, [data]);

  const addStudent = useCallback(async (student: Omit<Student, "id" | "createdAt">) => {
    if (!auth.currentUser) return;
    const newId = generateId();
    try {
      await setDoc(doc(db, 'students', newId), { ...student, userId: auth.currentUser.uid, createdAt: new Date().toISOString() });
    } catch (e) { handleFirestoreError(e, OperationType.CREATE, `students/${newId}`); }
  }, []);

  const updateStudent = useCallback(async (id: string, updates: Partial<Omit<Student, "id" | "createdAt">>) => {
    if (!data || !auth.currentUser) return;
    const s = data.students.find(x => x.id === id);
    if (!s) return;
    
    const isEditingHistoryFields = updates.fullName !== undefined || updates.groupIds !== undefined || updates.monthlyPayment !== undefined || updates.firstMonthPayment !== undefined || updates.groupPricing !== undefined || updates.archived !== undefined;
    let history = s.history || [];
    if (isEditingHistoryFields) {
      history = [...history, {
        updatedAt: new Date().toISOString(),
        fullName: s.fullName,
        phone: s.phone,
        parentPhone: s.parentPhone,
        school: s.school,
        grade: s.grade,
        groupIds: s.groupIds,
        joinDate: s.joinDate,
        firstMonthPayment: s.firstMonthPayment,
        monthlyPayment: s.monthlyPayment,
        groupPricing: s.groupPricing,
        archived: s.archived,
        archivedAt: s.archivedAt,
        deletedAt: s.deletedAt
      }];
    }
    try {
      await updateDoc(doc(db, 'students', id), { ...updates, history });
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `students/${id}`); }
  }, [data]);

  const deleteStudent = useCallback(async (id: string) => {
    if (!data || !auth.currentUser) return;
    const s = data.students.find(x => x.id === id);
    if (!s) return;
    const history = [...(s.history || []), {
      updatedAt: new Date().toISOString(),
      fullName: s.fullName,
      phone: s.phone,
      parentPhone: s.parentPhone,
      school: s.school,
      grade: s.grade,
      groupIds: s.groupIds,
      joinDate: s.joinDate,
      firstMonthPayment: s.firstMonthPayment,
      monthlyPayment: s.monthlyPayment,
      groupPricing: s.groupPricing,
      archived: s.archived,
      archivedAt: s.archivedAt,
      deletedAt: s.deletedAt
    }];
    try {
      await updateDoc(doc(db, 'students', id), { deletedAt: new Date().toISOString(), history });
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `students/${id}`); }
  }, [data]);

  const setAttendance = useCallback(async (groupId: string, monthKey: string, studentId: string, date: string, status: "present" | "absent" | undefined) => {
    if (!data || !auth.currentUser) return;
    const key = `${groupId}_${monthKey}`;
    const currentMonthRecord = data.attendance[key] || {};
    const currentStudentRecord = currentMonthRecord[studentId] || {};

    const newStudentRecord = { ...currentStudentRecord };
    if (status === undefined) {
      delete newStudentRecord[date];
    } else {
      newStudentRecord[date] = status;
    }

    const newMonthRecord = { ...currentMonthRecord, [studentId]: newStudentRecord };
    const docId = `att_${key}`;
    try {
      await setDoc(doc(db, 'attendance', docId), {
        userId: auth.currentUser.uid,
        groupId_month: key,
        records: newMonthRecord
      }, { merge: true });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, `attendance/${docId}`); }
  }, [data]);

  const addPayment = useCallback(async (payment: Omit<PaymentRecord, "id" | "date">) => {
    if (!auth.currentUser) return;
    const newId = generateId();
    try {
      await setDoc(doc(db, 'payments', newId), { ...payment, userId: auth.currentUser.uid, date: new Date().toISOString() });
    } catch (e) { handleFirestoreError(e, OperationType.CREATE, `payments/${newId}`); }
  }, []);

  const updatePayment = useCallback(async (id: string, updates: Partial<Omit<PaymentRecord, "id" | "date">>) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'payments', id), updates);
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `payments/${id}`); }
  }, []);

  const deletePayment = useCallback(async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'payments', id));
    } catch (e) { handleFirestoreError(e, OperationType.DELETE, `payments/${id}`); }
  }, []);

  return {
    data,
    addGroup, updateGroup, deleteGroup,
    addStudent, updateStudent, deleteStudent,
    setAttendance,
    addPayment, updatePayment, deletePayment
  };
}
