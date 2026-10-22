import { useState, useMemo, useEffect } from 'react';
import { AppData, Student, getDebtAmount, getExpectedPayment, formatSum, PaymentRecord, hasStudentPendingPayment } from '../lib/store';
import { Search, CheckCircle2, Archive, ArrowLeft, Clock } from 'lucide-react';
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
  const [waiveRemaining, setWaiveRemaining] = useState(false);
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
      setWaiveRemaining(false);
    }
  }, [selectedStudent, monthKey, data.payments]);

  const handlePay = () => {
    if (!selectedStudent || !amountInput) return;
    const amount = parseInt(amountInput, 10);
    if (isNaN(amount) || amount <= 0) return;

    const currentDebt = getDebtAmount(selectedStudent, monthKey, data.payments);
    const standardAmount = currentDebt > 0 ? currentDebt : getExpectedPayment(selectedStudent, monthKey);
    const remainingDiff = standardAmount > 0 && amount < standardAmount ? (standardAmount - amount) : 0;

    addPayment({
      studentId: selectedStudent.id,
      amount,
      ...(waiveRemaining && remainingDiff > 0 ? { waivedAmount: remainingDiff } : {}),
      month: monthKey,
      note: paymentType // Use paymentType as note directly
    });

    setSuccessMsg("To'lov muvaffaqiyatli saqlandi!");
    setTimeout(() => setSuccessMsg(""), 2000);
    
    setSelectedStudent(null);
    setAmountInput("");
    setWaiveRemaining(false);
    setPaymentType("");
    setSearch("");
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 relative h-full overflow-y-auto custom-scrollbar p-4 sm:p-6">
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
      {selectedStudent && (() => {
        const currentDebt = getDebtAmount(selectedStudent, monthKey, data.payments);
        const standardAmount = currentDebt > 0 ? currentDebt : getExpectedPayment(selectedStudent, monthKey);
        const enteredAmount = parseInt(amountInput.replace(/\D/g, ''), 10) || 0;
        const remainingDiff = standardAmount > 0 && enteredAmount > 0 && enteredAmount < standardAmount
          ? (standardAmount - enteredAmount)
          : 0;

        return (
          <div className="bg-primary/10 border border-primary/25 rounded-2xl p-4 sm:p-5 fade-in shadow-xl">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-semibold text-base sm:text-lg text-white">
                {selectedStudent.fullName} uchun to'lov
              </h3>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="text-xs sm:text-sm text-white/60 hover:text-white px-3 py-1.5 bg-white/5 rounded-lg md:px-0 md:py-0 md:bg-transparent md:rounded-none shrink-0 cursor-pointer"
              >
                Bekor qilish
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-end">
              <div className="sm:col-span-5 flex flex-col gap-1">
                <label className="block text-sm md:text-xs text-white/50 mb-1 ml-1">Summa (so'm)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amountInput}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setAmountInput(val);
                    const num = parseInt(val, 10) || 0;
                    if (num >= standardAmount || num <= 0) {
                      setWaiveRemaining(false);
                    }
                  }}
                  onWheel={e => e.currentTarget.blur()}
                  placeholder="0"
                  className="w-full bg-black/20 border border-white/10 rounded-xl md:rounded-lg px-4 py-3 md:px-3 md:py-2 text-white text-lg md:text-base focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="sm:col-span-5 flex justify-end">
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
              <div className="sm:col-span-2 flex items-end mt-auto md:mt-0 pt-4 md:pt-0">
                <button
                  onClick={handlePay}
                  disabled={!amountInput || parseInt(amountInput) <= 0}
                  className="w-full h-[52px] md:h-[42px] text-lg md:text-base bg-primary text-white font-medium px-4 rounded-xl md:rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                >
                  To'lash
                </button>
              </div>
            </div>

            {remainingDiff > 0 && (
              <div
                onClick={() => setWaiveRemaining(prev => !prev)}
                className={cn(
                  "mt-3 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer select-none transition-all",
                  waiveRemaining
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/15"
                )}
              >
                <div className="flex flex-col min-w-0">
                  {!waiveRemaining ? (
                    <>
                      <span className="text-xs font-bold text-rose-400">
                        Chegirma: {formatSum(remainingDiff)}
                      </span>
                      <span className="text-[10px] text-white/50">
                        Belgilansa chegirma sifatida o'chiriladi (qarz bo'lib qolmaydi)
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-emerald-400">
                        Chegirma: {formatSum(remainingDiff)} (0 so'm qarz)
                      </span>
                      <span className="text-[10px] text-white/50">
                        {formatSum(remainingDiff)} chegirma qilindi va qarzdorlikka kiritilmaydi
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setWaiveRemaining(prev => !prev);
                  }}
                  className={cn(
                    "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all",
                    waiveRemaining
                      ? "bg-emerald-500 border-emerald-400 text-white shadow-sm shadow-emerald-500/30"
                      : "bg-black/30 border-rose-400/50 text-transparent hover:border-rose-400"
                  )}
                  title="Chegirma sifatida belgilash"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })()}

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
            const hasPending = hasStudentPendingPayment(student.id, monthKey, data.payments);
            const isSelected = selectedStudent?.id === student.id;
            
            return (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={cn(
                  "text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between w-full cursor-pointer",
                  isSelected 
                    ? "bg-primary/15 border-primary/40" 
                    : hasPending
                    ? "bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/15"
                    : debt > 0
                    ? "debt-glow border-destructive/15 bg-destructive/5 hover:bg-white/10"
                    : "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15"
                )}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className={cn(
                    "font-semibold truncate mb-1",
                    hasPending ? "text-amber-300" : debt === 0 ? "text-emerald-300" : "text-white/90"
                  )}>
                    <span>{student.fullName}</span>
                  </div>
                  <div className="text-sm">
                    {hasPending ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-amber-400 font-semibold flex items-center gap-1.5 text-xs">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>Kutilmoqda (Markaz tasdiqlamagan)</span>
                        </span>
                        {debt > 0 && (
                          <span className="text-rose-400 text-xs font-medium">
                            Qoldiq qarz: {new Intl.NumberFormat("uz-UZ").format(debt)} so'm
                          </span>
                        )}
                      </div>
                    ) : debt > 0 ? (
                      <span className="text-destructive font-semibold">
                        {new Intl.NumberFormat("uz-UZ").format(debt)} so'm qarz
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> To'langan
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
