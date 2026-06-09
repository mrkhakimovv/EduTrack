import React, { useState, useEffect } from 'react';
import { auth, db, firebaseConfig } from '../lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { LogOut, UserPlus, Users, Loader2 } from 'lucide-react';
import { signOut } from 'firebase/auth';

const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

export function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => d.data()).filter(u => u.role !== 'admin'));
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
      const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      await secondaryAuth.signOut();
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName,
        username: username.toLowerCase().trim(),
        role: 'teacher',
        createdAt: new Date().toISOString()
      });
      
      setFullName("");
      setUsername("");
      setPassword("");
      await loadUsers();
    } catch (err: any) {
      alert("Xatolik yuz berdi. Ehtimol bu username allaqachon mavjud.");
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg p-4 sm:p-8 text-white relative">
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

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="glass-card p-6 rounded-2xl sticky top-8">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Yangi foydalanuvchi
              </h2>
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

          <div className="lg:col-span-2">
            <div className="glass-card p-6 rounded-2xl h-full">
              <h2 className="text-xl font-semibold mb-6">Foydalanuvchilar ro'yxati (O'qituvchilar)</h2>
              {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50 text-sm">
                        <th className="pb-3 px-4 font-medium">Ism Familiya</th>
                        <th className="pb-3 px-4 font-medium">Username</th>
                        <th className="pb-3 px-4 font-medium text-right">Yaratilgan sana</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr><td colSpan={3} className="py-8 text-center text-white/40">Hali foydalanuvchilar yo'q</td></tr>
                      ) : (
                        users.map(u => (
                          <tr key={u.uid} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-4 px-4 font-medium">{u.fullName}</td>
                            <td className="py-4 px-4 font-mono text-sm text-primary/80">{u.username}</td>
                            <td className="py-4 px-4 text-sm text-white/50 text-right">{new Date(u.createdAt).toLocaleDateString('uz-UZ')}</td>
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
      </div>
    </div>
  );
}
