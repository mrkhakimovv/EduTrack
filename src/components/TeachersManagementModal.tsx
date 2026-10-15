import React, { useState, useEffect } from 'react';
import { db, firebaseConfig } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from './FirebaseAuthProvider';
import { AppData } from '../lib/store';
import { 
  X, UserPlus, Users, Search, Edit2, Lock, Unlock, Trash2, 
  Copy, Check, Phone, BookOpen, GraduationCap, Building2, 
  ShieldCheck, AlertCircle, Loader2, KeyRound
} from 'lucide-react';

// Isolated secondary auth app so admin does not get logged out
const secondaryApp = getApps().find(a => a.name === 'TeacherSecondaryApp') || initializeApp(firebaseConfig, 'TeacherSecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

const POPULAR_SUBJECTS = [
  'Matematika', 'Ingliz tili', 'Fizika', 'Kimyo', 
  'Biologiya', 'Ona tili', 'Tarix', 'IT / Dasturlash', 'Mental arifmetika'
];

interface TeachersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  initialAddOpen?: boolean;
}

export function TeachersManagementModal({
  isOpen,
  onClose,
  data,
  initialAddOpen = false
}: TeachersManagementModalProps) {
  const { appUser } = useAuth();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create Form States
  const [showAddForm, setShowAddForm] = useState(initialAddOpen);
  const [newFullName, setNewFullName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Created Success Card
  const [createdTeacherInfo, setCreatedTeacherInfo] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit Teacher States
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (initialAddOpen) {
      setShowAddForm(true);
    }
  }, [initialAddOpen]);

  // Listen to teachers belonging to this center
  useEffect(() => {
    if (!isOpen || !appUser?.uid) return;

    setLoading(true);
    const q = query(
      collection(db, 'users'),
      where('centerId', '==', appUser.uid),
      where('role', '==', 'teacher')
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      // Sort newest first
      list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setTeachers(list);
      setLoading(false);
    }, (err) => {
      console.error("Error loading teachers:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [isOpen, appUser?.uid]);

  if (!isOpen || !appUser) return null;

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!newFullName.trim() || !newUsername.trim() || !newPassword.trim()) {
      setCreateError("Ism, username va parolni to'ldirish shart");
      return;
    }

    if (newPassword.length < 4) {
      setCreateError("Parol kamida 4 ta belgidan iborat bo'lishi kerak");
      return;
    }

    const cleanUsername = newUsername.toLowerCase().trim().replace(/\s+/g, '');
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setCreateError("Username faqat kichik lotin harflari, raqamlar va pastki chiziqdan iborat bo'lishi kerak");
      return;
    }

    setCreating(true);

    try {
      // Check if username already exists in Firestore
      const usersQuery = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const existing = await getDocs(usersQuery);
      if (!existing.empty) {
        setCreateError("Ushbu username allaqachon band. Boshqa username tanlang.");
        setCreating(false);
        return;
      }

      const email = `${cleanUsername}@edutrack.local`;
      const pass = `${newPassword}_system`;

      // Generate unique 6-digit teacher ID
      const newTeacherId = `OQ-${Math.floor(100000 + Math.random() * 900000)}`;

      // Create auth user in secondary auth
      const { user: newTeacherUser } = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      await secondaryAuth.signOut();

      // Create user document in Firestore with centerId
      const teacherPayload = {
        uid: newTeacherUser.uid,
        teacherId: newTeacherId,
        fullName: newFullName.trim(),
        subject: newSubject.trim() || "O'qituvchi",
        phone: newPhone.trim() || '',
        username: cleanUsername,
        plainPassword: newPassword,
        role: 'teacher',
        centerId: appUser.uid,
        centerName: appUser.centerName || 'O\'quv Markazi',
        isBlocked: false,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', newTeacherUser.uid), teacherPayload);

      // Show success modal info
      setCreatedTeacherInfo(teacherPayload);

      // Reset form
      setNewFullName("");
      setNewSubject("");
      setNewPhone("");
      setNewUsername("");
      setNewPassword("");
      setShowAddForm(false);
    } catch (err: any) {
      console.error("Create teacher error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setCreateError("Ushbu username allaqachon ro'yxatdan o'tgan");
      } else {
        setCreateError("Xatolik: " + (err.message || 'Tarmoq xatosi'));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleBlock = async (teacher: any) => {
    const actionText = teacher.isBlocked ? "blokdan chiqarmoqchimisiz" : "bloklamoqchimisiz";
    if (confirm(`Rostdan ham ${teacher.fullName} o'qituvchini ${actionText}?`)) {
      try {
        await updateDoc(doc(db, 'users', teacher.uid), {
          isBlocked: !teacher.isBlocked
        });
      } catch (e) {
        console.error(e);
        alert("Xatolik yuz berdi");
      }
    }
  };

  const handleDeleteTeacher = async (teacher: any) => {
    if (confirm(`DIQQAT! Rostdan ham ${teacher.fullName} o'qituvchi akkauntini butunlay o'chirmoqchimisiz?`)) {
      try {
        await deleteDoc(doc(db, 'users', teacher.uid));
      } catch (e) {
        console.error(e);
        alert("Xatolik yuz berdi");
      }
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || !editFullName.trim()) return;

    setSavingEdit(true);
    try {
      const updates: any = {
        fullName: editFullName.trim(),
        subject: editSubject.trim() || "O'qituvchi",
        phone: editPhone.trim()
      };
      if (editPassword.trim()) {
        updates.plainPassword = editPassword.trim();
      }

      await updateDoc(doc(db, 'users', editingTeacher.uid), updates);
      setEditingTeacher(null);
    } catch (e) {
      console.error(e);
      alert("Xatolik yuz berdi");
    } finally {
      setSavingEdit(false);
    }
  };

  const copyCredentials = (t: any) => {
    const text = `🏫 O'quv markaz: ${appUser.centerName || 'EduTrack'}\n👨‍🏫 O'qituvchi: ${t.fullName}\n🆔 ID: ${t.teacherId || '-'}\n🔑 Login (username): ${t.username}\n🔒 Parol: ${t.plainPassword || '****'}\n🌐 Kirish manzili: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopiedId(t.uid || t.teacherId || 'cred');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredTeachers = teachers.filter(t => {
    const q = search.toLowerCase();
    return (
      (t.fullName || '').toLowerCase().includes(q) ||
      (t.username || '').toLowerCase().includes(q) ||
      (t.subject || '').toLowerCase().includes(q) ||
      (t.teacherId || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div 
        className="glass-modal w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">
                  {appUser.centerName || "O'quv Markazi"}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold font-mono">
                  {appUser.centerCode || "MARKAZ"}
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                O'quv markaz bazasiga ma'lumot kirituvchi o'qituvchilar ro'yxati va boshqaruvi
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats & Quick Actions Bar */}
        <div className="p-3 sm:p-4 bg-white/[0.015] border-b border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs sm:text-sm text-white/70">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5">
              <Users className="w-4 h-4 text-purple-400" />
              <span>O'qituvchilar: <b className="text-white font-bold">{teachers.length} ta</b></span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span>Markazdagi guruhlar: <b className="text-white font-bold">{data.groups.length} ta</b></span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span>O'quvchilar: <b className="text-white font-bold">{data.students.length} ta</b></span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setCreatedTeacherInfo(null);
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" />
            <span>{showAddForm ? "Ro'yxatga qaytish" : "Yangi o'qituvchi qo'shish"}</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {/* Newly created teacher card alert */}
          {createdTeacherInfo && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base">
                  <Check className="w-5 h-5 shrink-0" />
                  <span>Yangi o'qituvchi akkaunti muvaffaqiyatli yaratildi!</span>
                </div>
                <p className="text-xs text-white/70">
                  Ushbu ma'lumotlar bilan o'qituvchi tizimga kirib, aynan shu o'quv markaz bazasiga ma'lumot kiritishi mumkin:
                </p>
                <div className="flex items-center gap-4 text-xs font-mono pt-1 text-white/90 flex-wrap">
                  <span>Login: <b className="text-emerald-300">{createdTeacherInfo.username}</b></span>
                  <span>Parol: <b className="text-emerald-300">{createdTeacherInfo.plainPassword}</b></span>
                  <span>ID: <b className="text-emerald-300">{createdTeacherInfo.teacherId}</b></span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => copyCredentials(createdTeacherInfo)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {copiedId ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedId ? "Nusxalandi!" : "Ma'lumotlarni nusxalash"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedTeacherInfo(null)}
                  className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Add Teacher Form */}
          {showAddForm ? (
            <div className="glass-card p-5 sm:p-6 rounded-2xl border border-blue-500/30 bg-blue-950/20 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-400" />
                  <span>O'quv markazga yangi o'qituvchi biriktirish</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-white/50 hover:text-white"
                >
                  Bekor qilish
                </button>
              </div>

              <form onSubmit={handleCreateTeacher} className="space-y-4">
                {createError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs sm:text-sm">
                    {createError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/70 mb-1 ml-1 font-medium">O'qituvchi Ism Familiyasi *</label>
                    <input
                      type="text"
                      required
                      value={newFullName}
                      onChange={e => setNewFullName(e.target.value)}
                      placeholder="Masalan: Sardor Olimov"
                      className="w-full bg-black/25 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-white/70 mb-1 ml-1 font-medium">Dars beradigan fani / Yo'nalishi *</label>
                    <input
                      type="text"
                      required
                      value={newSubject}
                      onChange={e => setNewSubject(e.target.value)}
                      placeholder="Masalan: Matematika"
                      className="w-full bg-black/25 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {POPULAR_SUBJECTS.slice(0, 5).map(sub => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setNewSubject(sub)}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5"
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-white/70 mb-1 ml-1 font-medium">Telefon raqami</label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      placeholder="+998 90 123 45 67"
                      className="w-full bg-black/25 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-white/70 mb-1 ml-1 font-medium">Username (Kirish uchun login) *</label>
                    <div className="relative">
                      <span className="text-white/40 text-xs font-mono absolute left-3 top-1/2 -translate-y-1/2">@</span>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        placeholder="sardor_math"
                        className="w-full bg-black/25 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-white/70 mb-1 ml-1 font-medium">Parol *</label>
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="123456"
                      className="w-full bg-black/25 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs sm:text-sm font-medium transition-colors"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-md shadow-blue-600/30 transition-all"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Yaratilmoqda...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>O'qituvchi akkauntini saqlash</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="O'qituvchi ismi, fani, ID yoki logini bo'yicha qidirish..."
              className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* Teachers List */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-white/50">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="text-sm">O'qituvchilar ro'yxati yuklanmoqda...</span>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="py-12 text-center text-white/50 glass-card rounded-2xl p-8 border border-white/5 space-y-3">
              <Users className="w-12 h-12 mx-auto text-white/20" />
              <h4 className="text-base font-semibold text-white/80">
                {search ? "Qidiruvga mos o'qituvchi topilmadi" : "Hozircha markazga o'qituvchilar biriktirilmagan"}
              </h4>
              <p className="text-xs text-white/40 max-w-sm mx-auto">
                "Yangi o'qituvchi qo'shish" tugmasini bosib, o'quv markaz bazangizga ma'lumot kirita oladigan o'qituvchi akkauntlarini oching.
              </p>
              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs inline-flex items-center gap-2 mt-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>O'qituvchi qo'shish</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {filteredTeachers.map(teacher => {
                const teacherGroups = data.groups.filter(g => g.teacherId === teacher.uid || g.teacherName === teacher.fullName);
                const isCopied = copiedId === teacher.uid;

                return (
                  <div
                    key={teacher.uid}
                    className={`glass-card p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      teacher.isBlocked 
                        ? 'border-red-500/20 bg-red-500/[0.03]' 
                        : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 ${
                          teacher.isBlocked 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                            : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {teacher.fullName ? teacher.fullName.charAt(0).toUpperCase() : 'O'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-white text-base leading-tight">
                              {teacher.fullName}
                            </h4>
                            {teacher.isBlocked && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 font-semibold">
                                Bloklangan
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 font-medium">
                              {teacher.subject || "O'qituvchi"}
                            </span>
                            <span className="text-xs text-white/40 font-mono">
                              ID: {teacher.teacherId || '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeacher(teacher);
                            setEditFullName(teacher.fullName || '');
                            setEditSubject(teacher.subject || '');
                            setEditPhone(teacher.phone || '');
                            setEditPassword(teacher.plainPassword || '');
                          }}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleBlock(teacher)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            teacher.isBlocked 
                              ? 'text-emerald-400 hover:bg-emerald-500/20 bg-emerald-500/10' 
                              : 'text-amber-400 hover:bg-amber-500/20 bg-amber-500/10'
                          }`}
                          title={teacher.isBlocked ? "Blokdan chiqarish" : "Akkauntni bloklash"}
                        >
                          {teacher.isBlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTeacher(teacher)}
                          className="p-1.5 hover:bg-red-500/20 text-red-400/80 hover:text-red-300 rounded-lg transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Teacher Credentials and Stats */}
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-white/70">
                        <span className="text-white/40">Login (Username):</span>
                        <span className="font-mono font-medium text-white/90">@{teacher.username}</span>
                      </div>
                      <div className="flex items-center justify-between text-white/70">
                        <span className="text-white/40">Parol:</span>
                        <span className="font-mono font-medium text-blue-300">{teacher.plainPassword || '••••'}</span>
                      </div>
                      {teacher.phone && (
                        <div className="flex items-center justify-between text-white/70">
                          <span className="text-white/40">Telefon:</span>
                          <span>{teacher.phone}</span>
                        </div>
                      )}
                      <div className="pt-1.5 border-t border-white/5 flex items-center justify-between">
                        <span className="text-white/40">Markazdagi guruhlari:</span>
                        <span className="font-semibold text-emerald-400">{teacherGroups.length} ta guruh</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-white/40">
                        Qo'shilgan: {teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString('uz-UZ') : '-'}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyCredentials(teacher)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-medium flex items-center gap-1.5 border border-white/5 transition-colors"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/50" />}
                        <span>{isCopied ? "Nusxalandi!" : "Kirish ma'lumotlarini nusxalash"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-white/10 flex items-center justify-between bg-white/[0.02] shrink-0 text-xs text-white/50">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Barcha o'qituvchilar aynan shu markazning yagona bazasiga ulanadi</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-colors"
          >
            Yopish
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-modal w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                <span>O'qituvchini tahrirlash</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="p-1 text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="space-y-3.5">
              <div>
                <label className="block text-xs text-white/70 mb-1 ml-1 font-medium">Ism Familiya</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={e => setEditFullName(e.target.value)}
                  className="w-full bg-black/25 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-white/70 mb-1 ml-1 font-medium">Fani / Yo'nalishi</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  className="w-full bg-black/25 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-white/70 mb-1 ml-1 font-medium">Telefon raqami</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full bg-black/25 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-white/70 mb-1 ml-1 font-medium">Parol (o'zgartirish uchun)</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  className="w-full bg-black/25 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="Yangi parol"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2"
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
