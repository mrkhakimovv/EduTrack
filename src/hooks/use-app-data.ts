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

      // Resolve user profile reliably so we don't miss centerId/role before appUser loads
      let resolvedProfile: Partial<AppUser> | null = appUserRef.current || null;
      if (!resolvedProfile) {
        try {
          const uSnap = await getDoc(doc(db, 'users', user.uid));
          if (uSnap.exists()) {
            resolvedProfile = { ...(uSnap.data() as any), uid: user.uid };
          }
        } catch (e) {
          console.warn("Could not retrieve user profile in useAppData:", e);
        }
      }

      // Determine the shared center ID (or user's own UID if independent)
      const targetCenterId = resolvedProfile?.centerId || await getTargetCenterId(user.uid);

      const groupsRef = query(collection(db, 'groups'), where('userId', '==', targetCenterId));
      const studentsRef = query(collection(db, 'students'), where('userId', '==', targetCenterId));
      const paymentsRef = query(collection(db, 'payments'), where('userId', '==', targetCenterId));
      const attendanceRef = query(collection(db, 'attendance'), where('userId', '==', targetCenterId));

      let rawGroups: Group[] = [];
      let rawStudents: Student[] = [];
      let rawPayments: PaymentRecord[] = [];
      let rawAttendance: { [k: string]: AttendanceRecord } = {};

      let groupsReady = false, studentsReady = false, paymentsReady = false, attendanceReady = false;
      
      const updateLocal = () => {
        if (groupsReady && studentsReady && paymentsReady && attendanceReady) {
          const currentAppUser = appUserRef.current || resolvedProfile;
          const isCenterTeacher =
            currentAppUser?.role === 'teacher' &&
            Boolean(currentAppUser?.centerId) &&
            currentAppUser?.centerId !== user.uid;

          if (isCenterTeacher) {
            const teacherUid = user.uid;
            const teacherCode = currentAppUser?.teacherId;
            const teacherFullName = currentAppUser?.fullName;

            const filteredGroups = rawGroups.filter(g => {
              if (g.teacherId) {
                return (
                  g.teacherId === teacherUid ||
                  Boolean(teacherCode && g.teacherId === teacherCode)
                );
              }
              if (
                g.teacherName &&
                teacherFullName &&
                g.teacherName.trim().toLowerCase() === teacherFullName.trim().toLowerCase()
              ) {
                return true;
              }
              return false;
            });
            const teacherGroupIds = new Set(filteredGroups.map(g => g.id));

            const filteredStudents = rawStudents
              .filter(
                s =>
                  s.teacherId === teacherUid ||
                  (teacherCode && s.teacherId === teacherCode) ||
                  (s.groupIds || []).some(gid => teacherGroupIds.has(gid)) ||
                  (s.history &&
                    s.history.some(h => (h.groupIds || []).some(gid => teacherGroupIds.has(gid))))
              )
              .map(s => {
                const scopedGroupIds = (s.groupIds || []).filter(gid => teacherGroupIds.has(gid));
                if (scopedGroupIds.length > 0 && scopedGroupIds.length !== (s.groupIds || []).length) {
                  return { ...s, groupIds: scopedGroupIds };
                }
                return s;
              });

            const teacherStudentIds = new Set(filteredStudents.map(s => s.id));

            const filteredPayments = rawPayments.filter(
              p =>
                p.teacherId === teacherUid ||
                (teacherCode && p.teacherId === teacherCode) ||
                ((!p.teacherId || p.teacherId === targetCenterId) && teacherStudentIds.has(p.studentId))
            );

            setData({
              groups: filteredGroups,
              students: filteredStudents,
              payments: filteredPayments,
              attendance: rawAttendance
            });
          } else {
            setData({
              groups: rawGroups,
              students: rawStudents,
              payments: rawPayments,
              attendance: rawAttendance
            });
          }
        }
      };

      unsubGroups = onSnapshot(groupsRef, (snap) => {
        rawGroups = snap.docs.map(d => ({ ...(d.data() as Group), id: d.id }));
        groupsReady = true;
        updateLocal();
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'groups'));

      unsubStudents = onSnapshot(studentsRef, (snap) => {
        rawStudents = snap.docs.map(d => ({ ...(d.data() as Student), id: d.id }));
        studentsReady = true;
        updateLocal();
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'students'));

      unsubPayments = onSnapshot(paymentsRef, (snap) => {
        rawPayments = snap.docs.map(d => ({ ...(d.data() as PaymentRecord), id: d.id }));
        paymentsReady = true;
        updateLocal();
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'payments'));

      unsubAttendance = onSnapshot(attendanceRef, (snap) => {
        const att: { [k: string]: AttendanceRecord } = {};
        snap.docs.forEach(d => {
          const docData = d.data();
          att[docData.groupId_month] = docData.records;
        });
        rawAttendance = att;
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
  }, [appUser?.centerId, appUser?.role, appUser?.teacherId, appUser?.fullName, getTargetCenterId]);

  const addGroup = useCallback(async (group: Omit<Group, "id">) => {
    if (!auth.currentUser) return;
    const centerId = await getTargetCenterId(auth.currentUser.uid);
    const newId = generateId();
    const docRef = doc(db, 'groups', newId);
    try {
      const createdAt = group.createdAt || new Date().toISOString();
      const isTeacherAccount = appUserRef.current?.role === 'teacher';
      const resolvedTeacherId = isTeacherAccount
        ? auth.currentUser.uid
        : group.teacherId;
      const resolvedTeacherName = isTeacherAccount
        ? (appUserRef.current?.fullName || group.teacherName)
        : group.teacherName;

      await setDoc(docRef, JSON.parse(JSON.stringify({ 
        ...group, 
        userId: centerId,
        centerId: centerId,
        teacherId: resolvedTeacherId,
        teacherName: resolvedTeacherName,
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

    let resolvedTeacherId = student.teacherId || (appUserRef.current?.role === 'teacher' ? auth.currentUser.uid : undefined);
    let resolvedTeacherName = student.teacherName || (appUserRef.current?.role === 'teacher' ? appUserRef.current.fullName : undefined);

    if (!resolvedTeacherId && data && student.groupIds?.length) {
      const grp = data.groups.find(g => student.groupIds.includes(g.id) && g.teacherId);
      if (grp) {
        resolvedTeacherId = grp.teacherId;
        resolvedTeacherName = grp.teacherName || resolvedTeacherName;
      }
    }

    try {
      await setDoc(doc(db, 'students', newId), JSON.parse(JSON.stringify({ 
        ...student, 
        userId: centerId,
        centerId: centerId,
        teacherId: resolvedTeacherId,
        teacherName: resolvedTeacherName,
        createdAt: new Date().toISOString() 
      })));
    } catch (e) { handleFirestoreError(e, OperationType.CREATE, `students/${newId}`); }
  }, [getTargetCenterId, data]);

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
    const currentUser = appUserRef.current;
    const isCenterTeacher = currentUser?.role === 'teacher' && Boolean(currentUser?.centerId);

    // Resolve teacher info from current user (if teacher) or from the student's assigned group/student record
    let resolvedTeacherId = payment.teacherId || (currentUser?.role === 'teacher' ? currentUser.uid : undefined);
    let resolvedTeacherName = payment.teacherName || (currentUser?.role === 'teacher' ? currentUser.fullName : undefined);

    if (!resolvedTeacherId && data) {
      const st = data.students.find(s => s.id === payment.studentId);
      if (st) {
        if (st.teacherId && st.teacherId !== centerId) {
          resolvedTeacherId = st.teacherId;
          resolvedTeacherName = st.teacherName;
        }
        if ((!resolvedTeacherId || !resolvedTeacherName) && st.groupIds?.length) {
          const grp = data.groups.find(g => st.groupIds.includes(g.id) && g.teacherId);
          if (grp) {
            resolvedTeacherId = grp.teacherId;
            resolvedTeacherName = grp.teacherName || resolvedTeacherName;
          }
        }
      }
    }

    const centerStatus: 'pending' | 'accepted' = payment.centerStatus
      ? payment.centerStatus
      : (isCenterTeacher ? 'pending' : 'accepted');

    const nowIso = new Date().toISOString();

    try {
      await setDoc(doc(db, 'payments', newId), JSON.parse(JSON.stringify({ 
        ...payment, 
        userId: centerId,
        centerId: centerId,
        teacherId: resolvedTeacherId || currentUser?.uid,
        teacherName: resolvedTeacherName || (currentUser?.role === 'teacher' ? currentUser.fullName : undefined),
        centerStatus,
        ...(centerStatus === 'accepted' ? { acceptedAt: nowIso } : {}),
        date: nowIso 
      })));
    } catch (e) { handleFirestoreError(e, OperationType.CREATE, `payments/${newId}`); }
  }, [getTargetCenterId, data]);

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
