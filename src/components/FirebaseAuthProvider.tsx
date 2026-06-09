import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Loader2, Lock, User as UserIcon } from 'lucide-react';
import { AdminPanel } from './AdminPanel';

interface AppUser {
  uid: string;
  fullName: string;
  username: string;
  role: 'admin' | 'teacher';
}

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({ user: null, appUser: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Login Form States
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAppUser(docSnap.data() as AppUser);
        } else {
          // If no doc exists (fallback, happens temporarily when creating or for previous anonymous users)
          setAppUser({ uid: u.uid, fullName: 'Tizim foydalanuvchisi', username: u.email || 'mehmon', role: 'teacher' });
        }
      } else {
        setUser(null);
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setLoggingIn(true);
    setLoginError("");

    const email = username.toLowerCase().trim() + "@edutrack.local";
    const passStr = password + "_system";

    try {
      if (username.toLowerCase().trim() === 'admin' && password === '7788') {
        try {
          await signInWithEmailAndPassword(auth, email, passStr);
        } catch (err: any) {
             const { user: newUser } = await createUserWithEmailAndPassword(auth, email, passStr);
             await setDoc(doc(db, 'users', newUser.uid), {
                uid: newUser.uid,
                fullName: 'Administrator',
                username: 'admin',
                role: 'admin',
                createdAt: new Date().toISOString()
             });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, passStr);
      }
    } catch (err: any) {
      console.error(err);
      setLoginError("Kirish ma'lumotlari xato yoki bunday foydalanuvchi tizimda yo'q");
    } finally {
      setLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="gradient-bg min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !appUser) {
    return (
      <div className="gradient-bg min-h-screen flex flex-col items-center justify-center p-4">
        <div className="glass-card max-w-sm w-full p-8 rounded-2xl flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Tizimga kirish</h2>
            <p className="text-white/50 text-sm">Davomat va to'lovlar tizimi</p>
          </div>
          
          <form onSubmit={handleLogin} className="w-full space-y-4">
            {loginError && (
              <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-center text-sm border border-red-500/20">
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-sm text-white/70 mb-1 ml-1" htmlFor="username">Username</label>
              <div className="relative">
                <UserIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input 
                  id="username"
                  type="text" 
                  autoComplete="username"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder="admin"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1 ml-1" htmlFor="password">Parol</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input 
                  id="password"
                  type="password" 
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder="••••"
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loggingIn}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2 shadow-lg shadow-primary/20"
            >
              {loggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : "Kirish"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (appUser.role === 'admin') {
    return (
      <AuthContext.Provider value={{ user, appUser, loading }}>
        <AdminPanel />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, appUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
