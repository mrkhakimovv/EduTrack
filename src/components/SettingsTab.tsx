import { useState } from 'react';
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from './FirebaseAuthProvider';
import { Eye, EyeOff } from 'lucide-react';

export function SettingsTab() {
  const { appUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleSave = async () => {
    if (!login || !password || !currentPassword) return;
    
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const user = auth.currentUser;
      if (!user || !appUser) throw new Error("Foydalanuvchi topilmadi");

      // Re-authenticate
      const credential = EmailAuthProvider.credential(user.email!, currentPassword + "_system");
      await reauthenticateWithCredential(user, credential);

      // Update Email
      const newEmail = login.toLowerCase().trim() + "@edutrack.local";
      if (user.email !== newEmail) {
        await updateEmail(user, newEmail);
        
        // Update Firestore username
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          username: login.toLowerCase().trim()
        });
      }

      // Update Password
      const newPasswordStr = password + "_system";
      await updatePassword(user, newPasswordStr);

      setSuccessMsg("Ma'lumotlar saqlandi! Yangi ma'lumotlar bilan qayta kiring.");
      setTimeout(() => {
        setSuccessMsg('');
        auth.signOut(); // Force sign out after password change
      }, 3000);
      
      setCurrentPassword('');
      setLogin('');
      setPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setErrorMsg("Joriy parol xato kiritildi");
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg("Bu login band");
      } else {
        setErrorMsg("Xatolik yuz berdi");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-white mb-6">Sozlamalar</h2>
      
      <div className="max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Joriy parol</label>
          <div className="relative">
            <input
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
              placeholder="Joriy parolni kiriting"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
            >
              {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Yangi login</label>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
            placeholder="Yangi login kiriting"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Yangi parol</label>
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
              placeholder="Yangi parolni kiriting"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
            >
              {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!login || !password || !currentPassword || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-medium py-3 rounded-xl transition-colors"
        >
          {loading ? "Saqlanmoqda..." : "Saqlash"}
        </button>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-500/20 text-red-400 text-sm font-medium rounded-lg text-center">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 bg-green-500/20 text-green-400 text-sm font-medium rounded-lg text-center">
            {successMsg}
          </div>
        )}
      </div>
    </div>
  );
}
