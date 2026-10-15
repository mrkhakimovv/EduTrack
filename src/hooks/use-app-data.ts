import { useState, useEffect, useCallback, useRef } from 'react';
import { AppData, Group, Student, PaymentRecord, AttendanceRecord, generateId } from '../lib/store';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHelper';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, where, deleteField, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { AppUser } from '../components/FirebaseAuthProvider';

export function useAppData(appUser?: AppUser | null) {
  const [data, setData] = useState<AppData | null>(null);
  const appUserRef = useRef(appUser);
  appUserRef.current = appUser;

  const getTargetCenterId = useCallback(async (userUid: string): Promise<string> => {
    if (appUserRef.current?.centerId) {
      return appUserRef.current.centerId;
    }
    try {
      const uSnap = await getDoc(doc(db, 'users', userUid));
      if (uSnap.exists()) {
        const uData = uSnap.data();
        if (uData.centerId) return uData.centerId;
      }
    } catch (e) {
      console.warn("Could not retrieve centerId from user doc:", e);
    }
    return userUid;
  }, []);

  useEffect(() => {
    let unsubGroups = () => {};
    let unsubStudents = () => {};
    let unsubPayments = () => {};
    let unsubAttendance = () => {};

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      unsubGroups();
      unsubStudents();
      unsubPayments();
      unsubAttendance();

      if (!user) {
        setData(null);
        return;
      }

      // Determine the shared center ID (or user's own UID if independent)
      const targetCenterId = await getTargetCenterId(user.uid);

      const groupsRef = query(collection(db, 'groups'), where('userId', '==', targetCenterId));
      const studentsRef = query(collection(db, 'students'), where('userId', '==', targetCenterId));
      const paymentsRef = query(collection(db, 'payments'), where('userId', '==', targetCenterId));
      const attendanceRef = query(collection(db, 'attendance'), where('userId', '==', targetCenterId));

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

      unsubGroups = onSnapshot(groupsRef, (snap) => {
        currentData.groups = snap.docs.map(d => ({ ...(d.data() as Group), id: d.id }));
        groupsReady = true;
        updateLocal();
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'groups'));

      unsubStudents = onSnapshot(studentsRef, (snap) => {
        currentData.students = snap.docs.map(d => ({ ...(d.data() as Student), id: d.id }));
        studentsReady = true;
        updateLocal();
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'students'));

      unsubPayments = onSnapshot(paymentsRef, (snap) => {
        currentData.payments = snap.docs.map(d => ({ ...(d.data() as PaymentRecord), id: d.id }));
        paymentsReady = true;
        updateLocal();
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'payments'));

      unsubAttendance = onSnapshot(attendanceRef, (snap) => {
        const att: { [k: string]: AttendanceRecord } = {};
        snap.docs.forEach(d => {
          const docData = d.data();
          att[docData.groupId_month] = docData.records;
        });
        currentData.attendance = att;
        attendanceReady = true;
        updateLocal();
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'attendance'));
    });

    return () => {
      unsubAuth();
      unsubGroups();
      unsubStudents();
      unsubPayments();
      unsubAttendance();
    };
  }, [appUser?.centerId, getTargetCenterId]);

  const addGroup = useCallback(async (group: Omit<Group, "id">) => {
    if (!auth.currentUser) return;
    const centerId = await getTargetCenterId(auth.currentUser.uid);
    const newId = generateId();
    const docRef = doc(db, 'groups', newId);
    try {
      const createdAt = group.createdAt || new Date().toISOString();
      await setDoc(docRef, JSON.parse(JSON.stringify({ 
        ...group, 
        userId: centerId,
        centerId: centerId,
        teacherId: group.teacherId || (appUserRef.current?.role === 'teacher' ? auth.currentUser.uid : undefined),
        teacherName: group.teacherName || (appUserRef.current?.role === 'teacher' ? appUserRef.current.fullName : undefined),
        createdAt 
      })));
    } catch (e) { handleFirestoreError(e, OperationType.CREATE, `groups/${newId}`); }
  }, [getTargetCenterId]);

  const updateGroup = useCallback(async (id: string, updates: Partial<Omit<Group, "id">>) => {
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
    
    // Deep clean undefined to avoid Firestore errors
    const cleanUpdates = JSON.parse(JSON.stringify({ ...updates, history }));
    
    try {
      await updateDoc(doc(db, 'groups', id), cleanUpdates);
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
      await updateDoc(doc(db, 'groups', id), JSON.parse(JSON.stringify({ deletedAt: new Date().toISOString(), history })));
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `groups/${id}`); }
  }, [data]);

  const addStudent = useCallback(async (student: Omit<Student, "id" | "createdAt">) => {
    if (!auth.currentUser) return;
    const centerId = await getTargetCenterId(auth.currentUser.uid);
    const newId = generateId();
    try {
      await setDoc(doc(db, 'students', newId), JSON.parse(JSON.stringify({ 
        ...student, 
        userId: centerId,
        centerId: centerId,
        teacherId: student.teacherId || (appUserRef.current?.role === 'teacher' ? auth.currentUser.uid : undefined),
        teacherName: student.teacherName || (appUserRef.current?.role === 'teacher' ? appUserRef.current.fullName : undefined),
        createdAt: new Date().toISOString() 
      })));
    } catch (e) { handleFirestoreError(e, OperationType.CREATE, `students/${newId}`); }
  }, [getTargetCenterId]);

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
    
    // Deep clean undefined
    const cleanUpdates = JSON.parse(JSON.stringify({ ...updates, history }));
    
    try {
      await updateDoc(doc(db, 'students', id), cleanUpdates);
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
      await updateDoc(doc(db, 'students', id), JSON.parse(JSON.stringify({ deletedAt: new Date().toISOString(), history })));
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `students/${id}`); }
  }, [data]);

  const setAttendance = useCallback(async (groupId: string, monthKey: string, studentId: string, date: string, status: "present" | "absent" | undefined) => {
    if (!data || !auth.currentUser) return;
    const centerId = await getTargetCenterId(auth.currentUser.uid);
    const key = `${groupId}_${monthKey}`;
    const docId = `att_${key}`;
    try {
      await setDoc(doc(db, 'attendance', docId), {
        userId: centerId,
        centerId: centerId,
        groupId_month: key,
        records: {
          [studentId]: {
            [date]: status === undefined ? deleteField() : status
          }
        }
      }, { merge: true });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, `attendance/${docId}`); }
  }, [data, getTargetCenterId]);

  const addPayment = useCallback(async (payment: Omit<PaymentRecord, "id" | "date">) => {
    if (!auth.currentUser) return;
    const centerId = await getTargetCenterId(auth.currentUser.uid);
    const newId = generateId();
    try {
      await setDoc(doc(db, 'payments', newId), JSON.parse(JSON.stringify({ 
        ...payment, 
        userId: centerId,
        centerId: centerId,
        teacherId: appUserRef.current?.uid,
        date: new Date().toISOString() 
      })));
    } catch (e) { handleFirestoreError(e, OperationType.CREATE, `payments/${newId}`); }
  }, [getTargetCenterId]);

  const updatePayment = useCallback(async (id: string, updates: Partial<Omit<PaymentRecord, "id" | "date">>) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'payments', id), JSON.parse(JSON.stringify(updates)));
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
