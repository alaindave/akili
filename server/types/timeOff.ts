import type { Types } from "mongoose";
import type TimeOff from "../../client/src/common/types/hr/time-off/TimeOff.js";
import type { TimeOffMotif } from "../../client/src/common/types/hr/time-off/TimeOff.js";
export { TimeOffCategory, PayrollTreatment, TimeOffStatus } from "../../client/src/common/types/hr/time-off/TimeOff.js";
export type { TimeOff, TimeOffMotif };
export type { TimeOffMotifSnapshot } from "../../client/src/common/types/hr/time-off/TimeOff.js";

type StoredDates = { createdAt?: Date; updatedAt?: Date; lastSyncedAt?: Date };
export type TimeOffRecord = Omit<TimeOff, "_id" | "motifId" | "submittedAt" | "approvedAt" | keyof StoredDates> & StoredDates & {
  _id: string | Types.ObjectId;
  motifId: string | null;
  submittedAt: Date;
  approvedAt?: Date;
  // Explicit Stage 1 persistence envelope; never accepted as a new request.
  legacyNeedsReview?: boolean;
  legacyData?: Record<string, unknown>;
  migrationVersion?: string;
  supportingDocumentIds?: string[];
  balanceDaysDeducted?: number;
};
export type TimeOffMotifRecord = Omit<TimeOffMotif, "createdAt" | "updatedAt"> & StoredDates & {
  serverVersion: number;
  synced: number;
  isDeleted: number;
};
export type MotifFields = Pick<TimeOffMotif, "code" | "label" | "category" | "payrollTreatment" |
  "deductFromLeaveBalance" | "requiresApproval" | "requiresJustification" | "requiresSupportingDocument" | "isActive">;
export type CreateMotif = MotifFields & { _id?: string };
export type EditMotif = Partial<MotifFields> & { serverVersion: number };
export type RequestFields = Pick<TimeOff, "motifId" | "startDate" | "endDate"> &
  Partial<Pick<TimeOff, "isPartialDay" | "startTime" | "endTime" | "notes" | "additionalNotes">> & {
    supportingDocumentIds?: string[];
  };
export type CreateTimeOff = RequestFields & { _id?: string; employeeId: string };
export type EditTimeOff = Partial<RequestFields> & { serverVersion: number };
