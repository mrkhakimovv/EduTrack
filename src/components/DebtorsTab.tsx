import { useMemo, useState } from 'react';
import { AppData, getDebtAmount, PaymentRecord, formatMonthKey } from '../lib/store';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface DebtorsTabProps {
  data: AppData;
  monthKey: string;
  addPayment: (payment: Omit<PaymentRecord, "id" | "date">) => void;
}

export function DebtorsTab({ data, monthKey, addPayment }: DebtorsTabProps) {
  const [payingStudentId, setPayingStudentId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [paymentType, setPaymentType] = useState<"Naqd" | "Karta">("Naqd");

  const debtors = useMemo(() => {
    return data.students.filter(s => !s.deletedAt && !s.archived).map(student => {
      const currentDebt = getDebtAmount(student, monthKey, data.payments);
      return {
        student,
        currentDebt
      };
    }).filter(d => d.currentDebt > 0);
  }, [data.students, data.payments, monthKey]);

  const handlePay = (studentId: string) => {
    const amount = parseInt(amountInput, 10);
    if(isNaN(amount) || amount <= 0) return;

    addPayment({
      studentId,
      amount,
      month: monthKey,
      note: paymentType
    });
    setPayingStudentId(null);
    setAmountInput("");
  };

  const openPayForm = (studentId: string, debtStr: string) => {
    setPayingStudentId(studentId);
    setAmountInput(debtStr);
    setPaymentType("Naqd");
  };

  if (data.students.length === 0) {
    return <div className="text-center text-white/50 py-8">Hali o'quvchilar yo'q</div>;
  }

  if (debtors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-medium text-white mb-2">Bu oyda qarzdorlar yo'q</h3>
        <p className="text-white/50 text-sm max-w-sm">
          Barcha o'quvchilar ushbu oy uchun to'lovni amalga oshirgan.
        </p>
      </div>
    );
  }

  const overallTotalDebt = debtors.reduce((sum, d) => sum + d.currentDebt, 0);

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar p-6">
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center justify-between shrink-0">
        <span className="text-destructive font-medium">
          Jami {debtors.length} ta qarzdor
        </span>
        <span className="text-destructive font-bold text-lg">
          {new Intl.NumberFormat("uz-UZ").format(overallTotalDebt)} so'm qarz
        </span>
      </div>

      <div className="grid gap-4">
        {debtors.map(({ student, currentDebt }) => (
          <div key={student.id} className="bg-white/5 border border-white/5 border-l-destructive/50 border-l-4 rounded-xl p-4 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
              <div className="flex flex-col gap-1">
                <div className="debt-glow">
                  <span className="font-semibold text-white/90 text-lg">{student.fullName}</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-md bg-destructive/20 text-destructive text-xs font-semibold">
                    Shu oygi qarz: {new Intl.NumberFormat("uz-UZ").format(currentDebt)} so'm
                  </span>
                </div>
              </div>

              {payingStudentId === student.id ? (
                <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
                  <div className="flex bg-black/40 p-1 rounded-lg">
                    <button
                      onClick={() => setPaymentType("Naqd")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        paymentType === "Naqd" ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      )}
                    >
                      Naqd
                    </button>
                    <button
                      onClick={() => setPaymentType("Karta")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        paymentType === "Karta" ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      )}
                    >
                      Karta
                    </button>
                  </div>
                  <input
                    type="number"
                    value={amountInput}
                    onChange={e => setAmountInput(e.target.value)}
                    className="w-32 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                    placeholder="Summa"
                  />
                  <button
                    onClick={() => handlePay(student.id)}
                    disabled={!amountInput}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    To'lash
                  </button>
                  <button
                    onClick={() => setPayingStudentId(null)}
                    className="bg-white/5 border border-white/10 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                  >
                    Bekor
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openPayForm(student.id, currentDebt.toString())}
                  className="w-full sm:w-auto bg-white/5 border border-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Tezko'r to'lov
                </button>
              )}

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
