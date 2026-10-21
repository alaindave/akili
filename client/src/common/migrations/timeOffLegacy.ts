import { TimeOffStatus } from "../types/hr/time-off/TimeOff.js";

export const TIME_OFF_MIGRATION = "20261020_time_off_v1";

// Migration storage is intentionally not a TimeOff: old records cannot establish
// a policy snapshot or a valid motifId. The application must handle this explicit
// unresolved state during the later runtime cutover, without inventing payroll rules.
const statuses: Record<string, TimeOffStatus> = {
  ATTENTE_APPROBATION: TimeOffStatus.PENDING,
  APPROUVÉ: TimeOffStatus.APPROVED,
  REFUSÉ: TimeOffStatus.REJECTED,
  ANNULÉ: TimeOffStatus.CANCELLED,
  ...Object.fromEntries(Object.values(TimeOffStatus).map((status) => [status, status])),
};

export function legacyTimeOffStatus(value: unknown): TimeOffStatus {
  if (typeof value !== "string" || !Object.hasOwn(statuses, value)) {
    throw new Error(`Unsupported legacy time-off status: ${String(value)}`);
  }
  return statuses[value];
}

export function validateLegacyTimeOff(row: Record<string, unknown>): void {
  for (const key of ["companyId", "employeeId", "startDate", "endDate"]) {
    if (typeof row[key] !== "string" || !row[key].trim()) {
      throw new Error(`Legacy time off ${String(row._id)} has invalid ${key}`);
    }
  }
  if (row._id == null || row.submittedAt == null) {
    throw new Error("Legacy time off is missing its identifier or submission date");
  }
  legacyTimeOffStatus(row.status);
  if (row.serverVersion != null && (!Number.isSafeInteger(row.serverVersion) || Number(row.serverVersion) < 0)) {
    throw new Error("Invalid legacy serverVersion");
  }
  if (row.motifId != null || row.motifSnapshot != null) {
    throw new Error("Unexpected existing policy fields: review before migrating legacy time off");
  }
}
