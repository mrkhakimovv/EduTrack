import { GraduationCap, BookOpen, Users, LayoutGrid, Sun, Moon, Droplet, LogOut, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from './FirebaseAuthProvider';

interface HeaderProps {
  onCreateGroup: () => void;
  onAddStudent: () => void;
  onShowAllStudents: () => void;
  onShowAllGroups: () => void;
}

export function Header({
  onCreateGroup,
  onAddStudent,
  onShowAllStudents,
  onShowAllGroups
}: HeaderProps) {
  const [theme, setTheme] = useState<'dark' | 'light' | 'blue'>('dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { appUser } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | 'blue';
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.remove('light-mode', 'blue-mode');
      if (saved === 'light') {
        document.documentElement.classList.add('light-mode');
      } else if (saved === 'blue') {
        document.documentElement.classList.add('blue-mode');
      }
    }
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      let next: 'dark' | 'light' | 'blue' = 'dark';
      if (prev === 'dark') next = 'light';
      else if (prev === 'light') next = 'blue';
      else if (prev === 'blue') next = 'dark';

      document.documentElement.classList.remove('light-mode', 'blue-mode');
      if (next === 'light') {
        document.documentElement.classList.add('light-mode');
      } else if (next === 'blue') {
        document.documentElement.classList.add('blue-mode');
      }
      localStorage.setItem('theme', next);
      return next;
    });
  };

  const renderThemeIcon = () => {
    if (theme === 'light') return <Sun className="w-5 h-5 text-amber-500" />;
    if (theme === 'blue') return <Droplet className="w-5 h-5" />;
    return <Moon className="w-5 h-5" />;
  };

  return (
    <header className="min-h-[5rem] py-3 sm:py-0 glass-card border-b border-white/10 flex items-center px-3 sm:px-8 shrink-0 relative z-50">
      <div className="mx-auto w-full flex flex-wrap max-w-7xl items-center justify-between gap-y-3 relative">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden w-9 h-9 shrink-0 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white border border-white/5 transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30 hidden sm:flex">
            <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7 text-blue-500" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-500 sm:hidden" />
              EduTrack
            </h1>
            <p className="text-[9px] sm:text-[10px] sm:text-xs text-white/50 uppercase tracking-widest leading-none">Davomat va to'lovlar</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          <button 
            onClick={toggleTheme}
            className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white border border-white/5 transition-colors"
            title="Mavzuni o'zgartirish"
          >
            {renderThemeIcon()}
          </button>

          <div className="hidden sm:flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={onCreateGroup}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium items-center gap-2 border border-blue-400/30 transition-colors flex"
            >
              <BookOpen className="h-4 w-4" />
              Guruh yaratish
            </button>
            
            <button
              onClick={onAddStudent}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium items-center gap-2 border border-emerald-400/30 transition-colors flex"
            >
              <Users className="h-4 w-4" />
              O'quvchi qo'shish
            </button>
            
            <button
              onClick={onShowAllStudents}
              className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors border border-white/5 shrink-0"
            >
              <Users className="h-4 w-4" />
              Barcha o'quvchilar
            </button>

            <button
              onClick={onShowAllGroups}
              className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors border border-white/5 shrink-0"
            >
              <LayoutGrid className="h-4 w-4" />
              Barcha guruhlar
            </button>

            <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block"></div>

            <button
              onClick={() => signOut(auth)}
              className="w-10 h-10 shrink-0 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-500 hover:text-red-400 border border-red-500/20 transition-colors"
              title="Tizimdan chiqish"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden absolute top-[110%] left-0 w-64 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col p-2 gap-1 animate-in fade-in slide-in-from-top-2">
            <button
              onClick={() => { onCreateGroup(); setIsMobileMenuOpen(false); }}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors w-full text-left"
            >
              <BookOpen className="h-4 w-4 text-blue-400" />
              Guruh yaratish
            </button>
            <button
              onClick={() => { onAddStudent(); setIsMobileMenuOpen(false); }}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors w-full text-left"
            >
              <Users className="h-4 w-4 text-emerald-400" />
              O'quvchi qo'shish
            </button>
            <div className="h-px bg-white/10 my-1 w-full"></div>
            <button
              onClick={() => { onShowAllStudents(); setIsMobileMenuOpen(false); }}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors w-full text-left"
            >
              <Users className="h-4 w-4" />
              Barcha o'quvchilar
            </button>
            <button
              onClick={() => { onShowAllGroups(); setIsMobileMenuOpen(false); }}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors w-full text-left"
            >
              <LayoutGrid className="h-4 w-4" />
              Barcha guruhlar
            </button>
            <div className="h-px bg-white/10 my-1 w-full relative"></div>
            <button
              onClick={() => { signOut(auth); setIsMobileMenuOpen(false); }}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors w-full text-left"
            >
              <LogOut className="h-4 w-4" />
              Tizimdan chiqish
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
