import { invoke } from "../../ipc/ipc.cjs";
type TimeOff = import("../../../common/types/hr/time-off/TimeOff", { with: { "resolution-mode": "require" } }).default;
type TimeOffMotif = import("../../../common/types/hr/time-off/TimeOff", { with: { "resolution-mode": "require" } }).TimeOffMotif;
type LocalTimeOff = Omit<TimeOff, "motifId"> & { motifId: string | null; legacyNeedsReview: boolean; legacyData?: unknown; supportingDocumentIds?: string[]; balanceDaysDeducted?: number; firstName?: string; lastName?: string; department?: string; role?: string; remainingLeave?: number };
type NewTimeOff = Omit<TimeOff, "companyId" | "_id" | "submittedAt" | "createdAt" | "updatedAt" | "serverVersion" | "synced" | "isDeleted" | "status"> & { _id?: string; supportingDocumentIds?: string[] };
type TimeOffChanges = Partial<Pick<TimeOff, "startDate" | "endDate" | "isPartialDay" | "startTime" | "endTime" | "notes" | "additionalNotes" | "motifId">>;
type TimeOffAction = "approve" | "reject" | "cancel" | "delete";

export const timeOffApi = {
  list: (companyId: string, employeeId?: string) => invoke<LocalTimeOff[]>("time-off:list", companyId, employeeId),
  get: (companyId: string, id: string) => invoke<LocalTimeOff | null>("time-off:get", companyId, id),
  create: (companyId: string, input: NewTimeOff) => invoke<TimeOff>("time-off:create", companyId, input),
  update: (companyId: string, id: string, changes: TimeOffChanges) => invoke<LocalTimeOff>("time-off:update", companyId, id, changes),
  transition: (companyId: string, id: string, action: TimeOffAction, reason?: string) => invoke<LocalTimeOff>("time-off:transition", companyId, id, action, reason),
  reviewLegacy: (companyId: string, id: string, motifId: string, notes?: string) => invoke<LocalTimeOff>("time-off:review-legacy", companyId, id, motifId, notes),
  motifs: {
    list: (companyId: string) => invoke<TimeOffMotif[]>("time-off:motifs:list", companyId),
    save: (companyId: string, input: Omit<TimeOffMotif, "companyId"> & { companyId?: string; serverVersion?: number }) => invoke<TimeOffMotif>("time-off:motifs:save", companyId, input),
    deactivate: (companyId: string, id: string) => invoke<TimeOffMotif>("time-off:motifs:deactivate", companyId, id),
  },
};
