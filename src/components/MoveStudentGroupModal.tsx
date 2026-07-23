import { useState } from 'react';
import { Group, Student } from '../lib/store';
import { X, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface MoveStudentGroupModalProps {
  student: Student;
  groups: Group[];
  onClose: () => void;
  onSave: (groupIds: string[]) => void;
}

export function MoveStudentGroupModal({ student, groups, onClose, onSave }: MoveStudentGroupModalProps) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(student.groupIds || []);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSave = () => {
    onSave(selectedGroupIds);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm glass-modal rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            Guruhni o'zgartirish
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-white/70">O'quvchi: <span className="font-semibold text-white/90">{student.fullName}</span></p>
        </div>

        <div className="flex flex-wrap gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 pb-2">
          {groups.filter(g => !g.archived).map(group => {
            const isSelected = selectedGroupIds.includes(group.id);
            return (
              <button
                key={group.id}
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-sm",
                  isSelected 
                    ? "bg-[#10b98122] border-[#10b981] text-[#10b981]" 
                    : "bg-[#ef444422] border-[#ef4444] text-[#ef4444] hover:bg-[#ef444433]"
                )}
              >
                <span className="font-medium">{group.name}</span>
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            Bekor qilish
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 rounded-xl transition-colors"
          >
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}
