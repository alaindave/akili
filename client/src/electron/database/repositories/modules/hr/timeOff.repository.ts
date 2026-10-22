import { all, get, run, transaction } from "../../../db.js";
import { randomUUID } from "crypto";
import type TimeOff from "../../../../../common/types/hr/time-off/TimeOff.js";
import type { TimeOffMotif } from "../../../../../common/types/hr/time-off/TimeOff.js";
import { addToSyncQueue } from "../../shared/sync.repository.js";
import type Employee from "../../../../../common/types/hr/employees/Employee.js";
import type { SyncQueueItem } from "../../../../../common/types/shared/Sync.js";

type StoredTimeOff = Omit<TimeOff, "motifSnapshot"> & {
  motifSnapshot?: string | null;
  supportingDocumentIds?: string | string[];
  balanceDaysDeducted?: number;
};
type StoredMotif = TimeOffMotif & {
  serverVersion: number;
  synced?: number;
  isDeleted?: number;
};
export type LocalTimeOff = Omit<TimeOff, "motifId"> & {
  motifId: string | null;
  supportingDocumentIds?: string[];
  balanceDaysDeducted?: number;
};
export type TimeOffListRow = LocalTimeOff &
  Pick<
    Employee,
    "firstName" | "lastName" | "department" | "role" | "remainingLeave"
  >;
type PulledTimeOff = Omit<TimeOff, "motifId"> & {
  motifId: string | null;
  supportingDocumentIds?: string[];
  balanceDaysDeducted?: number;
};
const json = <T>(value: T | string | null | undefined): T | undefined => {
  if (value == null) return undefined;
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
};
const motifRow = (row: Record<string, unknown>): StoredMotif =>
  ({
    ...row,
    deductFromLeaveBalance: Boolean(row.deductFromLeaveBalance),
    requiresApproval: Boolean(row.requiresApproval),
    requiresJustification: Boolean(row.requiresJustification),
    requiresSupportingDocument: Boolean(row.requiresSupportingDocument),
    isSystemDefault: Boolean(row.isSystemDefault),
    isActive: Boolean(row.isActive),
  } as StoredMotif);
const requestRow = (row: StoredTimeOff): LocalTimeOff => {
  const { motifSnapshot, supportingDocumentIds, ...fields } = row;
  return {
    ...fields,
    isPartialDay: row.isPartialDay == null ? undefined : Boolean(row.isPartialDay),
    motifSnapshot: json<TimeOff["motifSnapshot"]>(motifSnapshot),
    ...(supportingDocumentIds != null
      ? { supportingDocumentIds: json<string[]>(supportingDocumentIds) }
      : {}),
    balanceDaysDeducted: Number(row.balanceDaysDeducted ?? 0),
    synced: Number(row.synced ?? 0),
    isDeleted: Number(row.isDeleted ?? 0),
  };
};

export async function listTimeOffMotifs(
  companyId: string,
  includeDeleted = false
): Promise<StoredMotif[]> {
  const rows = await all<Record<string, unknown>>(
    `SELECT * FROM time_off_motifs WHERE companyId=? ${
      includeDeleted ? "" : "AND isDeleted=0"
    } ORDER BY label`,
    [companyId]
  );
  return rows.map(motifRow);
}
export async function saveTimeOffMotif(
  companyId: string,
  input: Omit<TimeOffMotif, "companyId"> & {
    companyId?: string;
    serverVersion?: number;
  }
) {
  if (!companyId || (input.companyId && input.companyId !== companyId))
    throw new Error("TimeOff motif company mismatch");
  const motif = {
    ...input,
    companyId,
    synced: 0,
    serverVersion: input.serverVersion ?? 0,
  } as StoredMotif & { synced: number };
  await transaction(async () => {
    const queued = await get<{ _id: string }>(
      "SELECT _id FROM sync_queue WHERE companyId=? AND entity='time_off_motif' AND entityId=? AND synced=0 LIMIT 1",
      [companyId, motif._id]
    );
    await run(
      `INSERT INTO time_off_motifs (_id,companyId,code,label,category,payrollTreatment,deductFromLeaveBalance,
      requiresApproval,requiresJustification,requiresSupportingDocument,isSystemDefault,isActive,createdAt,updatedAt,serverVersion,synced,isDeleted)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0) ON CONFLICT(companyId,_id) DO UPDATE SET code=excluded.code,label=excluded.label,
      category=excluded.category,payrollTreatment=excluded.payrollTreatment,deductFromLeaveBalance=excluded.deductFromLeaveBalance,
      requiresApproval=excluded.requiresApproval,requiresJustification=excluded.requiresJustification,
      requiresSupportingDocument=excluded.requiresSupportingDocument,isActive=excluded.isActive,updatedAt=excluded.updatedAt,synced=0`,
      [
        motif._id,
        motif.companyId,
        motif.code,
        motif.label,
        motif.category,
        motif.payrollTreatment,
        +motif.deductFromLeaveBalance,
        +motif.requiresApproval,
        +motif.requiresJustification,
        +motif.requiresSupportingDocument,
        +motif.isSystemDefault,
        +motif.isActive,
        motif.createdAt ?? new Date().toISOString(),
        motif.updatedAt ?? new Date().toISOString(),
        motif.serverVersion,
        0,
      ]
    );
    await addToSyncQueue(
      {
        companyId,
        entity: "time_off_motif",
        entityId: motif._id,
        operation: motif.serverVersion || queued ? "update" : "create",
        payload: JSON.stringify(motif),
      },
      true
    );
  });
  return motif;
}
export async function listTimeOff(
  companyId: string,
  employeeId?: string
): Promise<LocalTimeOff[]> {
  const rows = await all<StoredTimeOff>(
    `SELECT * FROM time_off WHERE companyId=? AND isDeleted=0 ${
      employeeId ? "AND employeeId=?" : ""
    } ORDER BY startDate DESC`,
    employeeId ? [companyId, employeeId] : [companyId]
  );
  return rows.map(requestRow);
}
export async function listTimeOffWithEmployees(
  companyId: string,
  employeeId?: string
): Promise<TimeOffListRow[]> {
  const rows = await all<
    StoredTimeOff &
      Pick<
        Employee,
        "firstName" | "lastName" | "department" | "role" | "remainingLeave"
      >
  >(
    `SELECT t.*, e.firstName, e.lastName, e.department, e.role, e.remainingLeave
     FROM time_off t JOIN employees e ON e.companyId=t.companyId AND e._id=t.employeeId
     WHERE t.companyId=? AND t.isDeleted=0 ${
       employeeId ? "AND t.employeeId=?" : ""
     } ORDER BY t.submittedAt DESC`,
    employeeId ? [companyId, employeeId] : [companyId]
  );
  return rows.map(requestRow) as TimeOffListRow[];
}
export async function getTimeOffMotif(
  companyId: string,
  id: string
): Promise<StoredMotif | null> {
  const row = await get<Record<string, unknown>>(
    "SELECT * FROM time_off_motifs WHERE companyId=? AND _id=? AND isDeleted=0",
    [companyId, id]
  );
  return row ? motifRow(row) : null;
}
export async function getOngoingApprovedLeaveTimeOff(
  companyId: string,
  date: string
): Promise<TimeOffListRow[]> {
  const rows = await all<
    StoredTimeOff &
      Pick<
        Employee,
        "firstName" | "lastName" | "department" | "role" | "remainingLeave"
      >
  >(
    `SELECT t.*,e.firstName,e.lastName,e.department,e.role,e.remainingLeave
     FROM time_off t JOIN employees e ON e.companyId=t.companyId AND e._id=t.employeeId
     JOIN time_off_motifs m ON m.companyId=t.companyId AND m._id=t.motifId
     WHERE t.companyId=? AND t.isDeleted=0 AND t.status='APPROVED'
       AND m.category='LEAVE' AND t.startDate<=? AND t.endDate>=? ORDER BY t.employeeId`,
    [companyId, date, date]
  );
  return rows.map(requestRow) as TimeOffListRow[];
}
export async function getTimeOff(
  companyId: string,
  id: string
): Promise<LocalTimeOff | null> {
  const row = await get<StoredTimeOff>(
    "SELECT * FROM time_off WHERE companyId=? AND _id=? AND isDeleted=0",
    [companyId, id]
  );
  return row ? requestRow(row) : null;
}
export async function createTimeOff(
  companyId: string,
  input: Omit<
    TimeOff,
    | "companyId"
    | "_id"
    | "submittedAt"
    | "createdAt"
    | "updatedAt"
    | "serverVersion"
    | "synced"
    | "isDeleted"
    | "status"
  > & { _id?: string; supportingDocumentIds?: string[] }
) {
  if (!companyId || !input.employeeId || !input.motifId)
    throw new Error("Company, employee and motif are required");
  const motif = await get<Record<string, unknown>>(
    "SELECT _id FROM time_off_motifs WHERE companyId=? AND _id=? AND isActive=1 AND isDeleted=0",
    [companyId, input.motifId]
  );
  if (!motif) throw new Error("An active company TimeOff motif is required");
  const employee = await get(
    "SELECT _id FROM employees WHERE companyId=? AND _id=?",
    [companyId, input.employeeId]
  );
  if (!employee) throw new Error("Employee does not belong to this company");
  const now = new Date().toISOString();
  const request: TimeOff = {
    ...input,
    _id: input._id ?? randomUUID(),
    companyId,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    status: "PENDING" as TimeOff["status"],
    serverVersion: 0,
    synced: 0,
    isDeleted: 0,
  };
  await transaction(async () => {
    await run(
      `INSERT INTO time_off (_id,companyId,employeeId,motifId,startDate,endDate,isPartialDay,startTime,endTime,notes,additionalNotes,
      supportingDocumentIds,balanceDaysDeducted,submittedAt,status,serverVersion,createdAt,updatedAt,synced,isDeleted)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,0,?,?,0,0)`,
      [
        request._id,
        companyId,
        request.employeeId,
        request.motifId,
        request.startDate,
        request.endDate,
        request.isPartialDay == null ? null : +request.isPartialDay,
        request.startTime ?? null,
        request.endTime ?? null,
        request.notes ?? null,
        request.additionalNotes ?? null,
        JSON.stringify(
          (input as typeof input & { supportingDocumentIds?: string[] })
            .supportingDocumentIds ?? []
        ),
        now,
        request.status,
        now,
        now,
      ]
    );
    await addToSyncQueue(
      {
        companyId,
        entity: "time_off",
        entityId: request._id,
        operation: "create",
        payload: JSON.stringify(request),
      },
      true
    );
  });
  return request;
}
export async function updateTimeOff(
  companyId: string,
  id: string,
  changes: Partial<
    Pick<
      TimeOff,
      | "startDate"
      | "endDate"
      | "isPartialDay"
      | "startTime"
      | "endTime"
      | "notes"
      | "additionalNotes"
      | "motifId"
    >
  >
) {
  const current = await getTimeOff(companyId, id);
  if (!current) throw new Error("TimeOff request not found");
  if (
    typeof changes.additionalNotes === "string" &&
    Object.keys(changes).length === 1
  ) {
    if (changes.additionalNotes.length > 10000)
      throw new Error("Les notes ne peuvent pas dépasser 10000 caractères.");
    const next = {
      ...current,
      additionalNotes: changes.additionalNotes,
      updatedAt: new Date().toISOString(),
      synced: 0,
    };
    await transaction(async () => {
      await run(
        "UPDATE time_off SET additionalNotes=?,updatedAt=?,synced=0 WHERE companyId=? AND _id=?",
        [next.additionalNotes, next.updatedAt, companyId, id]
      );
      await addToSyncQueue(
        {
          companyId,
          entity: "time_off",
          entityId: id,
          operation: "update",
          payload: JSON.stringify({
            _id: id,
            companyId,
            requestedAction: "notes",
            serverVersion: current.serverVersion,
            additionalNotes: next.additionalNotes,
          }),
        },
        true
      );
    });
    return next;
  }
  if (!changes.motifId && !current.motifId)
    throw new Error("An active TimeOff motif is required");
  if (current.status !== "PENDING")
    throw new Error("Only pending requests can be edited");
  if (changes.motifId) {
    const motif = await get<Record<string, unknown>>(
      "SELECT _id FROM time_off_motifs WHERE companyId=? AND _id=? AND isActive=1 AND isDeleted=0",
      [companyId, changes.motifId]
    );
    if (!motif) throw new Error("An active company TimeOff motif is required");
  }
  const next = {
    ...current,
    ...changes,
    updatedAt: new Date().toISOString(),
    synced: 0,
  };
  await transaction(async () => {
    await run(
      `UPDATE time_off SET motifId=?,startDate=?,endDate=?,isPartialDay=?,startTime=?,endTime=?,notes=?,additionalNotes=?,updatedAt=?,synced=0
      WHERE companyId=? AND _id=? AND status='PENDING'`,
      [
        next.motifId,
        next.startDate,
        next.endDate,
        next.isPartialDay == null ? null : +next.isPartialDay,
        next.startTime ?? null,
        next.endTime ?? null,
        next.notes ?? null,
        next.additionalNotes ?? null,
        next.updatedAt,
        companyId,
        id,
      ]
    );
    await addToSyncQueue(
      {
        companyId,
        entity: "time_off",
        entityId: id,
        operation: "update",
        payload: JSON.stringify({
          ...next,
          requestedAction: "edit",
          serverVersion: current.serverVersion,
        }),
      },
      true
    );
  });
  return next;
}
export async function transitionTimeOff(
  companyId: string,
  id: string,
  action: "approve" | "reject" | "cancel" | "delete",
  rejectionReason?: string
) {
  const current = await getTimeOff(companyId, id);
  if (!current) throw new Error("TimeOff request not found");
  if (action === "approve" && !current.motifId)
    throw new Error("An active TimeOff motif is required");
  if (
    (action === "approve" || action === "reject") &&
    current.status !== "PENDING"
  )
    throw new Error("Only pending requests can be decided");
  if (action === "cancel" && !["PENDING", "APPROVED"].includes(current.status))
    throw new Error("This request cannot be cancelled");
  if (action === "delete" && current.status === "APPROVED")
    throw new Error("Cancel an approved request before archiving it");
  if (action === "reject" && !rejectionReason?.trim())
    throw new Error("A rejection reason is required");
  const nextStatus =
    action === "approve"
      ? "APPROVED"
      : action === "reject"
      ? "REJECTED"
      : action === "cancel"
      ? "CANCELLED"
      : current.status;
  const next = {
    ...current,
    status: nextStatus as TimeOff["status"],
    rejectionReason:
      action === "reject" ? rejectionReason!.trim() : current.rejectionReason,
    isDeleted: action === "delete" ? 1 : current.isDeleted,
    updatedAt: new Date().toISOString(),
    synced: 0,
  };
  await transaction(async () => {
    await run(
      `UPDATE time_off SET status=?,rejectionReason=?,isDeleted=?,updatedAt=?,synced=0 WHERE companyId=? AND _id=?`,
      [
        next.status,
        next.rejectionReason ?? null,
        next.isDeleted,
        next.updatedAt,
        companyId,
        id,
      ]
    );
    await addToSyncQueue(
      {
        companyId,
        entity: "time_off",
        entityId: id,
        operation: action === "delete" ? "delete" : "update",
        payload: JSON.stringify({
          ...next,
          requestedAction: action,
          serverVersion: current.serverVersion,
        }),
      },
      true
    );
  });
  return next;
}

export async function markTimeOffSynced(
  companyId: string,
  entity: "time_off" | "time_off_motif",
  id: string,
  serverVersion: number
) {
  if (entity === "time_off")
    await run(
      "UPDATE time_off SET synced=1,serverVersion=?,lastSyncedAt=CURRENT_TIMESTAMP WHERE companyId=? AND _id=?",
      [serverVersion, companyId, id]
    );
  else
    await run(
      "UPDATE time_off_motifs SET synced=1,serverVersion=?,lastSyncedAt=CURRENT_TIMESTAMP WHERE companyId=? AND _id=?",
      [serverVersion, companyId, id]
    );
}

/** Persist a stable identity before sending, including queues from older clients. */
export async function prepareTimeOffMutation(item: SyncQueueItem): Promise<SyncQueueItem> {
  return transaction(async () => {
    const queued = await get<SyncQueueItem>(
      "SELECT * FROM sync_queue WHERE companyId=? AND _id=? AND synced=0",
      [item.companyId, item._id]
    );
    if (!queued) throw new Error("TimeOff queue entry is no longer pending");
    const data = JSON.parse(queued.payload);
    if (data.companyId !== item.companyId || data._id !== item.entityId)
      throw new Error("TimeOff queue identity mismatch");
    if (!data.syncMutationId) {
      data.syncMutationId = randomUUID();
      queued.payload = JSON.stringify(data);
      await run("UPDATE sync_queue SET payload=? WHERE companyId=? AND _id=? AND synced=0",
        [queued.payload, item.companyId, item._id]);
    }
    return queued;
  });
}

/** Acknowledge exactly one revision and preserve edits queued while it was in flight. */
export async function acknowledgeTimeOff(
  companyId: string,
  entity: "time_off" | "time_off_motif",
  item: SyncQueueItem,
  record: TimeOff | PulledTimeOff | StoredMotif
) {
  if (!record || record.companyId !== companyId || record._id !== item.entityId ||
      !Number.isSafeInteger(record.serverVersion) || record.serverVersion <= 0)
    throw new Error("Invalid TimeOff acknowledgement");
  await transaction(async () => {
    const sent = await get<SyncQueueItem>("SELECT * FROM sync_queue WHERE companyId=? AND _id=? AND synced=0",
      [companyId, item._id]);
    if (!sent) return;
    if (sent.payload !== item.payload) throw new Error("TimeOff queue changed during push");
    await run("UPDATE sync_queue SET synced=1 WHERE companyId=? AND _id=?", [companyId, item._id]);
    const pending = await all<SyncQueueItem>(
      "SELECT * FROM sync_queue WHERE companyId=? AND entity=? AND entityId=? AND synced=0 ORDER BY createdAt,_id",
      [companyId, entity, item.entityId]);
    if (!pending.length) {
      await upsertPulledTimeOff(companyId, entity, record);
    } else {
      const table = entity === "time_off" ? "time_off" : "time_off_motifs";
      await run(`UPDATE ${table} SET serverVersion=?,synced=0 WHERE companyId=? AND _id=?`,
        [record.serverVersion, companyId, item.entityId]);
      // Only the next unsent revision inherits this base; later ones follow its acknowledgement.
      const next = pending[0];
      const payload = JSON.parse(next.payload);
      payload.serverVersion = record.serverVersion;
      await run("UPDATE sync_queue SET payload=? WHERE companyId=? AND _id=? AND synced=0",
        [JSON.stringify(payload), companyId, next._id]);
    }
  });
}

export async function upsertPulledTimeOff(
  companyId: string,
  entity: "time_off" | "time_off_motif",
  value: TimeOff | PulledTimeOff | StoredMotif
) {
  if (value.companyId !== companyId)
    throw new Error("Pulled TimeOff record belongs to another company");
  if (entity === "time_off_motif") {
    const m = value as StoredMotif;
    await run(
      `INSERT INTO time_off_motifs (_id,companyId,code,label,category,payrollTreatment,deductFromLeaveBalance,requiresApproval,
      requiresJustification,requiresSupportingDocument,isSystemDefault,isActive,createdAt,updatedAt,serverVersion,lastSyncedAt,synced,isDeleted)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,1,?) ON CONFLICT(companyId,_id) DO UPDATE SET
      code=excluded.code,label=excluded.label,category=excluded.category,payrollTreatment=excluded.payrollTreatment,
      deductFromLeaveBalance=excluded.deductFromLeaveBalance,requiresApproval=excluded.requiresApproval,requiresJustification=excluded.requiresJustification,
      requiresSupportingDocument=excluded.requiresSupportingDocument,isSystemDefault=excluded.isSystemDefault,isActive=excluded.isActive,
      updatedAt=excluded.updatedAt,serverVersion=excluded.serverVersion,lastSyncedAt=CURRENT_TIMESTAMP,synced=1,isDeleted=excluded.isDeleted
      WHERE time_off_motifs.serverVersion<=excluded.serverVersion`,
      [
        m._id,
        companyId,
        m.code,
        m.label,
        m.category,
        m.payrollTreatment,
        +m.deductFromLeaveBalance,
        +m.requiresApproval,
        +m.requiresJustification,
        +m.requiresSupportingDocument,
        +m.isSystemDefault,
        +m.isActive,
        m.createdAt ?? null,
        m.updatedAt ?? null,
        m.serverVersion ?? 0,
        Number(m.isDeleted ?? 0),
      ]
    );
    return;
  }
  const r = value as PulledTimeOff;
  await run(
    `INSERT INTO time_off (_id,companyId,employeeId,motifId,motifSnapshot,startDate,endDate,isPartialDay,startTime,endTime,notes,
    additionalNotes,supportingDocumentIds,balanceDaysDeducted,submittedAt,status,approvedBy,approvedAt,rejectionReason,serverVersion,createdAt,updatedAt,lastSyncedAt,synced,isDeleted)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,1,?) ON CONFLICT(companyId,_id) DO UPDATE SET
    employeeId=excluded.employeeId,motifId=excluded.motifId,motifSnapshot=excluded.motifSnapshot,startDate=excluded.startDate,endDate=excluded.endDate,
    isPartialDay=excluded.isPartialDay,startTime=excluded.startTime,endTime=excluded.endTime,notes=excluded.notes,additionalNotes=excluded.additionalNotes,
    supportingDocumentIds=excluded.supportingDocumentIds,balanceDaysDeducted=excluded.balanceDaysDeducted,
    submittedAt=excluded.submittedAt,status=excluded.status,approvedBy=excluded.approvedBy,approvedAt=excluded.approvedAt,
    rejectionReason=excluded.rejectionReason,serverVersion=excluded.serverVersion,updatedAt=excluded.updatedAt,lastSyncedAt=CURRENT_TIMESTAMP,
    synced=1,isDeleted=excluded.isDeleted
    WHERE time_off.serverVersion<=excluded.serverVersion`,
    [
      r._id,
      companyId,
      r.employeeId,
      r.motifId,
      r.motifSnapshot ? JSON.stringify(r.motifSnapshot) : null,
      r.startDate,
      r.endDate,
      r.isPartialDay == null ? null : +r.isPartialDay,
      r.startTime ?? null,
      r.endTime ?? null,
      r.notes ?? null,
      r.additionalNotes ?? null,
      JSON.stringify(
        (r as TimeOff & { supportingDocumentIds?: string[] })
          .supportingDocumentIds ?? []
      ),
      Number(
        (r as TimeOff & { balanceDaysDeducted?: number }).balanceDaysDeducted ??
          0
      ),
      r.submittedAt,
      r.status,
      r.approvedBy ?? null,
      r.approvedAt ?? null,
      r.rejectionReason ?? null,
      r.serverVersion,
      r.createdAt ?? null,
      r.updatedAt ?? null,
      +r.isDeleted,
    ]
  );
}
