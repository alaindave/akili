import { TimeOffStatus } from "../types/hr/time-off/TimeOff.js";

export const TIME_OFF_MIGRATION = "20261020_time_off_v1";

// Historical imports retain a nullable motif without inventing a payroll policy.
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

/** Capture the deduction used by the former Leave workflow without changing balances. */
export function historicalTimeOffBalance(row: Record<string, unknown>): number {
  if (legacyTimeOffStatus(row.status) !== TimeOffStatus.APPROVED) return Number(row.balanceDaysDeducted ?? 0);
  const startDate = String(row.startDate);
  const endDate = String(row.endDate);
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start ||
      start.toISOString().slice(0, 10) !== startDate || end.toISOString().slice(0, 10) !== endDate)
    throw new Error(`Invalid historical time-off dates for ${String(row._id)}`);
  const total = (end.getTime() - start.getTime()) / 86400000 + 1;
  let days = Math.floor(total / 7) * 5;
  for (let offset = 0; offset < total % 7; offset++) {
    const weekday = (start.getUTCDay() + offset) % 7;
    if (weekday !== 0 && weekday !== 6) days++;
  }
  return days;
}

export const timeOffRequestValidator = { $and: [
  { $jsonSchema: {
    bsonType: "object", required: ["_id", "companyId", "employeeId", "motifId", "startDate", "endDate", "submittedAt", "status"],
    properties: {
      _id: { bsonType: ["string", "objectId"] }, companyId: { bsonType: "string", minLength: 1 },
      employeeId: { bsonType: "string", minLength: 1 }, status: { enum: Object.values(TimeOffStatus) },
      motifId: { bsonType: ["string", "null"] }, motifSnapshot: { bsonType: ["object", "null"] },
    },
  } },
  { legacyNeedsReview: { $exists: false } },
  { legacyData: { $exists: false } },
] };
