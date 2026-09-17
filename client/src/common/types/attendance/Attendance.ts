export interface Attendance {
  companyId: string;
  _id: string;
  employeeId: string;
  date: string;
  clockIn?: string | null;
  clockOut?: string | null;
  status: "PONCTUEL" | "RETARD" | "ABSENT" | "CONGÉ" | null;
  source: "MANUAL" | "AUTO_CLIENT" | "AUTO_SERVER";
  lateMinutes?: number;
  notes?: string;
  serverVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  lastSyncedAt?: string;
  synced?: number;
  isDeleted?: number;
}

export interface PayrollAttendanceSummary {
  companyId: string;
  employeeId: string;
  lateDays: number;
  totalLateMinutes: number;
  absentDays: number;
}

export interface CreateAttendanceDto {
  companyId: string;
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string | null;
  status?: "PONCTUEL" | "RETARD" | "ABSENT" | "CONGÉ" | null;
}

export interface AttendanceWithEmployee extends Attendance {
  companyId: string;
  firstName: string;
  lastName: string;
  matricule: string;
  role: string;
  department: string;
}
