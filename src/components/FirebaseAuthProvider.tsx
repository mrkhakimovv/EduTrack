import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Loader2 } from 'lucide-react';

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (e: any) {
          console.error(e);
          setError(e.message || "Tizimga kirishda xatolik yuz berdi");
          setLoading(false);
        }
      }
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="gradient-bg min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="gradient-bg min-h-screen flex flex-col items-center justify-center p-4">
        <div className="glass-card max-w-sm w-full p-8 rounded-2xl flex flex-col items-center gap-6 text-center">
          <div className="text-red-400 font-medium mb-4">
            Avtomatik tizimga kirish uchun Firebase konsolidan "Anonymous" (Mehmon) auth usulini yoqing.
          </div>
          <div className="text-sm text-white/60 bg-black/20 p-4 rounded-xl text-left font-mono break-all">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
