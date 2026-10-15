import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { Loader2, Lock, User as UserIcon, Building2, Phone, CheckCircle2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { AdminPanel } from './AdminPanel';

export interface AppUser {
  uid: string;
  fullName: string;
  username: string;
  role: 'admin' | 'teacher' | 'center_admin';
  centerId?: string;
  centerCode?: string;
  centerName?: string;
  teacherId?: string;
  subject?: string;
  phone?: string;
  isUnlimited?: boolean;
  isBlocked?: boolean;
  appPayments?: Record<string, boolean>;
  plainPassword?: string;
  createdAt?: string;
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

  // Form Mode: 'login' | 'register_center'
  const [mode, setMode] = useState<'login' | 'register_center'>('login');

  // Login Form States
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Center Registration Form States
  const [centerName, setCenterName] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [phone, setPhone] = useState("");
  const [centerUsername, setCenterUsername] = useState("");
  const [centerPassword, setCenterPassword] = useState("");
  const [centerPasswordConfirm, setCenterPasswordConfirm] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        if (u.isAnonymous) {
          await auth.signOut();
          setUser(null);
          setAppUser(null);
          setLoading(false);
          return;
        }
        setUser(u);
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data() as AppUser;
          if (userData.isBlocked) {
            await auth.signOut();
            setUser(null);
            setAppUser(null);
            setLoginError("Ushbu akkaunt markaz ma'muriyati tomonidan bloklangan. Iltimos rahbaringizga murojaat qiling.");
            setLoading(false);
            return;
          }
          setAppUser(userData);
        } else {
          // If no doc exists (fallback)
          setAppUser({ 
            uid: u.uid, 
            fullName: 'Tizim foydalanuvchisi', 
            username: u.email || 'foydalanuvchi', 
            role: 'teacher' 
          });
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

    const cleanUsername = username.toLowerCase().trim();
    const email = cleanUsername + "@edutrack.local";
    const passStr = password + "_system";

    try {
      if (cleanUsername === 'admin' && password === '7788') {
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

  const handleRegisterCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError("");
    setRegisterSuccess("");

    if (!centerName.trim()) {
      setRegisterError("O'quv markaz nomini kiriting");
      return;
    }
    if (!directorName.trim()) {
      setRegisterError("Rahbar / Administrator ismini kiriting");
      return;
    }
    if (!centerUsername.trim()) {
      setRegisterError("Username (login)ni kiriting");
      return;
    }
    if (centerPassword.length < 4) {
      setRegisterError("Parol kamida 4 ta belgidan iborat bo'lishi kerak");
      return;
    }
    if (centerPassword !== centerPasswordConfirm) {
      setRegisterError("Kiritilgan parollar bir-biriga mos kelmadi");
      return;
    }

    const cleanUsername = centerUsername.toLowerCase().trim();
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setRegisterError("Username faqat lotin harflari, raqamlar va pastki chiziqdan iborat bo'lishi kerak");
      return;
    }

    setRegistering(true);

    try {
      // Check if username already exists in Firestore
      const usersQuery = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const existingUsers = await getDocs(usersQuery);
      if (!existingUsers.empty) {
        setRegisterError("Ushbu username allaqachon band. Iltimos boshqa username tanlang.");
        setRegistering(false);
        return;
      }

      const email = cleanUsername + "@edutrack.local";
      const passStr = centerPassword + "_system";

      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, passStr);

      const centerCode = `CTR-${Math.floor(100000 + Math.random() * 900000)}`;

      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        centerId: newUser.uid,
        centerCode,
        centerName: centerName.trim(),
        fullName: directorName.trim(),
        username: cleanUsername,
        phone: phone.trim() || '',
        plainPassword: centerPassword,
        role: 'center_admin',
        isUnlimited: true,
        createdAt: new Date().toISOString()
      });

      setRegisterSuccess("O'quv markaz akkaunti muvaffaqiyatli yaratildi! Tizimga yo'naltirilmoqda...");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setRegisterError("Ushbu username allaqachon ro'yxatdan o'tgan.");
      } else {
        setRegisterError("Akkaunt yaratishda xatolik yuz berdi: " + (err.message || 'Tarmoq xatosi'));
      }
    } finally {
      setRegistering(false);
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
        {mode === 'login' ? (
          <div className="glass-card max-w-sm w-full p-8 rounded-2xl flex flex-col items-center gap-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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
                    placeholder="username"
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

            <div className="w-full pt-4 border-t border-white/10 flex flex-col items-center gap-3">
              <span className="text-xs text-white/40 text-center">Yangi o'quv markazi ochmoqchimisiz?</span>
              <button
                type="button"
                onClick={() => {
                  setLoginError("");
                  setRegisterError("");
                  setMode('register_center');
                }}
                className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>O'quv markaz akkauntini yaratish</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card max-w-md w-full p-6 sm:p-8 rounded-2xl flex flex-col gap-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Ortga</span>
              </button>
              <div className="flex items-center gap-1.5 text-blue-400 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>O'quv markaz tizimi</span>
              </div>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-blue-500/15 rounded-2xl flex items-center justify-center border border-blue-500/30 text-blue-400">
                <Building2 className="w-7 h-7" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">O'quv markaz akkauntini yaratish</h2>
              <p className="text-white/50 text-xs sm:text-sm">Yagona baza orqali bir nechta o'qituvchi akkauntlarini boshqarish</p>
            </div>

            <form onSubmit={handleRegisterCenter} className="w-full space-y-3.5">
              {registerError && (
                <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-center text-sm border border-red-500/20">
                  {registerError}
                </div>
              )}
              {registerSuccess && (
                <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl text-center text-sm border border-emerald-500/20 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{registerSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1 ml-1">O'quv markaz nomi *</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    required
                    value={centerName}
                    onChange={e => setCenterName(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder="Masalan: Registon O'quv Markazi"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1 ml-1">Rahbar / Mas'ul shaxs (Ism Familiya) *</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    required
                    value={directorName}
                    onChange={e => setDirectorName(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder="Masalan: Akmal Karimov"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1 ml-1">Telefon raqami (ixtiyoriy)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder="+998 90 123 45 67"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1 ml-1">Username (Kirish uchun login) *</label>
                <div className="relative">
                  <span className="text-white/40 text-xs font-mono absolute left-3 top-1/2 -translate-y-1/2">@</span>
                  <input
                    type="text"
                    required
                    value={centerUsername}
                    onChange={e => setCenterUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder="registon_center"
                  />
                </div>
                <p className="text-[11px] text-white/40 mt-1 ml-1">Faqat kichik lotin harflari va raqamlar</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1 ml-1">Parol *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="password"
                      required
                      value={centerPassword}
                      onChange={e => setCenterPassword(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
                      placeholder="••••"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1 ml-1">Tasdiqlash *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="password"
                      required
                      value={centerPasswordConfirm}
                      onChange={e => setCenterPasswordConfirm(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
                      placeholder="••••"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={registering}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-3 shadow-lg shadow-blue-600/25"
              >
                {registering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Akkaunt yaratilmoqda...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    <span>Markaz akkauntini yaratish</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-white/60 hover:text-white transition-colors"
              >
                Allaqachon akkauntingiz bormi? <span className="text-blue-400 font-semibold underline">Kirish</span>
              </button>
            </div>
          </div>
        )}
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
