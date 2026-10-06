export type TransportAllowanceDayStatus =
  | "WORKED"
  | "LATE"
  | "ABSENT"
  | "LEAVE"
  | "NO_RECORD";

export interface TransportAllowanceDay {
  date: string;
  status: TransportAllowanceDayStatus;
  amount: number;
}

export interface TransportAllowanceEmployee {
  companyId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  matricule: string;
  department: string;
  role: string;
  monday: TransportAllowanceDay;
  tuesday: TransportAllowanceDay;
  wednesday: TransportAllowanceDay;
  thursday: TransportAllowanceDay;
  friday: TransportAllowanceDay;
  workedDays: number;
  lateDays: number;
  ratePerDay: number;
  weeklyAllowance: number;
}

export interface TransportAllowanceWeeklyReport {
  companyId: string;
  weekStart: string;
  weekEnd: string;
  employees: TransportAllowanceEmployee[];
  totalAllowance: number;
  totalEmployees: number;
  generatedAt: string;
}
