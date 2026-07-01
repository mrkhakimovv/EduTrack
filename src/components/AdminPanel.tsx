import React, { useState, useEffect } from 'react';
import { auth, db, firebaseConfig } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, query, where, deleteDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { LogOut, UserPlus, Users, Loader2, X, Wallet, Bell, BellOff, Edit2, Lock, Unlock, Trash2 } from 'lucide-react';
import { signOut } from 'firebase/auth';

const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

export function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const MONTHS = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
  ];

  const loadUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const fetchedUsers = snap.docs.map(d => d.data());
      
      const updatedUsers = [];
      for (const userData of fetchedUsers) {
        if (userData.role !== 'admin') {
          if (!userData.teacherId) {
            let unique = false;
            let newId = '';
            while (!unique) {
              newId = Math.floor(100000 + Math.random() * 900000).toString();
              const isIdInFetched = fetchedUsers.some(u => u.teacherId === newId);
              if (!isIdInFetched) {
                 unique = true;
              }
            }
            await updateDoc(doc(db, 'users', userData.uid), { teacherId: newId });
            userData.teacherId = newId;
          }
          updatedUsers.push(userData);
        }
      }
      
      setUsers(updatedUsers);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !username || !password) return;
    setCreating(true);
    try {
      const email = `${username.toLowerCase().trim()}@edutrack.local`;
      const pass = `${password}_system`;
      
      // Generate unique 6-digit ID
      let unique = false;
      let newId = '';
      while (!unique) {
        newId = Math.floor(100000 + Math.random() * 900000).toString();
        const snap = await getDocs(query(collection(db, 'users'), where('teacherId', '==', newId)));
        if (snap.empty) {
          unique = true;
        }
      }

      const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      await secondaryAuth.signOut();
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        teacherId: newId,
        fullName,
        username: username.toLowerCase().trim(),
        role: 'teacher',
        plainPassword: password,
        paymentStatus: 'unpaid',
        createdAt: new Date().toISOString()
      });
      
      setFullName("");
      setUsername("");
      setPassword("");
      setIsCreateModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        alert("Tarmoq xatosi: Iltimos internet aloqangizni tekshirib qaytadan urinib ko'ring.");
      } else {
        alert("Xatolik yuz berdi. Ehtimol bu username allaqachon mavjud.");
      }
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const toggleAppPayment = async (uid: string, year: number, monthIndex: number) => {
    try {
      const currentPayments = selectedUser.appPayments || {};
      const key = `${year}-${monthIndex}`;
      const isPaid = currentPayments[key];
      
      const newPayments = {
        ...currentPayments,
        [key]: !isPaid
      };

      await updateDoc(doc(db, 'users', uid), {
        appPayments: newPayments
      });
      
      setSelectedUser((prev: any) => ({ ...prev, appPayments: newPayments }));
      setUsers(users.map(u => u.uid === uid ? { ...u, appPayments: newPayments } : u));
    } catch (err) {
      console.error(err);
      alert("To'lov holatini yangilashda xatolik");
    }
  };

  const toggleUnlimitedPayment = async (uid: string) => {
    try {
      const currentUnlimitedState = selectedUser.isUnlimited || false;
      const newState = !currentUnlimitedState;

      await updateDoc(doc(db, 'users', uid), {
        isUnlimited: newState
      });
      
      setSelectedUser((prev: any) => ({ ...prev, isUnlimited: newState }));
      setUsers(users.map(u => u.uid === uid ? { ...u, isUnlimited: newState } : u));
    } catch (err) {
      console.error(err);
      alert("Cheksiz to'lov holatini yangilashda xatolik");
    }
  };

  const handleToggleBlock = async (u: any) => {
    if (confirm(`Rostdan ham foydalanuvchini ${u.isBlocked ? 'blokdan chiqarmoqchimisiz' : 'bloklamoqchimisiz'}?`)) {
      try {
        await updateDoc(doc(db, 'users', u.uid), { isBlocked: !u.isBlocked });
        setUsers(users.map(user => user.uid === u.uid ? { ...user, isBlocked: !user.isBlocked } : user));
      } catch (e) {
        console.error(e);
        alert("Xatolik yuz berdi");
      }
    }
  };

  const handleDeleteUser = async (u: any) => {
    if (confirm(`Rostdan ham ${u.fullName} o'qituvchini o'chirmoqchimisiz?`)) {
      try {
        await deleteDoc(doc(db, 'users', u.uid));
        setUsers(users.filter(user => user.uid !== u.uid));
      } catch (e) {
        console.error(e);
        alert("Xatolik yuz berdi");
      }
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editFullName.trim()) return;
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), { fullName: editFullName.trim() });
      setUsers(users.map(user => user.uid === editingUser.uid ? { ...user, fullName: editFullName.trim() } : user));
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert("Xatolik yuz berdi");
    } finally {
      setSavingEdit(false);
    }
  };

  const openEditModal = (u: any) => {
    setEditingUser(u);
    setEditFullName(u.fullName);
  };

  return (
    <div className="min-h-screen gradient-bg p-4 sm:p-8 text-white relative">
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                Tahrirlash
              </h2>
              <button 
                onClick={() => setEditingUser(null)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>
            
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1 ml-1">Ism va Familiya</label>
                <input type="text" required value={editFullName} onChange={e => setEditFullName(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors" placeholder="Ali Valiyev" />
              </div>
              <button type="submit" disabled={savingEdit} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
                {savingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Saqlash'}
              </button>
            </form>
          </div>
        </div>
      )}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Yangi foydalanuvchi
              </h2>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1 ml-1">Ism va Familiya</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors" placeholder="Ali Valiyev" />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1 ml-1">Username</label>
                <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors" placeholder="alivaliyev" />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1 ml-1">Parol</label>
                <input type="text" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors" placeholder="••••" />
              </div>
              <button type="submit" disabled={creating} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yaratish'}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-sys-base border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">O'qituvchi akkaunti</h3>
              <button onClick={() => setSelectedUser(null)} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/50 mb-1">ID</label>
                <div className="bg-white/5 rounded-xl px-4 py-3 font-mono text-xl tracking-widest text-primary font-bold">{selectedUser.teacherId || 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">Ism Familiya</label>
                <div className="bg-white/5 rounded-xl px-4 py-3 font-medium">{selectedUser.fullName}</div>
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">Username</label>
                <div className="bg-white/5 rounded-xl px-4 py-3 font-mono text-primary/80">{selectedUser.username}</div>
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">Parol</label>
                <div className="bg-white/5 rounded-xl px-4 py-3 font-mono">{selectedUser.plainPassword || '****'}</div>
              </div>
              
              <div className="pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                  <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                    <label className="text-sm text-white/50 flex items-center gap-2">
                      <Wallet className="w-4 h-4" /> Dasturni ishlatish uchun to'lov holati
                    </label>
                    <button
                      onClick={() => toggleUnlimitedPayment(selectedUser.uid)}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${selectedUser.isUnlimited ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-white/50 hover:text-white border border-transparent'}`}
                    >
                      Cheksiz
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1 self-start sm:self-auto">
                    <button 
                      onClick={() => setSelectedYear(y => y - 1)}
                      className="p-1 hover:bg-white/10 rounded transition-colors text-white/70"
                    >
                      &lt;
                    </button>
                    <span className="text-sm font-medium w-12 text-center">{selectedYear}</span>
                    <button 
                      onClick={() => setSelectedYear(y => y + 1)}
                      className="p-1 hover:bg-white/10 rounded transition-colors text-white/70"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MONTHS.map((month, index) => {
                    const isPaid = selectedUser.appPayments?.[`${selectedYear}-${index}`];
                    return (
                      <button
                        key={month}
                        onClick={() => toggleAppPayment(selectedUser.uid, selectedYear, index)}
                        className={`px-2 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                          isPaid
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
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

      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            Admin Panel
          </h1>
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 px-4 py-2.5 rounded-xl transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">Tizimdan chiqish</span>
          </button>
        </div>

        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Foydalanuvchilar ro'yxati (O'qituvchilar)</h2>
            <button 
              onClick={() => setIsCreateModalOpen(true)} 
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Yangi qo'shish
            </button>
          </div>
          {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50 text-sm">
                        <th className="pb-3 px-4 font-medium">ID</th>
                        <th className="pb-3 px-4 font-medium">Ism Familiya</th>
                        <th className="pb-3 px-4 font-medium">Username</th>
                        <th className="pb-3 px-4 font-medium text-center">To'lov holati</th>
                        <th className="pb-3 px-4 font-medium text-right">Yaratilgan sana</th>
                        <th className="pb-3 px-4 font-medium text-right">Amallar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-white/40">Hali foydalanuvchilar yo'q</td></tr>
                      ) : (
                        users.map(u => (
                          <tr 
                            key={u.uid} 
                            onClick={() => setSelectedUser(u)}
                            className="border-b border-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                          >
                            <td className="py-4 px-4 font-mono font-bold text-primary/90">{u.teacherId || '-'}</td>
                            <td className="py-4 px-4 font-medium group-hover:text-primary transition-colors">{u.fullName}</td>
                            <td className="py-4 px-4 font-mono text-sm text-primary/80">{u.username}</td>
                            <td className="py-4 px-4 text-center">
                              {u.isUnlimited ? (
                                <span className="inline-flex px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-medium">Cheksiz</span>
                              ) : u.appPayments?.[`${new Date().getFullYear()}-${new Date().getMonth()}`] ? (
                                <span className="inline-flex px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-medium">Joriy oy: To'langan</span>
                              ) : (
                                <span className="inline-flex px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-xs font-medium">Joriy oy: To'lanmagan</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-sm text-white/50 text-right">{new Date(u.createdAt).toLocaleDateString('uz-UZ')}</td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); openEditModal(u); }}
                                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                                  title="Tahrirlash"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleToggleBlock(u); }}
                                  className="p-1.5 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg text-orange-400 hover:text-orange-300 transition-colors"
                                  title={u.isBlocked ? "Blokdan chiqarish" : "Bloklash"}
                                >
                                  {u.isBlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteUser(u); }}
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
    </div>
  );
}
