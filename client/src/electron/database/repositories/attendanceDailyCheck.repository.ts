import { randomUUID } from "crypto";
import { all, get, run } from "../db.js";
import {
  AttendanceDailyCheck,
  AttendanceDailyCheckPreparationInput,
  AttendanceDailyCheckStatus,
  LockAttendanceDailyCheckInput,
  MarkManagerNotifiedInput,
  VerifyAttendanceDailyCheckInput,
} from "../../../common/types/attendance/AttendanceDailyCheck.js";
import { addToSyncQueue } from "./sync.repository.js";
import { markEmployeesAbsent } from "../../services/attendance/markEmployeesAbsent.service.js";
import { markEmployeesOnLeave } from "../../services/attendance/markEmployeesOnLeave.service.js";

const now = () => new Date().toISOString();

export async function createAttendanceDailyCheck(
  input: AttendanceDailyCheckPreparationInput
): Promise<AttendanceDailyCheck> {
  if (!input.markLeaveCompleted.completed) {
    throw new Error(
      "ATTENDANCE DAILY CHECK CANNOT BE CREATED BEFORE EMPLOYEES ON LEAVE HAVE BEEN PROCESSED."
    );
  }

  console.log("CREATING ATTENDANCE DAILY CHECK NOW FOR DATE:", input.date);
  const date = input.date;
  const existing = await get<AttendanceDailyCheck>(
    `
      SELECT *
      FROM attendance_daily_checks
      WHERE date = ?
        AND companyId=?
        AND isDeleted = 0
    `,
    [input.companyId, date]
  );

  if (existing) {
    console.log("EXISTING ATTENDANCE DAILY CHECK: ", existing);

    return existing;
  }
  const _id = randomUUID();
  const timestamp = now();

  await run(
    `
      INSERT INTO attendance_daily_checks (
       companyId,
        _id,
        date,
        status,
        markAbsentCompleted,
        markAbsentCompletedAt,
        markLeaveCompleted,
        markLeaveCompletedAt,
        verifiedAt,
        verifiedBy,
        managerNotifiedAt,
        managerNotifiedTo,
        lockedAt,
        lockedBy,
        synced,
        isDeleted,
        createdAt,
        updatedAt
      )
      VALUES (
        ?,
        ?,
        ?,
        'PREPARING',
        ?,
        ?,
        ?,
        ?,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        0,
        0,
        ?,
        ?
      )
    `,
    [
      input.companyId,
      _id,
      date,
      input.markAbsentCompleted.completed ? 1 : 0,
      input.markAbsentCompleted.completedAt,
      input.markLeaveCompleted.completed ? 1 : 0,
      input.markLeaveCompleted.completedAt,
      timestamp,
      timestamp,
    ]
  );

  const record = await getAttendanceDailyCheckById(input.companyId, _id);

  if (!record) {
    throw new Error("FAILED TO CREATE ATTENDANCE CHECK");
  }

  await addToSyncQueue({
    companyId: input.companyId,
    entity: "attendance_daily_check",
    entityId: _id,
    operation: "create",
    payload: JSON.stringify(record),
  });

  return record;
}

export async function upsertAttendanceDailyCheck(
  dailyCheck: AttendanceDailyCheck
): Promise<AttendanceDailyCheck> {
  // First try to find the record by its ID
  let local = await get<AttendanceDailyCheck>(
    `
      SELECT *
      FROM attendance_daily_checks
      WHERE _id = ?
        AND companyId=?
    `,
    [dailyCheck._id, dailyCheck.companyId]
  );

  // If the ID doesn't exist locally, try the business key.
  // There can only be one daily check for a given date.
  if (!local) {
    local = await get<AttendanceDailyCheck>(
      `
        SELECT *
        FROM attendance_daily_checks
        WHERE date = ?
          AND companyId=?
      `,
      [dailyCheck.date, dailyCheck.companyId]
    );
  }

  // If we already have a local record, use the timestamp
  // to prevent an older server record from overwriting
  // a newer local record.
  if (local && local.updatedAt && dailyCheck.updatedAt) {
    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(dailyCheck.updatedAt).getTime();

    if (remoteTime < localTime) {
      console.log(
        `SKIPPING REMOTE ATTENDANCE DAILY CHECK. LOCAL IS NEWER: ${dailyCheck._id}`
      );

      return local;
    }
  }

  // Existing local record
  if (local) {
    await run(
      `
        UPDATE attendance_daily_checks
        SET
          date = ?,
          status = ?,
          serverVersion=?,
          markAbsentCompleted = ?,
          markAbsentCompletedAt = ?,
          markLeaveCompleted = ?,
          markLeaveCompletedAt = ?,
          totalEmployees = ?,
          verifiedEmployees = ?,
          verifiedAt = ?,
          verifiedBy = ?,
          managerId = ?,
          managerNotifiedAt = ?,
          managerNotifiedTo = ?,
          lockedAt = ?,
          lockedBy = ?,
          createdAt = ?,
          updatedAt = ?,
          synced = 1,
          lastSyncedAt = CURRENT_TIMESTAMP,
          isDeleted = ?
        WHERE _id = ?
          AND companyId=?
      `,
      [
        dailyCheck.date,
        dailyCheck.status,
        dailyCheck.serverVersion,
        dailyCheck.markAbsentCompleted ? 1 : 0,
        dailyCheck.markAbsentCompletedAt ?? null,
        dailyCheck.markLeaveCompleted ? 1 : 0,
        dailyCheck.markLeaveCompletedAt ?? null,
        dailyCheck.totalEmployees ?? 0,
        dailyCheck.verifiedEmployees ?? 0,
        dailyCheck.verifiedAt ?? null,
        dailyCheck.verifiedBy ?? null,
        dailyCheck.managerId ?? null,
        dailyCheck.managerNotifiedAt ?? null,
        dailyCheck.managerNotifiedTo ?? null,
        dailyCheck.lockedAt ?? null,
        dailyCheck.lockedBy ?? null,
        dailyCheck.createdAt,
        dailyCheck.updatedAt,
        dailyCheck.isDeleted ? 1 : 0,
        local._id,
        local.companyId,
      ]
    );

    const updated = await getAttendanceDailyCheckById(
      local.companyId,
      local._id
    );

    if (!updated) {
      throw new Error(
        `FAILED TO RETRIEVE UPSERTED ATTENDANCE DAILY CHECK: ${dailyCheck._id}`
      );
    }

    return updated;
  }

  // No local record exists, so create it.
  await run(
    `
      INSERT INTO attendance_daily_checks (
        companyId,
        _id,
        date,
        status,
        markAbsentCompleted,
        markAbsentCompletedAt,
        markLeaveCompleted,
        markLeaveCompletedAt,
        totalEmployees,
        verifiedEmployees,
        verifiedAt,
        verifiedBy,
        managerId,
        managerNotifiedAt,
        managerNotifiedTo,
        lockedAt,
        lockedBy,
        createdAt,
        updatedAt,
        synced,
        lastSyncedAt,
        isDeleted
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        1,
        CURRENT_TIMESTAMP,
        ?
      )
    `,
    [
      dailyCheck.companyId,
      dailyCheck._id,
      dailyCheck.date,
      dailyCheck.status,
      dailyCheck.markAbsentCompleted ? 1 : 0,
      dailyCheck.markAbsentCompletedAt ?? null,
      dailyCheck.markLeaveCompleted ? 1 : 0,
      dailyCheck.markLeaveCompletedAt ?? null,
      dailyCheck.totalEmployees ?? 0,
      dailyCheck.verifiedEmployees ?? 0,
      dailyCheck.verifiedAt ?? null,
      dailyCheck.verifiedBy ?? null,
      dailyCheck.managerId ?? null,
      dailyCheck.managerNotifiedAt ?? null,
      dailyCheck.managerNotifiedTo ?? null,
      dailyCheck.lockedAt ?? null,
      dailyCheck.lockedBy ?? null,
      dailyCheck.createdAt,
      dailyCheck.updatedAt,
      dailyCheck.isDeleted ? 1 : 0,
    ]
  );

  const created = await getAttendanceDailyCheckById(
    dailyCheck.companyId,
    dailyCheck._id
  );

  if (!created) {
    throw new Error(
      `FAILED TO CREATE PULLED ATTENDANCE DAILY CHECK: ${dailyCheck._id}`
    );
  }

  return created;
}

export async function completeMarkAbsent(
  companyId: string,
  completedAt: string,
  date: string = new Date().toISOString().split("T")[0]
): Promise<AttendanceDailyCheck> {
  const existing = await get<AttendanceDailyCheck>(
    `
      SELECT *
      FROM attendance_daily_checks
      WHERE date = ?
        AND isDeleted = 0
        AND companyId=?
    `,
    [date, companyId]
  );

  console.log(`ATTENDANCE CHECK FOR companyId ${companyId} `, existing);

  if (!existing) {
    throw new Error(
      "L'enregistrement des employés en congé doit être effectué en premier."
    );
  }

  await run(
    `
      UPDATE attendance_daily_checks
      SET
        status= 'OPEN',
        markAbsentCompleted = 1,
        markAbsentCompletedAt = ?,
        updatedAt = ?,
        synced = 0
      WHERE _id = ?
        AND companyId=?
        AND isDeleted = 0
    `,
    [completedAt, now(), existing._id, existing.companyId]
  );

  const record = await getAttendanceDailyCheckById(
    existing.companyId,
    existing._id
  );

  if (!record) {
    throw new Error("FAILED TO UPDATE ATTENDANCE DAILY CHECK");
  }

  await addToSyncQueue({
    companyId: existing.companyId,
    entity: "attendance_daily_check",
    entityId: existing._id,
    operation: "update",
    payload: JSON.stringify(record),
  });

  return record;
}

export async function prepareDailyAttendance(companyId: string, date: string) {
  const markAbsentResult = await markEmployeesAbsent(companyId, date);
  const markLeaveResult = await markEmployeesOnLeave(companyId);

  if (markAbsentResult?.completed && markLeaveResult.completed) {
    return createAttendanceDailyCheck({
      companyId,
      markAbsentCompleted: {
        completed: true,
        completedAt: markAbsentResult.timestamp,
      },
      markLeaveCompleted: {
        completed: true,
        completedAt: markLeaveResult.completedAt,
      },
      date,
    });
  }
  return;
}

export async function getAttendanceDailyCheckById(
  companyId: string,
  _id: string
): Promise<AttendanceDailyCheck | null> {
  return get<AttendanceDailyCheck>(
    `
      SELECT *
      FROM attendance_daily_checks
      WHERE _id = ?
        AND companyId=?
        AND isDeleted = 0
    `,
    [_id, companyId]
  );
}

export async function getAttendanceDailyCheckByDate(
  companyId: string,
  date: string
): Promise<AttendanceDailyCheck | null> {
  return get<AttendanceDailyCheck | null>(
    `
      SELECT *
      FROM attendance_daily_checks
      WHERE date = ?
        AND companyId=?
        AND isDeleted = 0
    `,
    [date, companyId]
  );
}

export async function getAttendanceDailyCheck(
  companyId: string,
  date: string
): Promise<AttendanceDailyCheck | null> {
  const existing = await getAttendanceDailyCheckByDate(companyId, date);

  if (!existing) {
    return null;
  }

  return existing;
}

export async function getAllAttendanceDailyChecks(): Promise<
  AttendanceDailyCheck[]
> {
  return all<AttendanceDailyCheck>(
    `
      SELECT *
      FROM attendance_daily_checks
      WHERE isDeleted = 0
      ORDER BY date DESC
    `
  );
}

export async function verifyAttendanceDailyCheck(
  input: VerifyAttendanceDailyCheckInput
): Promise<AttendanceDailyCheck> {
  const existing = await getAttendanceDailyCheckByDate(
    input.companyId,
    input.date
  );

  if (!existing) {
    throw new Error(`ATTENDANCE DAILY CHECK DOES NOT EXIST FOR ${input.date}`);
  }

  if (existing.status === "LOCKED") {
    throw new Error(`ATTENDANCE FOR ${input.date} IS ALREADY LOCKED`);
  }

  const timestamp = now();

  await run(
    `
      UPDATE attendance_daily_checks
      SET
        status = 'VERIFIED',
        verifiedAt = ?,
        verifiedBy = ?,
        updatedAt = ?,
        synced = 0
      WHERE _id = ?
        AND isDeleted = 0
        AND status = 'OPEN'
    `,
    [timestamp, input.verifiedBy, timestamp, existing._id]
  );

  const updated = await getAttendanceDailyCheckById(
    existing.companyId,
    existing._id
  );

  if (!updated) {
    throw new Error("FAILED TO VERIFY ATTENDANCE DAILY CHECK.");
  }

  await addToSyncQueue({
    companyId: existing.companyId,
    entity: "attendance_daily_check",
    entityId: existing._id,
    operation: "update",
    payload: JSON.stringify(updated),
  });

  return updated;
}

export async function markAttendanceManagerNotified(
  input: MarkManagerNotifiedInput
): Promise<AttendanceDailyCheck> {
  console.log("NOTIFY MANAGER INPUT", input);
  const existing = await getAttendanceDailyCheckByDate(
    input.companyId,
    input.date
  );

  if (!existing) {
    throw new Error(`ATTENDANCE DAILY CHECK DOES NOT EXIST FOR ${input.date}`);
  }

  if (existing.status === "OPEN") {
    throw new Error("ATTENDANCE MUST BE VERIFIED BEFORE NOTIFYING THE MANAGER");
  }

  if (existing.status === "LOCKED") {
    throw new Error(`ATTENDANCE FOR  ${input.date} IS ALREADY LOCKED`);
  }

  const timestamp = now();

  await run(
    `
      UPDATE attendance_daily_checks
      SET
        status= 'MANAGER_NOTIFIED',
        managerNotifiedAt = ?,
        updatedAt = ?,
        synced = 0
      WHERE _id = ?
        AND isDeleted = 0
    `,
    [timestamp, timestamp, existing._id]
  );

  const updated = await getAttendanceDailyCheckById(
    existing.companyId,
    existing._id
  );

  if (!updated) {
    throw new Error("FAILED TO UPDATE MANAGER NOTIFICATION STATUS");
  }

  await addToSyncQueue({
    companyId: existing.companyId,
    entity: "attendance_daily_check",
    entityId: existing._id,
    operation: "update",
    payload: JSON.stringify(updated),
  });

  return updated;
}

export async function lockAttendanceDailyCheck(
  input: LockAttendanceDailyCheckInput
): Promise<AttendanceDailyCheck> {
  const existing = await getAttendanceDailyCheckByDate(
    input.companyId,
    input.date
  );

  if (!existing) {
    throw new Error(`ATTENDANCE DAILY CHECK DOES NOT EXISTS FOR ${input.date}`);
  }

  if (existing.status === "LOCKED") {
    return existing;
  }

  if (
    existing.status !== "MANAGER_NOTIFIED" &&
    input.lockedByRole !== "MANAGER"
  ) {
    throw new Error(
      "Le gestionnaire doit être notifié avant de verouillé la liste de présence. "
    );
  }

  if (!existing.managerNotifiedAt && input.lockedByRole !== "MANAGER") {
    throw new Error(
      "La liste de présence ne peut pas être verouillé avant d'avoir notifié le gestionnaire. "
    );
  }

  const timestamp = now();

  await run(
    `
      UPDATE attendance_daily_checks
      SET
        status = 'LOCKED',
        lockedAt = ?,
        lockedBy = ?,
        updatedAt = ?,
        synced = 0
      WHERE _id = ?
        AND isDeleted = 0
    `,
    [timestamp, input.lockedBy, timestamp, existing._id]
  );

  const updated = await getAttendanceDailyCheckById(
    existing.companyId,
    existing._id
  );

  if (!updated) {
    throw new Error(
      "Impossible de verrouiller la présence.Une erreur est survenue."
    );
  }

  await addToSyncQueue({
    companyId: existing.companyId,
    entity: "attendance_daily_check",
    entityId: existing._id,
    operation: "update",
    payload: JSON.stringify(updated),
  });

  return updated;
}

export async function isAttendanceDateLocked(date: string): Promise<boolean> {
  const record = await get<{
    status: AttendanceDailyCheckStatus;
  }>(
    `
      SELECT status
      FROM attendance_daily_checks
      WHERE date = ?
        AND isDeleted = 0
    `,
    [date]
  );

  return record?.status === "LOCKED";
}

export async function markAttendanceDailyCheckSynced(
  companyId: string,
  _id: string
) {
  await run(
    `
    UPDATE attendance_daily_checks
    SET
      synced = 1,
      lastSyncedAt = CURRENT_TIMESTAMP
    WHERE _id = ?
      AND companyId=?
    `,
    [_id, companyId]
  );
}
