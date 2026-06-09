import { GraduationCap, BookOpen, Users, LayoutGrid, Sun, Moon, Droplet } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';

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
    <header className="h-20 glass-card border-b border-white/10 flex items-center px-4 sm:px-8 justify-between shrink-0">
      <div className="mx-auto w-full flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white border border-white/5 transition-colors"
            title="Mavzuni o'zgartirish"
          >
            {renderThemeIcon()}
          </button>
          
          <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
            <GraduationCap className="h-7 w-7 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">EduTrack</h1>
            <p className="text-[10px] sm:text-xs text-white/50 uppercase tracking-widest">Davomat va to'lovlar tizimi</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onCreateGroup}
            className="hidden sm:flex px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium items-center gap-2 border border-blue-400/30 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Guruh yaratish
          </button>
          
          <button
            onClick={onAddStudent}
            className="hidden sm:flex px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium items-center gap-2 border border-emerald-400/30 transition-colors"
          >
            <Users className="h-4 w-4" />
            O'quvchi qo'shish
          </button>
          
          <button
            onClick={onShowAllStudents}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors border border-white/5"
          >
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Barcha o'quvchilar</span>
          </button>

          <button
            onClick={onShowAllGroups}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors border border-white/5"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden md:inline">Barcha guruhlar</span>
          </button>
        </div>
      </div>
    </header>
  );
}
