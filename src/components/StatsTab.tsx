import { useMemo, useState } from 'react';
import { AppData, PaymentRecord, formatSum, isStudentDebtor, formatDateTime } from '../lib/store';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface StatsTabProps {
  data: AppData;
  monthKey: string;
  updatePayment: (id: string, updates: Partial<PaymentRecord>) => void;
  deletePayment: (id: string) => void;
  archivedStudentsCount?: number;
}

export function StatsTab({ data, monthKey, updatePayment, deletePayment, archivedStudentsCount = 0 }: StatsTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const monthPayments = useMemo(() => {
    return data.payments
      .filter(p => p.month === monthKey)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.payments, monthKey]);

  const stats = useMemo(() => {
    const activeStudents = data.students.filter(s => !s.deletedAt && !s.archived);
    const totalStudents = activeStudents.length;
    const paidStudentIds = new Set(monthPayments.map(p => p.studentId));
    let debtorsCount = 0;
    
    activeStudents.forEach(s => {
      if (isStudentDebtor(s, monthKey, data.payments)) {
        debtorsCount++;
      }
    });

    const totalCollected = monthPayments.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalStudents,
      paidStudents: paidStudentIds.size,
      debtorsCount,
      totalCollected
    };
  }, [data.students, monthPayments, monthKey, data.payments]);

  const handleEditSave = (p: PaymentRecord) => {
    const amt = parseInt(editAmount, 10);
    if (!isNaN(amt) && amt > 0 && amt !== p.amount) {
      updatePayment(p.id, { 
        amount: amt,
        editDates: [...(p.editDates || []), new Date().toISOString()]
      });
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-8 p-6 h-full overflow-y-auto custom-scrollbar">
      {/* 5 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 shrink-0">
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex flex-col justify-center">
          <span className="text-white/60 text-xs sm:text-sm mb-1">Jami o'quvchilar</span>
          <span className="text-xl sm:text-2xl font-bold text-primary">{stats.totalStudents}</span>
        </div>
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 flex flex-col justify-center">
          <span className="text-white/60 text-xs sm:text-sm mb-1">To'lov qilgan</span>
          <span className="text-xl sm:text-2xl font-bold text-accent">{stats.paidStudents}</span>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex flex-col justify-center">
          <span className="text-white/60 text-xs sm:text-sm mb-1">Qarzdorlar</span>
          <span className="text-xl sm:text-2xl font-bold text-destructive">{stats.debtorsCount}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center">
          <span className="text-white/60 text-xs sm:text-sm mb-1">Arxivlangan o'quvchilar</span>
          <span className="text-xl sm:text-2xl font-bold text-white/90">{archivedStudentsCount}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center">
          <span className="text-white/60 text-xs sm:text-sm mb-1">Jami yig'ilgan</span>
          <span className="text-xl sm:text-2xl font-bold text-white/90">{formatSum(stats.totalCollected).replace(" so'm", "")}</span>
        </div>
      </div>

      <div className="w-full h-px bg-white/5 line" />

      {/* Payment History */}
      <div>
        <h3 className="text-lg font-semibold text-white/90 mb-4">
          To'lovlar tarixi
        </h3>
        <p className="text-sm text-white/50 mb-4">
          Shu oyda {monthPayments.length} ta to'lov amalga oshirilgan
        </p>

        {monthPayments.length === 0 ? (
          <div className="bg-white/5 rounded-xl border border-white/5 p-8 text-center text-white/40">
            Hali to'lovlar mavjud emas
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {monthPayments.map(p => {
              const student = data.students.find(s => s.id === p.studentId);
              const name = student ? student.fullName : "O'chirib yuborilgan o'quvchi";
              const isEditing = editingId === p.id;
              const isDeleting = deletingId === p.id;

              return (
                <div key={p.id} className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors hover:bg-white/[0.07]">
                  <div className="flex flex-col">
                    <span className="font-medium text-white/90">{name}</span>
                    <div className="flex flex-col gap-1 mt-1.5 text-xs text-white/40">
                      <div className="flex items-center gap-2">
                        <span className={cn(p.editDates?.length ? "line-through opacity-50" : "")}>
                          {formatDateTime(p.date)}
                        </span>
                        {p.note && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span className="px-1.5 py-0.5 rounded uppercase text-[9px] font-bold tracking-wider border border-white/10 bg-white/5">{p.note}</span>
                          </>
                        )}
                      </div>
                      
                      {p.editDates && p.editDates.length > 0 && (
                        <div className="flex flex-col mt-1 space-y-1">
                          {p.editDates.map((d, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[11px] text-accent/80">
                              <Pencil className="h-3 w-3" />
                              <span>{formatDateTime(d)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto sm:mt-1">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          className="w-24 bg-black/20 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none"
                        />
                        <button onClick={() => handleEditSave(p)} className="text-accent hover:bg-accent/20 p-1 rounded">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-white/50 hover:bg-white/10 p-1 rounded">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : isDeleting ? (
                      <div className="flex flex-col sm:flex-row items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                        <span className="text-xs text-destructive font-medium whitespace-nowrap">O'chirish aniqmi?</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => deletePayment(p.id)} className="text-xs bg-destructive text-white px-3 py-1 rounded hover:bg-destructive/90 font-medium">
                            Ha
                          </button>
                          <button onClick={() => setDeletingId(null)} className="text-xs bg-white/10 text-white px-3 py-1 rounded hover:bg-white/20 font-medium border border-white/5">
                            Yo'q
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="font-bold text-accent">
                        {formatSum(p.amount)}
                      </span>
                    )}

                    {!isEditing && !isDeleting && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => { setEditingId(p.id); setEditAmount(p.amount.toString()); }}
                          className="p-1.5 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
                          title="Tahrirlash"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => setDeletingId(p.id)}
                          className="p-1.5 text-white/40 hover:text-destructive bg-white/5 hover:bg-destructive/10 rounded transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
