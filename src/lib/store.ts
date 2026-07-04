export interface Group {
  id: string;
  name: string;
  time: string;
  days: number[];
  monthlyPayment?: number;
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
  month: string;
  date: string;
  note: string;
  editDates?: string[];
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
  
  while (date.getMonth() === month) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dateTs = new Date(`${dateStr}T23:59:59`).getTime();
    const groupCreatedTs = new Date(group.createdAt).getTime();
    
    // Treat the start date as midnight of that day, so we compare dates easily
    const createdDateOnlyTs = new Date(`${group.createdAt.split('T')[0]}T00:00:00`).getTime();
    const currentIterTs = new Date(`${dateStr}T00:00:00`).getTime();

    if (currentIterTs >= createdDateOnlyTs) {
      let daysForDate = group.days;
      if (group.history && group.history.length > 0) {
        for (let i = 0; i < group.history.length; i++) {
          const h = group.history[i];
          if (new Date(h.updatedAt).getTime() > dateTs) {
            daysForDate = h.days;
            break;
          }
        }
      }
      
      if (daysForDate.includes(date.getDay())) {
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
    for (const groupId of student.groupIds) {
      const pricing = student.groupPricing[groupId];
      if (pricing) {
        if (monthKey === joinMonthKey) {
          total += pricing.firstMonth;
        } else {
          total += pricing.monthly;
        }
      }
    }
    return total;
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
  const paid = payments
    .filter(p => p.studentId === student.id && p.month === monthKey)
    .reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, expected - paid);
}

export function isStudentDebtor(student: Student, monthKey: string, payments: PaymentRecord[]): boolean {
  return getDebtAmount(student, monthKey, payments) > 0;
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
