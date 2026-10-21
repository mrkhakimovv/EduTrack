import React, { useState, useEffect, useMemo } from 'react';
import { auth, db, firebaseConfig } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, query, where, deleteDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  LogOut, UserPlus, Users, Loader2, X, Wallet, Edit2, Lock, Unlock, 
  Trash2, Building2, Search, Plus, Phone, CheckCircle2, AlertCircle, 
  BookOpen, Eye
} from 'lucide-react';

// Isolated secondary auth app so admin does not get logged out
const secondaryApp = getApps().find(a => a.name === 'AdminSecondaryApp') || initializeApp(firebaseConfig, 'AdminSecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

export function AdminPanel() {
  // Main tab: 'centers' | 'teachers'
  const [activeTab, setActiveTab] = useState<'centers' | 'teachers'>('centers');

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isCreateCenterModalOpen, setIsCreateCenterModalOpen] = useState(false);
  const [isCreateTeacherModalOpen, setIsCreateTeacherModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<any | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Selected payment year for payment inspector
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Create Center Form States
  const [centerName, setCenterName] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [centerUsername, setCenterUsername] = useState("");
  const [centerPassword, setCenterPassword] = useState("");
  const [centerPhone, setCenterPhone] = useState("");
  const [centerUnlimited, setCenterUnlimited] = useState(true);
  const [creatingCenter, setCreatingCenter] = useState(false);
  const [centerError, setCenterError] = useState("");

  // Create Teacher Form States
  const [teacherFullName, setTeacherFullName] = useState("");
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");
  const [assignedCenterId, setAssignedCenterId] = useState<string>("");
  const [creatingTeacher, setCreatingTeacher] = useState(false);
  const [teacherError, setTeacherError] = useState("");

  // Edit item states
  const [editName, setEditName] = useState("");
  const [editCenterName, setEditCenterName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const MONTHS = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
  ];

  const loadAllUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const fetched: any[] = snap.docs.map(d => ({ ...(d.data() as any), uid: d.id }));

      const centerUnlimitedMap = new Map<string, boolean>();
      for (const u of fetched) {
        if (u.role === 'center_admin') {
          centerUnlimitedMap.set(u.uid, !!u.isUnlimited);
        }
      }

      const updatedUsers: any[] = [];
      for (const u of fetched) {
        if (u.role === 'admin') continue;

        // Ensure teachers have a 6-digit teacherId
        if (u.role === 'teacher' || (!u.role && !u.centerCode)) {
          if (!u.teacherId) {
            let unique = false;
            let newId = '';
            while (!unique) {
              newId = Math.floor(100000 + Math.random() * 900000).toString();
              const isIdInFetched = fetched.some((item: any) => item.teacherId === newId);
              if (!isIdInFetched) unique = true;
            }
            await updateDoc(doc(db, 'users', u.uid), { teacherId: newId });
            u.teacherId = newId;
          }

          // If the teacher's learning center has unlimited license, ensure the teacher also has unlimited license
          if (u.centerId && centerUnlimitedMap.get(u.centerId) === true && !u.isUnlimited) {
            await updateDoc(doc(db, 'users', u.uid), { isUnlimited: true });
            u.isUnlimited = true;
          }
        }
        updatedUsers.push(u);
      }

      setAllUsers(updatedUsers);
    } catch (e) {
      console.error("Error loading users:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllUsers();
  }, []);

  // Split into centers and teachers
  const centers = useMemo(() => {
    return allUsers.filter(u => u.role === 'center_admin');
  }, [allUsers]);

  const teachers = useMemo(() => {
    return allUsers.filter(u => u.role === 'teacher' || (!u.role && !u.centerCode));
  }, [allUsers]);

  // Teachers count per center map
  const teachersCountPerCenter = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of teachers) {
      if (t.centerId) {
        counts[t.centerId] = (counts[t.centerId] || 0) + 1;
      }
    }
    return counts;
  }, [teachers]);

  // Filtered lists according to search
  const filteredCenters = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return centers;
    return centers.filter(c => 
      (c.centerName && c.centerName.toLowerCase().includes(q)) ||
      (c.centerCode && c.centerCode.toLowerCase().includes(q)) ||
      (c.fullName && c.fullName.toLowerCase().includes(q)) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [centers, searchQuery]);

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return teachers;
    return teachers.filter(t => 
      (t.fullName && t.fullName.toLowerCase().includes(q)) ||
      (t.teacherId && t.teacherId.toLowerCase().includes(q)) ||
      (t.username && t.username.toLowerCase().includes(q)) ||
      (t.phone && t.phone.toLowerCase().includes(q)) ||
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.centerName && t.centerName.toLowerCase().includes(q))
    );
  }, [teachers, searchQuery]);

  // Handle Create Center
  const handleCreateCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    setCenterError("");

    if (!centerName.trim() || !directorName.trim() || !centerUsername.trim() || !centerPassword.trim()) {
      setCenterError("Barcha majburiy maydonlarni to'ldiring");
      return;
    }

    const cleanUsername = centerUsername.toLowerCase().trim();
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setCenterError("Username faqat lotin harflari, raqamlar va pastki chiziqdan iborat bo'lishi kerak");
      return;
    }

    setCreatingCenter(true);
    try {
      // Check existing username
      const existing = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const snap = await getDocs(existing);
      if (!snap.empty) {
        setCenterError("Bu username allaqachon mavjud. Boshqa username tanlang.");
        setCreatingCenter(false);
        return;
      }

      const email = `${cleanUsername}@edutrack.local`;
      const passStr = `${centerPassword}_system`;

      const { user: newAuthUser } = await createUserWithEmailAndPassword(secondaryAuth, email, passStr);
      await secondaryAuth.signOut();

      const centerCode = `CTR-${Math.floor(100000 + Math.random() * 900000)}`;

      const newCenterDoc = {
        uid: newAuthUser.uid,
        centerId: newAuthUser.uid,
        centerCode,
        centerName: centerName.trim(),
        fullName: directorName.trim(),
        username: cleanUsername,
        phone: centerPhone.trim() || '',
        plainPassword: centerPassword,
        role: 'center_admin',
        isUnlimited: centerUnlimited,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', newAuthUser.uid), newCenterDoc);

      // Reset form
      setCenterName("");
      setDirectorName("");
      setCenterUsername("");
      setCenterPassword("");
      setCenterPhone("");
      setCenterUnlimited(true);
      setIsCreateCenterModalOpen(false);

      // Reload
      await loadAllUsers();
      setActiveTab('centers');
    } catch (err: any) {
      console.error("Error creating center:", err);
      if (err.code === 'auth/email-already-in-use') {
        setCenterError("Ushbu username allaqachon ro'yxatdan o'tgan.");
      } else {
        setCenterError("Xatolik yuz berdi: " + (err.message || 'Tarmoq xatosi'));
      }
    } finally {
      setCreatingCenter(false);
    }
  };

  // Handle Create Teacher
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError("");

    if (!teacherFullName.trim() || !teacherUsername.trim() || !teacherPassword.trim()) {
      setTeacherError("Barcha majburiy maydonlarni to'ldiring");
      return;
    }

    const cleanUsername = teacherUsername.toLowerCase().trim();
    setCreatingTeacher(true);
    try {
      const existing = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const snap = await getDocs(existing);
      if (!snap.empty) {
        setTeacherError("Bu username allaqachon band. Boshqasini tanlang.");
        setCreatingTeacher(false);
        return;
      }

      // Generate unique 6-digit teacher ID
      let unique = false;
      let newId = '';
      while (!unique) {
        newId = Math.floor(100000 + Math.random() * 900000).toString();
        const checkSnap = await getDocs(query(collection(db, 'users'), where('teacherId', '==', newId)));
        if (checkSnap.empty) unique = true;
      }

      const email = `${cleanUsername}@edutrack.local`;
      const passStr = `${teacherPassword}_system`;

      const { user: newAuthUser } = await createUserWithEmailAndPassword(secondaryAuth, email, passStr);
      await secondaryAuth.signOut();

      // Find center if assigned
      const assignedCenter = centers.find(c => c.uid === assignedCenterId);

      const newTeacherDoc: any = {
        uid: newAuthUser.uid,
        teacherId: newId,
        fullName: teacherFullName.trim(),
        username: cleanUsername,
        role: 'teacher',
        plainPassword: teacherPassword,
        phone: teacherPhone.trim() || '',
        subject: teacherSubject.trim() || '',
        createdAt: new Date().toISOString()
      };

      if (assignedCenter) {
        newTeacherDoc.centerId = assignedCenter.uid;
        newTeacherDoc.centerName = assignedCenter.centerName;
        newTeacherDoc.centerCode = assignedCenter.centerCode;
        newTeacherDoc.isUnlimited = !!assignedCenter.isUnlimited;
      }

      await setDoc(doc(db, 'users', newAuthUser.uid), newTeacherDoc);

      setTeacherFullName("");
      setTeacherUsername("");
      setTeacherPassword("");
      setTeacherPhone("");
      setTeacherSubject("");
      setAssignedCenterId("");
      setIsCreateTeacherModalOpen(false);

      await loadAllUsers();
    } catch (err: any) {
      console.error("Error creating teacher:", err);
      setTeacherError("Xatolik yuz berdi: " + (err.message || 'Tarmoq xatosi'));
    } finally {
      setCreatingTeacher(false);
    }
  };

  // Toggle unlimited license
  const toggleUnlimitedPayment = async (targetUser: any) => {
    try {
      const newState = !targetUser.isUnlimited;
      await updateDoc(doc(db, 'users', targetUser.uid), { isUnlimited: newState });
      
      if (targetUser.role === 'center_admin') {
        const attachedTeachers = allUsers.filter(u => u.centerId === targetUser.uid);
        await Promise.all(
          attachedTeachers.map(t => updateDoc(doc(db, 'users', t.uid), { isUnlimited: newState }))
        );
        setAllUsers(prev => prev.map(u => 
          (u.uid === targetUser.uid || u.centerId === targetUser.uid) ? { ...u, isUnlimited: newState } : u
        ));
        if (selectedUser && selectedUser.centerId === targetUser.uid) {
          setSelectedUser({ ...selectedUser, isUnlimited: newState });
        }
      } else {
        setAllUsers(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, isUnlimited: newState } : u));
      }

      if (selectedUser?.uid === targetUser.uid) {
        setSelectedUser({ ...selectedUser, isUnlimited: newState });
      }
      if (selectedCenter?.uid === targetUser.uid) {
        setSelectedCenter({ ...selectedCenter, isUnlimited: newState });
      }
    } catch (err) {
      console.error(err);
      alert("Litsenziya holatini o'zgartirishda xatolik yuz berdi");
    }
  };

  // Toggle app payment for specific month
  const toggleAppPayment = async (uid: string, year: number, monthIndex: number) => {
    try {
      const current = selectedUser?.appPayments || {};
      const key = `${year}-${monthIndex}`;
      const isPaid = current[key];
      const newPayments = { ...current, [key]: !isPaid };

      await updateDoc(doc(db, 'users', uid), { appPayments: newPayments });

      setSelectedUser((prev: any) => ({ ...prev, appPayments: newPayments }));
      setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, appPayments: newPayments } : u));
    } catch (err) {
      console.error(err);
      alert("To'lov holatini yangilashda xatolik");
    }
  };

  // Toggle Block/Unblock
  const handleToggleBlock = async (u: any) => {
    const isCurrentlyBlocked = !!u.isBlocked;
    const actionWord = isCurrentlyBlocked ? "blokdan chiqarmoqchimisiz" : "bloklamoqchimisiz";
    if (confirm(`Rostdan ham ${u.fullName || u.centerName} hisobini ${actionWord}?`)) {
      try {
        await updateDoc(doc(db, 'users', u.uid), { isBlocked: !isCurrentlyBlocked });
        setAllUsers(prev => prev.map(user => user.uid === u.uid ? { ...user, isBlocked: !isCurrentlyBlocked } : user));
        if (selectedCenter?.uid === u.uid) {
          setSelectedCenter({ ...selectedCenter, isBlocked: !isCurrentlyBlocked });
        }
        if (selectedUser?.uid === u.uid) {
          setSelectedUser({ ...selectedUser, isBlocked: !isCurrentlyBlocked });
        }
      } catch (e) {
        console.error(e);
        alert("Xatolik yuz berdi");
      }
    }
  };

  // Handle Delete
  const handleDeleteUser = async (u: any) => {
    const name = u.role === 'center_admin' ? u.centerName : u.fullName;
    const typeLabel = u.role === 'center_admin' ? "o'quv markazini" : "o'qituvchini";
    if (confirm(`Rostdan ham "${name}" ${typeLabel} butunlay o'chirmoqchimisiz?`)) {
      try {
        await deleteDoc(doc(db, 'users', u.uid));
        setAllUsers(prev => prev.filter(user => user.uid !== u.uid));
        if (selectedCenter?.uid === u.uid) setSelectedCenter(null);
        if (selectedUser?.uid === u.uid) setSelectedUser(null);
      } catch (e) {
        console.error(e);
        alert("O'chirishda xatolik yuz berdi");
      }
    }
  };

  // Open Edit Modal
  const openEditModal = (item: any) => {
    setEditingItem(item);
    setEditName(item.fullName || "");
    setEditCenterName(item.centerName || "");
    setEditPhone(item.phone || "");
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSavingEdit(true);
    try {
      const updates: any = {
        fullName: editName.trim(),
        phone: editPhone.trim()
      };
      if (editingItem.role === 'center_admin') {
        updates.centerName = editCenterName.trim() || editingItem.centerName;
      }

      await updateDoc(doc(db, 'users', editingItem.uid), updates);

      setAllUsers(prev => prev.map(u => u.uid === editingItem.uid ? { ...u, ...updates } : u));
      if (selectedCenter?.uid === editingItem.uid) {
        setSelectedCenter((prev: any) => ({ ...prev, ...updates }));
      }
      if (selectedUser?.uid === editingItem.uid) {
        setSelectedUser((prev: any) => ({ ...prev, ...updates }));
      }
      setEditingItem(null);
    } catch (err) {
      console.error(err);
      alert("Tahrirlashda xatolik yuz berdi");
    } finally {
      setSavingEdit(false);
    }
  };

  // Teachers belonging to the currently inspected center
  const centerTeachers = useMemo(() => {
    if (!selectedCenter) return [];
    return teachers.filter(t => t.centerId === selectedCenter.uid);
  }, [selectedCenter, teachers]);

  return (
    <div className="min-h-screen gradient-bg p-3 sm:p-8 text-white relative">

      {/* TOP HEADER */}
      <div className="max-w-7xl mx-auto mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 sm:p-6 rounded-2xl border border-white/10 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Admin Panel</h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Super Admin
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/50">
                O'quv markazlari va o'qituvchilarni yagona markazdan boshqarish
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* PROMINENT "O'QUV MARKAZ YARATISH" BUTTON IN TOP HEADER */}
            <button
              onClick={() => {
                setCenterError("");
                setIsCreateCenterModalOpen(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:to-primary text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 border border-blue-400/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm"
              title="Yangi o'quv markazi akkauntini ochish"
            >
              <Building2 className="w-4 h-4 text-blue-100" />
              <span>O'quv markaz yaratish</span>
            </button>

            {/* Logout button */}
            <button 
              onClick={() => signOut(auth)} 
              className="flex items-center justify-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium"
              title="Tizimdan chiqish"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Chiqish</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="max-w-7xl mx-auto space-y-6">

        {/* TABS & SEARCH BAR */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Segmented Control Tabs */}
          <div className="flex items-center bg-black/40 p-1.5 rounded-xl border border-white/10 self-start sm:self-auto w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('centers')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'centers'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>O'quv markazlari</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'centers' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50'
              }`}>
                {centers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('teachers')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'teachers'
                  ? 'bg-primary text-white shadow-md shadow-primary/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>O'qituvchilar</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'teachers' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50'
              }`}>
                {teachers.length}
              </span>
            </button>
          </div>

          {/* Search + Action Button */}
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'centers' ? "Markaz nomi, kodi, rahbar..." : "O'qituvchi ismi, ID, login..."}
                className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Contextual Action Button beside Table header */}
            {activeTab === 'centers' ? (
              <button
                onClick={() => {
                  setCenterError("");
                  setIsCreateCenterModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all shrink-0 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>O'quv markaz qo'shish</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setTeacherError("");
                  setIsCreateTeacherModalOpen(true);
                }}
                className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-primary/20 transition-all shrink-0 w-full sm:w-auto"
              >
                <UserPlus className="w-4 h-4" />
                <span>Yangi o'qituvchi</span>
              </button>
            )}
          </div>
        </div>

        {/* DATA TABLES */}
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden shadow-xl">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-white/50 text-sm">Ma'lumotlar yuklanmoqda...</p>
            </div>
          ) : activeTab === 'centers' ? (
            /* TAB 1: CENTERS TABLE */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-white/60 text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-4 font-semibold">Markaz Kodi</th>
                    <th className="py-3.5 px-4 font-semibold">O'quv markaz nomi</th>
                    <th className="py-3.5 px-4 font-semibold">Rahbar (Admin)</th>
                    <th className="py-3.5 px-4 font-semibold">Username / Parol</th>
                    <th className="py-3.5 px-4 font-semibold text-center">O'qituvchilar</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Litsenziya / To'lov</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Yaratilgan sana</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredCenters.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white/40">
                        <Building2 className="w-10 h-10 mx-auto mb-2 text-white/20" />
                        {searchQuery ? "Qidiruv bo'yicha hech qanday o'quv markaz topilmadi" : "Hozircha o'quv markazlari mavjud emas"}
                        <div className="mt-3">
                          <button
                            onClick={() => {
                              setCenterError("");
                              setIsCreateCenterModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20"
                          >
                            <Plus className="w-3.5 h-3.5" /> Birinchi o'quv markazini yaratish
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCenters.map(center => {
                      const teacherCount = teachersCountPerCenter[center.uid] || 0;
                      return (
                        <tr
                          key={center.uid}
                          onClick={() => setSelectedCenter(center)}
                          className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                        >
                          <td className="py-4 px-4 font-mono font-bold text-blue-400">
                            {center.centerCode || 'CTR-N/A'}
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-semibold text-white group-hover:text-blue-300 transition-colors flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-blue-400/70" />
                              <span>{center.centerName}</span>
                            </div>
                            {center.phone && (
                              <div className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" /> {center.phone}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-white/80">
                            <div className="font-medium">{center.fullName}</div>
                            {center.isBlocked && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 font-medium">
                                Bloklangan
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 font-mono text-xs">
                            <div className="text-primary font-semibold">@{center.username}</div>
                            <div className="text-white/40 font-normal">{center.plainPassword || '••••'}</div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                              <Users className="w-3 h-3" />
                              {teacherCount} o'qituvchi
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {center.isUnlimited ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Cheksiz
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                                Oylik tarif
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-xs text-white/50 text-right whitespace-nowrap">
                            {center.createdAt ? new Date(center.createdAt).toLocaleDateString('uz-UZ') : '-'}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end items-center gap-1.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => setSelectedCenter(center)}
                                className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg text-blue-300 transition-colors"
                                title="Batafsil ko'rish"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEditModal(center)}
                                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                                title="Tahrirlash"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleBlock(center)}
                                className="p-1.5 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg text-orange-400 hover:text-orange-300 transition-colors"
                                title={center.isBlocked ? "Blokdan chiqarish" : "Bloklash"}
                              >
                                {center.isBlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(center)}
                                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                                title="O'quv markazini o'chirish"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* TAB 2: TEACHERS TABLE */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-white/60 text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-4 font-semibold">ID</th>
                    <th className="py-3.5 px-4 font-semibold">Ism Familiya</th>
                    <th className="py-3.5 px-4 font-semibold">O'quv markaz</th>
                    <th className="py-3.5 px-4 font-semibold">Username</th>
                    <th className="py-3.5 px-4 font-semibold">Parol</th>
                    <th className="py-3.5 px-4 font-semibold text-center">To'lov holati</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Yaratilgan sana</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white/40">
                        <Users className="w-10 h-10 mx-auto mb-2 text-white/20" />
                        {searchQuery ? "Qidiruv bo'yicha hech qanday o'qituvchi topilmadi" : "Hozircha o'qituvchilar mavjud emas"}
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map(u => (
                      <tr 
                        key={u.uid} 
                        onClick={() => setSelectedUser(u)}
                        className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-4 font-mono font-bold text-primary">
                          {u.teacherId || '-'}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-white group-hover:text-primary transition-colors">
                            {u.fullName}
                          </div>
                          {u.subject && (
                            <div className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                              <BookOpen className="w-3 h-3" /> {u.subject}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {u.centerName ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium">
                              <Building2 className="w-3 h-3" />
                              {u.centerName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-white/40 text-xs">
                              Yakka tartibda
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-xs text-primary/80 font-medium">
                          @{u.username}
                        </td>
                        <td className="py-4 px-4 font-mono text-xs text-white/50">
                          {u.plainPassword || '••••'}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {(u.isUnlimited || centers.find(c => c.uid === u.centerId)?.isUnlimited) ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                              Cheksiz
                            </span>
                          ) : u.appPayments?.[`${new Date().getFullYear()}-${new Date().getMonth()}`] ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                              Joriy oy: To'langan
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-medium">
                              Joriy oy: To'lanmagan
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-xs text-white/50 text-right whitespace-nowrap">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('uz-UZ') : '-'}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => setSelectedUser(u)}
                              className="p-1.5 bg-primary/10 hover:bg-primary/20 rounded-lg text-primary transition-colors"
                              title="To'lov va ma'lumotlar"
                            >
                              <Wallet className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => openEditModal(u)}
                              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                              title="Tahrirlash"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleToggleBlock(u)}
                              className="p-1.5 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg text-orange-400 hover:text-orange-300 transition-colors"
                              title={u.isBlocked ? "Blokdan chiqarish" : "Bloklash"}
                            >
                              {u.isBlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                              title="O'chirish"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL: CREATE LEARNING CENTER ================= */}
      {isCreateCenterModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg p-6 sm:p-7 rounded-2xl border border-blue-500/30 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                  <Building2 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Yangi O'quv Markaz Yaratish</h2>
                  <p className="text-xs text-white/50">Markaz o'z ichida bir nechta o'qituvchi akkauntlarini yarata oladi</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCreateCenterModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {centerError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{centerError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCenter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">
                  O'quv markaz nomi <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  required 
                  value={centerName} 
                  onChange={e => setCenterName(e.target.value)} 
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/60 transition-colors" 
                  placeholder="Masalan: Cambridge Learning Center" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">
                    Rahbar / Administrator <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={directorName} 
                    onChange={e => setDirectorName(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/60 transition-colors" 
                    placeholder="Ali Valiyev" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">
                    Telefon raqami
                  </label>
                  <input 
                    type="tel" 
                    value={centerPhone} 
                    onChange={e => setCenterPhone(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/60 transition-colors" 
                    placeholder="+998 90 123 45 67" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">
                    Username (Login) <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={centerUsername} 
                    onChange={e => setCenterUsername(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/60 transition-colors font-mono" 
                    placeholder="cambridge_lc" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">
                    Parol <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={centerPassword} 
                    onChange={e => setCenterPassword(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/60 transition-colors font-mono" 
                    placeholder="kamida 4 ta belgi" 
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={centerUnlimited}
                    onChange={e => setCenterUnlimited(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-black/40 border-white/20"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">Cheksiz litsenziya taqdim etish</div>
                    <div className="text-[11px] text-white/50">O'quv markaz uchun dasturdan cheklovlarsiz to'liq foydalanish imkoniyati</div>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateCenterModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 text-sm font-medium transition-colors"
                >
                  Bekor qilish
                </button>
                <button 
                  type="submit" 
                  disabled={creatingCenter} 
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-600/30"
                >
                  {creatingCenter ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Yaratilmoqda...</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4" />
                      <span>Markazni yaratish</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE TEACHER ================= */}
      {isCreateTeacherModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg p-6 sm:p-7 rounded-2xl border border-primary/30 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Yangi O'qituvchi Yaratish</h2>
                  <p className="text-xs text-white/50">Tizimga yangi o'qituvchi akkaunti qo'shish</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCreateTeacherModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {teacherError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{teacherError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTeacher} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">
                  Ism va Familiya <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  required 
                  value={teacherFullName} 
                  onChange={e => setTeacherFullName(e.target.value)} 
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors" 
                  placeholder="Ali Valiyev" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">Fan / Yo'nalish</label>
                  <input 
                    type="text" 
                    value={teacherSubject} 
                    onChange={e => setTeacherSubject(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors" 
                    placeholder="Masalan: Ingliz tili" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">Telefon raqami</label>
                  <input 
                    type="tel" 
                    value={teacherPhone} 
                    onChange={e => setTeacherPhone(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors" 
                    placeholder="+998 90 123 45 67" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">
                    Username <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={teacherUsername} 
                    onChange={e => setTeacherUsername(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors font-mono" 
                    placeholder="alivaliyev" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">
                    Parol <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={teacherPassword} 
                    onChange={e => setTeacherPassword(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors font-mono" 
                    placeholder="••••" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">
                  Biriktiriladigan O'quv markaz (Ixtiyoriy)
                </label>
                <select
                  value={assignedCenterId}
                  onChange={e => setAssignedCenterId(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="" className="bg-sys-base text-white">Yakka tartibda (O'quv markazsiz)</option>
                  {centers.map(c => (
                    <option key={c.uid} value={c.uid} className="bg-sys-base text-white">
                      {c.centerName} ({c.centerCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateTeacherModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 text-sm font-medium transition-colors"
                >
                  Bekor qilish
                </button>
                <button 
                  type="submit" 
                  disabled={creatingTeacher} 
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-primary/20"
                >
                  {creatingTeacher ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yaratish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CENTER DETAILS & TEACHERS LIST ================= */}
      {selectedCenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-card border border-blue-500/30 rounded-2xl p-5 sm:p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-start mb-5 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                  <Building2 className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white">{selectedCenter.centerName}</h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                      {selectedCenter.centerCode}
                    </span>
                  </div>
                  <p className="text-xs text-white/50">O'quv markaz profil va biriktirilgan o'qituvchilar</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCenter(null)} 
                className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="text-[11px] text-white/40">Rahbar</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{selectedCenter.fullName}</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="text-[11px] text-white/40">Username</div>
                  <div className="text-sm font-mono font-semibold text-primary mt-0.5">@{selectedCenter.username}</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="text-[11px] text-white/40">Parol</div>
                  <div className="text-sm font-mono text-white/80 mt-0.5">{selectedCenter.plainPassword || '••••'}</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="text-[11px] text-white/40">Telefon</div>
                  <div className="text-sm font-medium text-white/90 mt-0.5">{selectedCenter.phone || "Kiritilmagan"}</div>
                </div>
              </div>

              {/* License status & controls */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white/70">Tizimdan foydalanish litsenziyasi:</div>
                  <div className="text-xs text-white/40">Ushbu markaz va uning barcha o'qituvchilari uchun ruxsat</div>
                </div>
                <button
                  onClick={() => toggleUnlimitedPayment(selectedCenter)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    selectedCenter.isUnlimited 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' 
                      : 'bg-white/10 text-white/60 hover:text-white border border-white/10'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{selectedCenter.isUnlimited ? "Cheksiz Litsenziya (Faol)" : "Cheksiz qilish"}</span>
                </button>
              </div>

              {/* Center teachers section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <h4 className="text-sm font-bold text-white">Biriktirilgan o'qituvchilar ({centerTeachers.length})</h4>
                  </div>
                  <button
                    onClick={() => {
                      setAssignedCenterId(selectedCenter.uid);
                      setIsCreateTeacherModalOpen(true);
                    }}
                    className="text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>O'qituvchi qo'shish</span>
                  </button>
                </div>

                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                  {centerTeachers.length === 0 ? (
                    <div className="p-8 text-center text-white/40 text-xs">
                      Ushbu o'quv markaziga hali birorta o'qituvchi biriktirilmagan.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5 text-xs max-h-60 overflow-y-auto">
                      {centerTeachers.map(t => {
                        const isTeacherUnlimited = !!(t.isUnlimited || selectedCenter.isUnlimited);
                        return (
                          <div key={t.uid} className="p-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                                {t.teacherId}
                              </span>
                              <div>
                                <div className="font-semibold text-white">{t.fullName}</div>
                                <div className="text-[11px] text-white/40 font-mono">@{t.username} {t.subject && `• ${t.subject}`}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              {isTeacherUnlimited && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                                  <CheckCircle2 className="w-3 h-3" /> Cheksiz
                                </span>
                              )}
                              <span className="text-[11px] text-white/50 font-mono">{t.plainPassword}</span>
                              <button
                                onClick={() => {
                                  setSelectedUser({ ...t, isUnlimited: isTeacherUnlimited });
                                }}
                                className="p-1 text-primary hover:text-primary/80"
                                title="To'lov holatini ko'rish"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 flex justify-between items-center border-t border-white/10">
                <button
                  onClick={() => handleToggleBlock(selectedCenter)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 transition-colors flex items-center gap-1.5 font-medium"
                >
                  {selectedCenter.isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{selectedCenter.isBlocked ? "Markazni blokdan chiqarish" : "Markazni bloklash"}</span>
                </button>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(selectedCenter)}
                    className="px-3 py-1.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition-colors flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Tahrirlash</span>
                  </button>
                  <button
                    onClick={() => handleDeleteUser(selectedCenter)}
                    className="px-3 py-1.5 text-xs rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors flex items-center gap-1.5 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>O'chirish</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: TEACHER PAYMENT & DETAILS ================= */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="glass-card border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">O'qituvchi akkaunti</h3>
                  <p className="text-xs text-white/50">Hisob ma'lumotlari va to'lov nazorati</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)} 
                className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-[11px] text-white/40">ID</div>
                  <div className="font-mono text-base tracking-wider text-primary font-bold mt-0.5">
                    {selectedUser.teacherId || 'N/A'}
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-[11px] text-white/40">Username</div>
                  <div className="font-mono text-sm text-primary/90 font-medium mt-0.5">
                    @{selectedUser.username}
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-[11px] text-white/40">Ism Familiya</div>
                <div className="font-semibold text-white mt-0.5">{selectedUser.fullName}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-[11px] text-white/40">Parol</div>
                  <div className="font-mono text-sm text-white/90 mt-0.5">{selectedUser.plainPassword || '****'}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-[11px] text-white/40">O'quv markaz</div>
                  <div className="text-xs text-white/90 font-medium mt-0.5">
                    {selectedUser.centerName || 'Yakka tartibda'}
                  </div>
                </div>
              </div>
              
              {/* Payment Grid */}
              <div className="pt-2">
                {(() => {
                  const isCenterUnlimited = !!(selectedUser.centerId && centers.find(c => c.uid === selectedUser.centerId)?.isUnlimited);
                  const effectiveUnlimited = !!(selectedUser.isUnlimited || isCenterUnlimited);
                  return (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-white/70">To'lov holati:</span>
                          <button
                            onClick={() => toggleUnlimitedPayment(selectedUser)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                              effectiveUnlimited 
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                : 'bg-white/5 text-white/50 hover:text-white border border-transparent'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Cheksiz</span>
                          </button>
                          {isCenterUnlimited && (
                            <span className="text-[11px] text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              O'quv markaz orqali cheksiz
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1 self-start sm:self-auto border border-white/5">
                          <button 
                            onClick={() => setSelectedYear(y => y - 1)}
                            className="p-1 hover:bg-white/10 rounded text-white/70 text-xs"
                          >
                            &lt;
                          </button>
                          <span className="text-xs font-semibold w-10 text-center">{selectedYear}</span>
                          <button 
                            onClick={() => setSelectedYear(y => y + 1)}
                            className="p-1 hover:bg-white/10 rounded text-white/70 text-xs"
                          >
                            &gt;
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {MONTHS.map((month, index) => {
                    const isPaid = selectedUser.appPayments?.[`${selectedYear}-${index}`];
                    return (
                      <button
                        key={month}
                        onClick={() => toggleAppPayment(selectedUser.uid, selectedYear, index)}
                        className={`px-2 py-2 rounded-xl text-xs font-medium transition-all ${
                          isPaid
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold'
                            : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
                        }`}
                      >
                        {month}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT ITEM (CENTER OR TEACHER) ================= */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/10">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                <span>{editingItem.role === 'center_admin' ? "O'quv markazni tahrirlash" : "O'qituvchini tahrirlash"}</span>
              </h2>
              <button 
                onClick={() => setEditingItem(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {editingItem.role === 'center_admin' && (
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">
                    O'quv markaz nomi
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={editCenterName} 
                    onChange={e => setEditCenterName(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/60 transition-colors" 
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">
                  {editingItem.role === 'center_admin' ? "Rahbar Ism Familiyasi" : "Ism va Familiya"}
                </label>
                <input 
                  type="text" 
                  required 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1 ml-1">Telefon raqami</label>
                <input 
                  type="tel" 
                  value={editPhone} 
                  onChange={e => setEditPhone(e.target.value)} 
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors" 
                  placeholder="+998 90 123 45 67" 
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 text-sm font-medium transition-colors"
                >
                  Bekor qilish
                </button>
                <button 
                  type="submit" 
                  disabled={savingEdit} 
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-primary/20"
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
