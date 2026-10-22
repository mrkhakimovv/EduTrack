export interface Group {
  id: string;
  name: string;
  time: string;
  days: number[];
  monthlyPayment?: number;
  centerId?: string;
  teacherId?: string;
  teacherName?: string;
  createdAt: string;
  archived?: boolean;
  archivedAt?: string;
  deletedAt?: string;
  history?: Array<{
    updatedAt: string;
    name: string;
    time: string;
    days: number[];
    monthlyPayment?: number;
    archived?: boolean;
    archivedAt?: string;
    deletedAt?: string;
  }>;
}

export interface Student {
  id: string;
  fullName: string;
  phone: string;
  parentPhone: string;
  school: string;
  grade: string;
  groupIds: string[];
  joinDate: string;
  firstMonthPayment: number;
  monthlyPayment: number;
  groupPricing?: Record<string, { monthly: number, firstMonth: number }>;
  centerId?: string;
  teacherId?: string;
  teacherName?: string;
  createdAt: string;
  archived?: boolean;
  archivedAt?: string;
  deletedAt?: string;
  history?: Array<{
    updatedAt: string;
    fullName: string;
    phone: string;
    parentPhone: string;
    school: string;
    grade: string;
    groupIds: string[];
    joinDate: string;
    firstMonthPayment: number;
    monthlyPayment: number;
    groupPricing?: Record<string, { monthly: number, firstMonth: number }>;
    archived?: boolean;
    archivedAt?: string;
    deletedAt?: string;
  }>;
}

export interface AttendanceRecord {
  [studentId: string]: {
    [date: string]: "present" | "absent";
  };
}

export interface PaymentRecord {
  id: string;
  studentId: string;
  amount: number;
  waivedAmount?: number;
  month: string;
  date: string;
  note: string;
  centerId?: string;
  teacherId?: string;
  teacherName?: string;
  centerStatus?: 'pending' | 'accepted';
  acceptedAt?: string;
  editDates?: string[];
}

export function isPaymentPending(p: PaymentRecord): boolean {
  if (p.centerStatus === 'pending') return true;
  if (p.centerStatus === 'accepted') return false;
  // Legacy payments: if created by a teacher attached to a center (teacherId !== centerId), treat as pending until accepted
  if (p.centerId && p.teacherId && p.teacherId !== p.centerId) {
    return true;
  }
  return false;
}

export function hasStudentPendingPayment(studentId: string, monthKey: string, payments: PaymentRecord[]): boolean {
  return payments.some(p => p.studentId === studentId && p.month === monthKey && isPaymentPending(p));
}

export interface AppData {
  groups: Group[];
  students: Student[];
  attendance: { [groupId_month: string]: AttendanceRecord };
  payments: PaymentRecord[];
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function getLessonDates(group: Group, year: number, month: number): string[] {
  const dates: string[] = [];
  const date = new Date(year, month, 1);
  const targetMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const createdDateStr = (group.createdAt || '').split('T')[0];
  const createdMonthPrefix = createdDateStr ? createdDateStr.slice(0, 7) : '';
  
  while (date.getMonth() === month) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dateTs = new Date(`${dateStr}T23:59:59`).getTime();

    if (!createdMonthPrefix || targetMonthPrefix >= createdMonthPrefix) {
      let daysForDate = group.days;
      if (group.history && group.history.length > 0) {
        for (let i = 0; i < group.history.length; i++) {
          const h = group.history[i];
          if (new Date(h.updatedAt).getTime() > dateTs && h.days && h.days.length > 0) {
            daysForDate = h.days;
            break;
          }
        }
      }

      const effectiveDays = (daysForDate && daysForDate.length > 0)
        ? daysForDate
        : [1, 2, 3, 4, 5, 6];
      
      if (effectiveDays.includes(date.getDay())) {
        dates.push(dateStr);
      }
    }
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

export function getExpectedPayment(student: Student, monthKey: string): number {
  const joinDate = new Date(student.joinDate);
  const joinMonthKey = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}`;
  
  if (monthKey < joinMonthKey) {
    return 0;
  }

  // Use per-group pricing if available
  if (student.groupPricing && Object.keys(student.groupPricing).length > 0) {
    let total = 0;
    let foundAny = false;
    for (const groupId of (student.groupIds || [])) {
      const pricing = student.groupPricing[groupId];
      if (pricing) {
        foundAny = true;
        if (monthKey === joinMonthKey) {
          total += pricing.firstMonth;
        } else {
          total += pricing.monthly;
        }
      }
    }
    if (foundAny) {
      return total;
    }
  }

  // Fallback to legacy global logic
  if (monthKey === joinMonthKey) {
    return student.firstMonthPayment;
  }
  return student.monthlyPayment;
}

export function getOverallDebt(student: Student, currentMonthKey: string, payments: PaymentRecord[]): number {
  let totalDebt = 0;
  const joinDate = new Date(student.joinDate);
  const [y, m] = currentMonthKey.split('-').map(Number);
  const targetDate = new Date(y, m - 1, 1);
  
  let curr = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
  while(curr <= targetDate) {
    const checkKey = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
    totalDebt += getDebtAmount(student, checkKey, payments);
    curr.setMonth(curr.getMonth() + 1);
  }
  return totalDebt;
}

export function getDebtAmount(student: Student, monthKey: string, payments: PaymentRecord[]): number {
  const expected = getExpectedPayment(student, monthKey);
  const studentMonthPayments = payments.filter(p => p.studentId === student.id && p.month === monthKey);
  const paid = studentMonthPayments.reduce((sum, p) => sum + p.amount, 0);
  const waived = studentMonthPayments.reduce((sum, p) => sum + (p.waivedAmount || 0), 0);
  return Math.max(0, expected - paid - waived);
}

export function isStudentDebtor(student: Student, monthKey: string, payments: PaymentRecord[]): boolean {
  return getDebtAmount(student, monthKey, payments) > 0;
}

export interface GroupFinancialStats {
  groupId: string;
  totalStudents: number;
  expectedAmount: number;
  collectedAmount: number;
  confirmedAmount: number;
  pendingAmount: number;
  remainingAmount: number;
  paidPercentage: number;
  debtorCount: number;
}

export function getGroupFinancialStats(
  group: Group,
  students: Student[],
  payments: PaymentRecord[],
  monthKey: string
): GroupFinancialStats {
  const groupStudents = students.filter(s => {
    if (s.deletedAt || s.archived) return false;
    return Boolean(s.groupIds?.includes(group.id));
  });

  let totalExpected = 0;
  let totalCollected = 0;
  let totalConfirmed = 0;
  let totalPending = 0;
  let totalRemaining = 0;
  let debtorCount = 0;

  groupStudents.forEach(student => {
    const joinDate = new Date(student.joinDate);
    const joinMonthKey = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}`;
    
    // If student joined after this monthKey, expected is 0
    if (monthKey < joinMonthKey) return;

    let studentBaseExpectedForGroup = 0;
    if (student.groupPricing && student.groupPricing[group.id]) {
      const p = student.groupPricing[group.id];
      studentBaseExpectedForGroup = monthKey === joinMonthKey ? p.firstMonth : p.monthly;
    } else {
      const numGroups = Math.max(1, (student.groupIds || []).length);
      const studentTotalExpected = monthKey === joinMonthKey ? student.firstMonthPayment : student.monthlyPayment;
      studentBaseExpectedForGroup = Math.round(studentTotalExpected / numGroups);
    }

    const studentTotalExpected = getExpectedPayment(student, monthKey);
    const studentPaymentsInMonth = payments.filter(p => p.studentId === student.id && p.month === monthKey);
    const studentTotalPaid = studentPaymentsInMonth.reduce((sum, p) => sum + p.amount, 0);
    const studentTotalWaived = studentPaymentsInMonth.reduce((sum, p) => sum + (p.waivedAmount || 0), 0);
    const studentConfirmedPaid = studentPaymentsInMonth
      .filter(p => !isPaymentPending(p))
      .reduce((sum, p) => sum + p.amount, 0);
    const studentPendingPaid = studentPaymentsInMonth
      .filter(p => isPaymentPending(p))
      .reduce((sum, p) => sum + p.amount, 0);

    let studentWaivedForGroup = 0;
    if (studentTotalExpected > 0) {
      const ratio = studentBaseExpectedForGroup / studentTotalExpected;
      studentWaivedForGroup = Math.round(studentTotalWaived * ratio);
    } else {
      const numGroups = Math.max(1, (student.groupIds || []).length);
      studentWaivedForGroup = Math.round(studentTotalWaived / numGroups);
    }

    const studentExpectedForGroup = Math.max(0, studentBaseExpectedForGroup - studentWaivedForGroup);

    let studentPaidForGroup = 0;
    let studentConfirmedForGroup = 0;
    let studentPendingForGroup = 0;

    if (studentTotalExpected > 0) {
      const ratio = studentBaseExpectedForGroup / studentTotalExpected;
      studentPaidForGroup = Math.min(studentExpectedForGroup, Math.round(studentTotalPaid * ratio));
      if (studentTotalPaid > studentExpectedForGroup) {
        studentPaidForGroup = Math.round(studentTotalPaid * ratio);
      }
      studentConfirmedForGroup = Math.round(studentConfirmedPaid * ratio);
      studentPendingForGroup = Math.round(studentPendingPaid * ratio);
    } else if (studentExpectedForGroup > 0) {
      studentPaidForGroup = Math.min(studentExpectedForGroup, studentTotalPaid);
      studentConfirmedForGroup = studentConfirmedPaid;
      studentPendingForGroup = studentPendingPaid;
    } else {
      const numGroups = Math.max(1, (student.groupIds || []).length);
      studentPaidForGroup = Math.round(studentTotalPaid / numGroups);
      studentConfirmedForGroup = Math.round(studentConfirmedPaid / numGroups);
      studentPendingForGroup = Math.round(studentPendingPaid / numGroups);
    }

    const studentRemainingForGroup = Math.max(0, studentExpectedForGroup - studentPaidForGroup);

    totalExpected += studentExpectedForGroup;
    totalCollected += studentPaidForGroup;
    totalConfirmed += studentConfirmedForGroup;
    totalPending += studentPendingForGroup;
    totalRemaining += studentRemainingForGroup;
    if (studentRemainingForGroup > 0) {
      debtorCount++;
    }
  });

  const paidPercentage = totalExpected > 0 ? Math.min(100, Math.round((totalCollected / totalExpected) * 100)) : 0;

  return {
    groupId: group.id,
    totalStudents: groupStudents.length,
    expectedAmount: totalExpected,
    collectedAmount: totalCollected,
    confirmedAmount: totalConfirmed,
    pendingAmount: totalPending,
    remainingAmount: totalRemaining,
    paidPercentage,
    debtorCount
  };
}

export function formatSum(amount: number): string {
  return new Intl.NumberFormat("uz-UZ").format(amount) + " so'm";
}

export const MONTH_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"
];

export function formatMonthKey(monthKey: string): string {
  if (!monthKey) return "";
  const [year, month] = monthKey.split('-');
  const monthIdx = parseInt(month, 10) - 1;
  if (!year || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return monthKey;
  return `${year} - ${MONTH_NAMES[monthIdx]}`;
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()].toLowerCase();
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month} ${year} ${hours}:${minutes}`;
}

export const DAY_NAMES = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
export const DAY_NAMES_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

const STORAGE_KEY = "edutrack_data";

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as AppData;
    }
  } catch (e) {
    console.error("Failed to load data", e);
  }
  return {
    groups: [],
    students: [],
    attendance: {},
    payments: []
  };
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save data", e);
  }
}
