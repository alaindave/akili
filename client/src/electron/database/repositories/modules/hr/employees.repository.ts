import { updatePayrollAccountInTransaction } from "./payrollAccount.repository.js";
import {
  run,
  get,
  all,
  runDirect,
  getDirect,
  transaction,
} from "../../../db.js";
import { randomUUID } from "crypto";
import { SyncQueueItem } from "../../../../../common/types/shared/Sync.js";
import Employee from "../../../../../common/types/hr/employees/Employee.js";
import {
  addToSyncQueue,
  notifyPendingChanges,
} from "../../shared/sync.repository.js";
import { initializeEmployeePayrollProfilesForEmployee } from "../../../../services/modules/hr/payroll/payrollProfile.service.js";

/*
 * ============================================================
 * CREATE EMPLOYEE
 * ============================================================
 */
export async function createEmployee(
  companyId: string,
  employee: Omit<
    Employee,
    | "_id"
    | "companyId"
    | "synced"
    | "isDeleted"
    | "createdAt"
    | "updatedAt"
    | "lastSyncedAt"
    | "serverVersion"
  >
) {
  return transaction(async () => {
  const _id = randomUUID();
  const time = new Date().toISOString();

  const serverVersion = 0;

  await run(
    `
    INSERT INTO employees (
      companyId,
      _id,
      firstName,
      lastName,
      matricule,
      idNum,
      accountNumber,
      dateBirth,
      role,
      dateHired,
      department,
      telephone,
      address,
      emergencyContact,
      relationship,
      contactPhone,
      salary,
      status,
      remainingLeave,
      createdAt,
      updatedAt,
      serverVersion,
      synced,
      isDeleted
    )
    VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
      ?,?,?,0,0
    )
    `,
    [
      companyId,
      _id,
      employee.firstName,
      employee.lastName,
      employee.matricule,
      employee.idNum,
      employee.accountNumber?.trim() || "cash",
      employee.dateBirth,
      employee.role,
      employee.dateHired,
      employee.department,
      employee.telephone,
      employee.address,
      employee.emergencyContact,
      employee.relationship,
      employee.contactPhone,
      employee.salary,
      employee.status ?? "ACTIF",
      employee.remainingLeave ?? 20,
      time,
      time,
      serverVersion,
    ]
  );

  await initializeEmployeePayrollProfilesForEmployee(companyId, _id);

  const savedEmployee: Employee = {
    _id,
    companyId,
    ...employee,
    accountNumber: employee.accountNumber?.trim() || "cash",
    createdAt: time,
    updatedAt: time,
    serverVersion,
    synced: 0,
    isDeleted: 0,
    lastSyncedAt: null,
  };

  console.log("EMPLOYEE TO SAVE TO SYNC QUEUE:", savedEmployee);

  await addToSyncQueue({
    companyId,
    entity: "employee",
    entityId: _id,
    operation: "create",
    payload: JSON.stringify(savedEmployee),
  });

  return getEmployeeById(companyId, _id);
  });
}

/*
 * ============================================================
 * GET EMPLOYEE BY ID
 * ============================================================
 */
export function getEmployeeById(companyId: string, _id: string) {
  return get<Employee>(
    `
    SELECT *
    FROM employees
    WHERE companyId = ?
      AND _id = ?
      AND isDeleted = 0
    `,
    [companyId, _id]
  );
}

/*
 * ============================================================
 * GET EMPLOYEE BY EMPLOYEE ID / MATRICULE
 * ============================================================
 */
export function getEmployeeByEmployeeID(companyId: string, employeeID: string) {
  return get<Employee>(
    `
    SELECT *
    FROM employees
    WHERE companyId = ?
      AND matricule = ?
      AND isDeleted = 0
    `,
    [companyId, employeeID]
  );
}

/*
 * ============================================================
 * GET ALL EMPLOYEES
 * ============================================================
 */
export function getAllEmployees(companyId: string) {
  return all<Employee>(
    `
    SELECT *
    FROM employees
    WHERE companyId = ?
      AND isDeleted = 0
    ORDER BY lastName ASC
    `,
    [companyId]
  );
}

/*
 * ============================================================
 * SEARCH EMPLOYEES
 * ============================================================
 */
export function searchEmployees(companyId: string, searchTerm: string) {
  const search = `%${searchTerm}%`;

  return all<Employee>(
    `
    SELECT *
    FROM employees
    WHERE companyId = ?
      AND isDeleted = 0
      AND (
        firstName LIKE ?
        OR lastName LIKE ?
        OR matricule LIKE ?
      )
    ORDER BY lastName ASC
    `,
    [companyId, search, search, search]
  );
}

/*
 * ============================================================
 * UPDATE EMPLOYEE
 * ============================================================
 */
export async function updateEmployee(
  companyId: string,
  _id: string,
  data: Partial<Omit<Employee, "companyId">>
) {
  return transaction(async () => {
  const result = await transaction(async () => {
    const existing = await getDirect<Employee>(
      "SELECT * FROM employees WHERE companyId = ? AND _id = ?",
      [companyId, _id]
    );

    if (!existing) {
      throw new Error("Employee not found");
    }

    const updatedAt = new Date().toISOString();

    /*
     * Keep the existing serverVersion.
     */
    const serverVersion = existing.serverVersion ?? 0;

    await runDirect(
      `
      UPDATE employees
      SET
        firstName = ?,
        lastName = ?,
        matricule = ?,
        idNum = ?,
        accountNumber = ?,
        dateBirth = ?,
        role = ?,
        dateHired = ?,
        department = ?,
        telephone = ?,
        address = ?,
        emergencyContact = ?,
        relationship = ?,
        contactPhone = ?,
        salary = ?,
        status = ?,
        remainingLeave = ?,
        updatedAt = ?,
        serverVersion = ?,
        synced = 0
      WHERE companyId = ?
        AND _id = ?
      `,
      [
        data.firstName ?? existing.firstName,
        data.lastName ?? existing.lastName,
        data.matricule ?? existing.matricule,
        data.idNum ?? existing.idNum,
        (data.accountNumber === undefined
          ? existing.accountNumber
          : data.accountNumber
        )?.trim() || "cash",
        data.dateBirth ?? existing.dateBirth,
        data.role ?? existing.role,
        data.dateHired ?? existing.dateHired,
        data.department ?? existing.department,
        data.telephone ?? existing.telephone,
        data.address ?? existing.address,
        data.emergencyContact ?? existing.emergencyContact,
        data.relationship ?? existing.relationship,
        data.contactPhone ?? existing.contactPhone,
        data.salary ?? existing.salary,
        data.status ?? existing.status,
        data.remainingLeave ?? existing.remainingLeave,
        updatedAt,
        serverVersion,
        companyId,
        _id,
      ]
    );

    const updatedEmployee = await getDirect<Employee>(
      "SELECT * FROM employees WHERE companyId = ? AND _id = ?",
      [companyId, _id]
    );

    if (!updatedEmployee) {
      throw new Error("Failed to retrieve updated employee");
    }

    console.log("EMPLOYEE TO SAVE TO SYNC QUEUE:", updatedEmployee);

    await addToSyncQueue(
      {
        companyId,
        entity: "employee",
        entityId: _id,
        operation: "update",
        payload: JSON.stringify(updatedEmployee),
      },
      true
    );

    if (data.accountNumber !== undefined) {
      await updatePayrollAccountInTransaction(
        companyId,
        _id,
        updatedEmployee.accountNumber || "cash",
        updatedAt
      );
    }

    return updatedEmployee;
  });
  await notifyPendingChanges(companyId);
  return result;
  });
}

/*
 * ============================================================
 * DELETE EMPLOYEE
 * ============================================================
 */
export async function deleteEmployee(companyId: string, _id: string) {
  return transaction(async () => {
  const existing = await getEmployeeByIdIncludingDeleted(companyId, _id);

  if (!existing) {
    throw new Error("Employee not found");
  }

  const updatedAt = new Date().toISOString();

  await run(
    `
    UPDATE employees
    SET
      isDeleted = 1,
      synced = 0,
      updatedAt = ?,
      serverVersion = ?
    WHERE companyId = ?
      AND _id = ?
    `,
    [updatedAt, existing.serverVersion ?? 0, companyId, _id]
  );

  /*
   * Find payroll profiles belonging to this employee.
   */
  const payrollProfiles = await all<{ _id: string }>(
    `
    SELECT _id
    FROM payroll_employee_profiles
    WHERE companyId = ?
      AND employeeId = ?
      AND isDeleted = 0
    `,
    [companyId, _id]
  );

  /*
   * Soft-delete payroll profiles.
   */
  for (const profile of payrollProfiles) {
    await run(
      `
      UPDATE payroll_employee_profiles
      SET
        isDeleted = 1,
        enabled = 0,
        synced = 0,
        updatedAt = ?
      WHERE companyId = ?
        AND _id = ?
      `,
      [updatedAt, companyId, profile._id]
    );

    await addToSyncQueue({
      companyId,
      entity: "payroll_profile",
      entityId: profile._id,
      operation: "delete",
      payload: JSON.stringify({
        _id: profile._id,
        companyId,
        employeeId: _id,
        updatedAt,
      }),
    });
  }

  /*
   * Queue the complete employee deletion payload.
   */
  const deletedEmployee = await getEmployeeByIdIncludingDeleted(companyId, _id);

  await addToSyncQueue({
    companyId,
    entity: "employee",
    entityId: _id,
    operation: "delete",
    payload: JSON.stringify(deletedEmployee),
  });

  console.log("EMPLOYEE AND PAYROLL PROFILE DELETION QUEUED", {
    employeeId: _id,
    companyId,
    payrollProfilesDeleted: payrollProfiles.length,
    updatedAt,
    serverVersion: existing.serverVersion ?? 0,
  });
  });
}

/*
 * ============================================================
 * GET UNSYNCED EMPLOYEES
 * ============================================================
 */
export function getUnsyncedEmployees(companyId: string) {
  return all<Employee>(
    `
    SELECT *
    FROM employees
    WHERE companyId = ?
      AND synced = 0
    ORDER BY serverVersion ASC
    `,
    [companyId]
  );
}

/*
 * ============================================================
 * UPSERT EMPLOYEE FROM SERVER
 * ============================================================
 */
export async function upsertEmployee(employee: Employee) {
  return transaction(async () => {
  if (!employee.companyId) {
    throw new Error(
      `Cannot upsert employee ${employee._id}: companyId is missing`
    );
  }

  const companyId = employee.companyId;

  const local = await getEmployeeByIdIncludingDeleted(companyId, employee._id);

  const incomingVersion = Number(employee.serverVersion ?? 0);

  const localVersion = Number(local?.serverVersion ?? 0);

  /*
   * ==========================================================
   * CASE 1: Local employee does not exist
   * ==========================================================
   */
  if (!local) {
    await run(
      `
      INSERT INTO employees (
        companyId,
        _id,
        firstName,
        lastName,
        matricule,
        idNum,
        accountNumber,
        dateBirth,
        dateHired,
        role,
        department,
        salary,
        remainingLeave,
        status,
        telephone,
        address,
        emergencyContact,
        relationship,
        contactPhone,
        serverVersion,       
        createdAt,
        updatedAt,
        synced,
        lastSyncedAt,
        isDeleted
      )
      VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
        ?,?,?,?,?,?
      )
      `,
      [
        companyId,
        employee._id,
        employee.firstName,
        employee.lastName,
        employee.matricule,
        employee.idNum,
        employee.accountNumber?.trim() || "cash",
        employee.dateBirth,
        employee.dateHired,
        employee.role,
        employee.department,
        employee.salary,
        employee.remainingLeave,
        employee.status,
        employee.telephone,
        employee.address,
        employee.emergencyContact,
        employee.relationship,
        employee.contactPhone,
        incomingVersion,
        employee.createdAt,
        employee.updatedAt,
        1,
        new Date().toISOString(),
        employee.isDeleted ?? 0,
      ]
    );

    console.log(
      `INSERTED EMPLOYEE FROM SERVER: ${employee._id} ` +
        `(company ${companyId}, v${incomingVersion})`
    );

    return;
  }

  /*
   * ==========================================================
   * CASE 2: Local employee has unsynced changes
   * ==========================================================
   */
  if (local.synced === 0) {
    const pending = await get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM sync_queue WHERE companyId = ?
       AND entity = 'employee' AND entityId = ? AND synced = 0`,
      [companyId, employee._id]
    );
    const acknowledged = await get<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE companyId = ? AND entity = 'employee'
       AND entityId = ? AND synced = 1 ORDER BY _id DESC LIMIT 1`,
      [companyId, employee._id]
    );
    const accepted = acknowledged ? JSON.parse(acknowledged.payload) as Employee : undefined;
    // A dirty flag alone is not proof of a pending edit. Repair it only when
    // the complete local employee still matches the latest accepted snapshot.
    const fields = ["companyId", "_id", "firstName", "lastName", "matricule",
      "idNum", "accountNumber", "dateBirth", "dateHired", "role", "department",
      "salary", "remainingLeave", "status", "telephone", "address",
      "emergencyContact", "relationship", "contactPhone", "createdAt",
      "updatedAt", "isDeleted"] as const;
    if (pending?.count || !accepted ||
        !fields.every(key => accepted[key] !== undefined && accepted[key] === local[key])) {
      throw new Error("Employee has unsynced local changes; pull deferred.");
    }
    await markEmployeeSynced(companyId, employee._id);
  }

  /*
   * ==========================================================
   * CASE 3: Incoming version is older/equal
   * ==========================================================
   */
  if (incomingVersion <= localVersion) {
    console.log(
      `SKIPPING EMPLOYEE ${employee._id}: ` + `LOCAL VERSION IS NEWER/EQUAL`,
      {
        companyId,
        localVersion,
        incomingVersion,
      }
    );

    return;
  }

  /*
   * ==========================================================
   * CASE 4: Server has a newer version
   * ==========================================================
   */
  await run(
    `
    UPDATE employees
    SET
      firstName = ?,
      lastName = ?,
      matricule = ?,
      idNum = ?,
      accountNumber = ?,
      dateBirth = ?,
      dateHired = ?,
      role = ?,
      department = ?,
      salary = ?,
      remainingLeave = ?,
      status = ?,
      telephone = ?,
      address = ?,
      emergencyContact = ?,
      relationship = ?,
      contactPhone = ?,
      createdAt = ?,
      updatedAt = ?,
      serverVersion = ?,
      isDeleted = ?,
      synced = 1,
      lastSyncedAt = CURRENT_TIMESTAMP
    WHERE companyId = ?
      AND _id = ?
    `,
    [
      employee.firstName,
      employee.lastName,
      employee.matricule,
      employee.idNum,
      employee.accountNumber?.trim() || "cash",
      employee.dateBirth,
      employee.dateHired,
      employee.role,
      employee.department,
      employee.salary,
      employee.remainingLeave,
      employee.status,
      employee.telephone,
      employee.address,
      employee.emergencyContact,
      employee.relationship,
      employee.contactPhone,
      employee.createdAt,
      employee.updatedAt,
      incomingVersion,
      employee.isDeleted ?? 0,
      companyId,
      employee._id,
    ]
  );

  console.log(
    `UPDATED EMPLOYEE FROM SERVER: ${employee._id} ` +
      `(company ${companyId}, v${localVersion} → v${incomingVersion})`
  );
  });
}

/*
 * ============================================================
 * MARK EMPLOYEE AS SYNCED
 * ============================================================
 */
export async function markEmployeeSynced(companyId: string, _id: string) {
  return transaction(async () => {
  await run(
    `
    UPDATE employees
    SET
      synced = 1,
      lastSyncedAt = CURRENT_TIMESTAMP
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, _id]
  );
  });
}

/*
 * ============================================================
 * INTERNAL HELPER
 * ============================================================
 */
async function getEmployeeByIdIncludingDeleted(companyId: string, _id: string) {
  return get<Employee>(
    `
    SELECT *
    FROM employees
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, _id]
  );
}

type EmployeeSnapshot = Pick<Employee, "companyId" | "_id" | "serverVersion" | "updatedAt">;

export async function acknowledgeEmployee(
  companyId: string,
  snapshot: EmployeeSnapshot,
  queueId: string,
  serverVersion: number
): Promise<void> {
  if (snapshot.companyId !== companyId ||
      !Number.isSafeInteger(serverVersion) || serverVersion <= 0 ||
      serverVersion < (snapshot.serverVersion ?? 0)) {
    throw new Error("Employee acknowledgement has an invalid company or server version");
  }
  await transaction(async () => {
    const pending = await all<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE companyId = ? AND entity = 'employee'
       AND entityId = ? AND synced = 0 AND _id != ?`,
      [companyId, snapshot._id, queueId]
    );
    for (const item of pending) {
      const payload = JSON.parse(item.payload) as EmployeeSnapshot;
      if ((payload.serverVersion ?? 0) !== (snapshot.serverVersion ?? 0)) continue;
      await run(
        "UPDATE sync_queue SET payload = ? WHERE companyId = ? AND _id = ? AND synced = 0",
        [JSON.stringify({ ...payload, serverVersion }), companyId, item._id]
      );
    }
    await run(
      `UPDATE employees SET serverVersion = ?,
       synced = CASE WHEN updatedAt = ? AND ? = 0 THEN 1 ELSE 0 END
       WHERE companyId = ? AND _id = ? AND serverVersion = ?`,
      [serverVersion, snapshot.updatedAt, pending.length, companyId,
        snapshot._id, snapshot.serverVersion ?? 0]
    );
    await run(
      `UPDATE sync_queue SET synced = 1 WHERE companyId = ? AND _id = ?
       AND entity = 'employee' AND entityId = ?`,
      [companyId, queueId, snapshot._id]
    );
  });
}

export async function recoverEmployeeRevision(
  companyId: string,
  snapshot: EmployeeSnapshot,
  remote: Employee
): Promise<boolean> {
  if (snapshot.companyId !== companyId || remote.companyId !== companyId ||
      remote._id !== snapshot._id || !Number.isSafeInteger(remote.serverVersion) ||
      remote.serverVersion <= (snapshot.serverVersion ?? 0)) return false;
  return transaction(async () => {
    const history = await all<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE companyId = ? AND entity = 'employee'
       AND entityId = ? AND synced = 1 ORDER BY _id ASC`,
      [companyId, snapshot._id]
    );
    // Only rebase when the latest acknowledged full snapshot proves that
    // no employee fields changed remotely. Missing history stays conflicted.
    const latest = history.at(-1);
    if (!latest) return false;
    const accepted = JSON.parse(latest.payload) as Record<string, unknown>;
    if (latest.operation === "delete") accepted.isDeleted = 1;
    const fields = ["companyId", "_id", "firstName", "lastName", "matricule",
      "idNum", "role", "department", "salary", "remainingLeave", "status",
      "telephone", "address", "emergencyContact", "relationship", "contactPhone",
      "isDeleted"] as const;
    const trimmed = new Set<string>(["firstName", "lastName", "matricule", "idNum",
      "role", "telephone", "address", "emergencyContact", "relationship", "contactPhone"]);
    if (!fields.every(key => {
      const value = accepted[key];
      return value !== undefined && (trimmed.has(key) && typeof value === "string"
        ? value.trim() : value) === remote[key];
    })) return false;
    if (typeof accepted.accountNumber !== "string" ||
        (accepted.accountNumber.trim() || "cash") !== remote.accountNumber) return false;
    for (const key of ["dateBirth", "dateHired", "createdAt", "updatedAt"] as const) {
      if (typeof accepted[key] !== "string" || !remote[key] ||
          Date.parse(accepted[key]) !== Date.parse(remote[key])) return false;
    }
    const pending = await all<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE companyId = ? AND entity = 'employee'
       AND entityId = ? AND synced = 0`,
      [companyId, snapshot._id]
    );
    for (const item of pending) {
      const payload = JSON.parse(item.payload) as EmployeeSnapshot;
      if ((payload.serverVersion ?? 0) !== (snapshot.serverVersion ?? 0)) continue;
      await run(
        "UPDATE sync_queue SET payload = ? WHERE companyId = ? AND _id = ? AND synced = 0",
        [JSON.stringify({ ...payload, serverVersion: remote.serverVersion }), companyId, item._id]
      );
    }
    await run(
      `UPDATE employees SET serverVersion = ? WHERE companyId = ? AND _id = ? AND serverVersion = ?`,
      [remote.serverVersion, companyId, snapshot._id, snapshot.serverVersion ?? 0]
    );
    return true;
  });
}
