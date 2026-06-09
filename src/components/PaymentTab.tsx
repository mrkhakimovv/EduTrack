import { useState, useMemo, useEffect } from 'react';
import { AppData, Student, getDebtAmount, PaymentRecord } from '../lib/store';
import { Search, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface PaymentTabProps {
  data: AppData;
  monthKey: string;
  addPayment: (payment: Omit<PaymentRecord, "id" | "date">) => void;
}

export function PaymentTab({ data, monthKey, addPayment }: PaymentTabProps) {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [amountInput, setAmountInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const filteredStudents = useMemo(() => {
    let result = data.students.filter(s => !s.deletedAt && !s.archived);
    if (!search.trim()) return result;
    const lowerSearch = search.toLowerCase();
    return result.filter(s => s.fullName.toLowerCase().includes(lowerSearch));
  }, [search, data.students]);

  // Pre-fill amount when student is selected
  useEffect(() => {
    if (selectedStudent) {
      const debt = getDebtAmount(selectedStudent, monthKey, data.payments);
      if (debt > 0) {
        setAmountInput(debt.toString());
      } else {
        setAmountInput("");
      }
    }
  }, [selectedStudent, monthKey, data.payments]);

  const handlePay = () => {
    if (!selectedStudent || !amountInput) return;
    const amount = parseInt(amountInput, 10);
    if (isNaN(amount) || amount <= 0) return;

    addPayment({
      studentId: selectedStudent.id,
      amount,
      month: monthKey,
      note: noteInput.trim()
    });

    setSuccessMsg("To'lov muvaffaqiyatli saqlandi!");
    setTimeout(() => setSuccessMsg(""), 2000);
    
    setSelectedStudent(null);
    setAmountInput("");
    setNoteInput("");
    setSearch("");
  };

  return (
    <div className="flex flex-col gap-6 relative h-full overflow-y-auto custom-scrollbar p-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
        <input
          type="text"
          placeholder="O'quvchini izlash..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Payment Form (Active only when student selected) */}
      {selectedStudent && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-white">
              {selectedStudent.fullName} uchun to'lov
            </h3>
            <button 
              onClick={() => setSelectedStudent(null)}
              className="text-sm text-white/50 hover:text-white"
            >
              Bekor qilish
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-4">
              <label className="block text-xs text-white/50 mb-1 ml-1">Summa (so'm)</label>
              <input
                type="number"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                placeholder="0"
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="sm:col-span-6">
              <label className="block text-xs text-white/50 mb-1 ml-1">Izoh (ixtiyoriy)</label>
              <input
                type="text"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="Naqd, karta..."
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="sm:col-span-2 flex items-end">
              <button
                onClick={handlePay}
                disabled={!amountInput || parseInt(amountInput) <= 0}
                className="w-full bg-primary text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                To'lash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className="absolute top-16 left-0 right-0 z-10 flex justify-center fade-in">
          <div className="bg-accent/20 border border-accent/30 text-accent px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-md shadow-lg">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">{successMsg}</span>
          </div>
        </div>
      )}

      {/* Students List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full py-8 text-center text-white/40">
            O'quvchilar topilmadi
          </div>
        ) : (
          filteredStudents.map(student => {
            const debt = getDebtAmount(student, monthKey, data.payments);
            const isSelected = selectedStudent?.id === student.id;
            
            return (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={cn(
                  "text-left p-4 rounded-xl border transition-all duration-200",
                  isSelected 
                    ? "bg-primary/10 border-primary/30" 
                    : "bg-white/5 border-white/5 hover:bg-white/10",
                  debt > 0 && !isSelected && "debt-glow border-destructive/10 bg-destructive/5"
                )}
              >
                <div className="font-medium text-white/90 truncate mb-1">
                  <span>{student.fullName}</span>
                </div>
                <div className="text-sm">
                  {debt > 0 ? (
                    <span className="text-destructive font-semibold">
                      {new Intl.NumberFormat("uz-UZ").format(debt)} so'm qarz
                    </span>
                  ) : (
                    <span className="text-accent flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> To'langan
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
