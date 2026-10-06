export type AttendanceDailyCheckStatus =
  | "PREPARING"
  | "OPEN"
  | "VERIFIED"
  | "MANAGER_NOTIFIED"
  | "LOCKED";

export interface AttendanceDailyCheck {
  companyId: string;
  _id: string;
  date: string;
  status: AttendanceDailyCheckStatus;
  serverVersion: number;
  markAbsentCompleted: number | null;
  markAbsentCompletedAt: string | null;
  markLeaveCompleted: number | null;
  markLeaveCompletedAt: string | null;
  totalEmployees: number;
  verifiedEmployees: number;
  verifiedAt: string | null;
  verifiedBy: string | null;
  managerId: string | null;
  managerNotifiedAt: string | null;
  managerNotifiedTo: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  synced: number;
  createdAt: string;
  updatedAt: string;
  isDeleted: number;
}

export interface AttendanceDailyCheckPreparationInput {
  companyId: string;
  markAbsentCompleted: {
    completed: boolean;
    completedAt: string | null;
  };

  markLeaveCompleted: {
    completed: boolean;
    completedAt: string | null;
  };

  date: string;
}

export interface VerifyAttendanceDailyCheckInput {
  companyId: string;
  date: string;
  verifiedBy: string;
}

export interface VerifyDailyAttendanceResult {
  companyId: string;
  success: boolean;
  date: string;
  checkId: string;
  verifiedBy: string;
  employeeCount: number;
  attendanceCount: number;
  missingEmployeeIds: string[];
}

export interface MarkManagerNotifiedInput {
  companyId: string;
  date: string;
}

export interface LockAttendanceDailyCheckInput {
  companyId: string;
  date: string;
  lockedBy: string;
  lockedByRole: "ADMIN" | "MANAGER";
}
