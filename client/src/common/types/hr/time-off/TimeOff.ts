/**
 * Akili ERP — Time Off Types
 * Shared contracts for configurable employee time off,
 * including leave, absences, and exit permissions.
 */

export enum TimeOffCategory {
  LEAVE = "LEAVE",
  ABSENCE = "ABSENCE",
  EXIT_PERMISSION = "EXIT_PERMISSION",
}

export enum PayrollTreatment {
  PAID = "PAID",
  UNPAID = "UNPAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
}

export enum TimeOffStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

/**
 * Company-configurable reason for time off.
 *
 * The motif configuration is separate from individual
 * time-off requests so companies can manage their policies.
 */
export interface TimeOffMotif {
  _id: string;
  companyId: string;
  code: string;
  label: string;
  category: TimeOffCategory;
  payrollTreatment: PayrollTreatment;
  deductFromLeaveBalance: boolean;
  requiresApproval: boolean;
  requiresJustification: boolean;
  requiresSupportingDocument: boolean;
  isSystemDefault: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Historical snapshot of the motif policy applied
 * when a time-off request is approved.
 */
export interface TimeOffMotifSnapshot {
  code: string;
  label: string;
  category: TimeOffCategory;
  payrollTreatment: PayrollTreatment;
  deductFromLeaveBalance: boolean;
}

/**
 * Employee time-off request or recorded time-off event.
 */
export default interface TimeOff {
  companyId: string;
  _id: string;
  employeeId: string;
  motifId: string;
  motifSnapshot?: TimeOffMotifSnapshot;
  startDate: string;
  endDate: string;
  isPartialDay?: boolean;
  startTime?: string;
  endTime?: string;
  notes?: string;
  additionalNotes?: string;
  submittedAt: string;
  submittedMonth: string;
  status: TimeOffStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  serverVersion: number;
  createdAt?: string;
  updatedAt?: string;
  lastSyncedAt?: string;
  synced: number;
  isDeleted: number;
}

export interface TimeOffWithEmployee extends TimeOff {
  firstName: string;
  lastName: string;
  employeeId: string;
  remainingLeave: number;
  role: string;
  department: string;
}
