import { useState, useMemo, useEffect } from 'react';
import { AppData, Student, getDebtAmount, PaymentRecord } from '../lib/store';
import { Search, CheckCircle2, Archive, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface PaymentTabProps {
  data: AppData;
  monthKey: string;
  addPayment: (payment: Omit<PaymentRecord, "id" | "date">) => void;
  onClose?: () => void;
}

export function PaymentTab({ data, monthKey, addPayment, onClose }: PaymentTabProps) {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [amountInput, setAmountInput] = useState("");
  const [paymentType, setPaymentType] = useState<"Naqd" | "Karta" | "">("");
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
      note: paymentType // Use paymentType as note directly
    });

    setSuccessMsg("To'lov muvaffaqiyatli saqlandi!");
    setTimeout(() => setSuccessMsg(""), 2000);
    
    setSelectedStudent(null);
    setAmountInput("");
    setPaymentType("");
    setSearch("");
  };

  return (
    <div className={cn(
      "flex flex-col gap-6 relative h-full overflow-y-auto custom-scrollbar p-6",
      "fixed inset-0 z-[60] bg-sys-base md:static md:z-auto md:bg-transparent"
    )}>
      {/* Mobile Header */}
      <div className="flex md:hidden items-center gap-4 mb-2">
        <button onClick={onClose} className="p-2 -ml-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft className="h-5 w-5 text-white/70" />
        </button>
        <h2 className="text-xl font-bold text-white">To'lov</h2>
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-20">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full py-8 text-center text-white/40">
            O'quvchilar topilmadi
          </div>
        ) : (
          filteredStudents.map(student => {
            const debt = getDebtAmount(student, monthKey, data.payments);
            const isSelected = selectedStudent?.id === student.id;
            
            return (
              <div 
                key={student.id} 
                className={cn(
                  "flex flex-col gap-2", 
                  isSelected && "col-span-1 md:col-span-2 lg:col-span-3"
                )}
              >
                <button
                  onClick={() => setSelectedStudent(isSelected ? null : student)}
                  className={cn(
                    "text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between w-full",
                    isSelected 
                      ? "bg-primary/10 border-primary/30" 
                      : "bg-white/5 border-white/5 hover:bg-white/10",
                    debt > 0 && !isSelected && "debt-glow border-destructive/10 bg-destructive/5"
                  )}
                >
                  <div className="flex-1 min-w-0 pr-4">
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
                  </div>
                </button>

                {isSelected && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 sm:p-5 fade-in mt-1">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg text-white">
                        {student.fullName} uchun to'lov
                      </h3>
                      <button 
                        onClick={() => setSelectedStudent(null)}
                        className="text-sm text-white/50 hover:text-white"
                      >
                        Bekor qilish
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      <div className="md:col-span-5 flex flex-col gap-1">
                        <label className="block text-sm text-white/50 mb-1 ml-1">Summa (so'm)</label>
                        <input
                          type="number"
                          value={amountInput}
                          onChange={e => setAmountInput(e.target.value)}
                          placeholder="0"
                          className="w-full bg-black/20 border border-white/10 rounded-xl md:rounded-lg px-4 py-3 md:px-3 md:py-2 text-white text-lg md:text-base focus:outline-none focus:border-primary/50"
                        />
                      </div>
                      <div className="md:col-span-5 flex justify-end">
                          <div className="flex bg-black/40 p-1.5 md:p-1 rounded-xl md:rounded-lg border border-white/5 w-full h-[52px] md:h-[42px]">
                            <button
                              onClick={() => setPaymentType(paymentType === "Naqd" ? "" : "Naqd")}
                              className={cn(
                                "flex-1 px-4 py-2 md:py-1.5 text-base md:text-sm font-medium rounded-lg md:rounded-md transition-all",
                                paymentType === "Naqd" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80 hover:bg-white/5"
                              )}
                            >
                              Naqd
                            </button>
                            <button
                              onClick={() => setPaymentType(paymentType === "Karta" ? "" : "Karta")}
                              className={cn(
                                "flex-1 px-4 py-2 md:py-1.5 text-base md:text-sm font-medium rounded-lg md:rounded-md transition-all",
                                paymentType === "Karta" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80 hover:bg-white/5"
                              )}
                            >
                              Karta
                            </button>
                          </div>
                      </div>
                      <div className="md:col-span-2 flex items-end mt-2 md:mt-0">
                        <button
                          onClick={handlePay}
                          disabled={!amountInput || parseInt(amountInput) <= 0}
                          className="w-full h-[52px] md:h-[42px] text-lg md:text-base bg-primary text-white font-medium px-4 rounded-xl md:rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                        >
                          To'lash
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
