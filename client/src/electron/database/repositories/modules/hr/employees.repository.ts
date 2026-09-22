import { run, get, all } from "../../../db.js";
import { randomUUID } from "crypto";
import Employee from "../../../../../common/types/Employee.js";
import { addToSyncQueue } from "../../shared/sync.repository.js";
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
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
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
  const existing = await getEmployeeByIdIncludingDeleted(companyId, _id);

  if (!existing) {
    throw new Error("Employee not found");
  }

  const updatedAt = new Date().toISOString();

  /*
   * Keep the existing serverVersion.
   */
  const serverVersion = existing.serverVersion ?? 0;

  await run(
    `
    UPDATE employees
    SET
      firstName = ?,
      lastName = ?,
      matricule = ?,
      idNum = ?,
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

  const updatedEmployee = await getEmployeeByIdIncludingDeleted(companyId, _id);

  if (!updatedEmployee) {
    throw new Error("Failed to retrieve updated employee");
  }

  console.log("EMPLOYEE TO SAVE TO SYNC QUEUE:", updatedEmployee);

  await addToSyncQueue({
    companyId,
    entity: "employee",
    entityId: _id,
    operation: "update",
    payload: JSON.stringify(updatedEmployee),
  });

  return updatedEmployee;
}

/*
 * ============================================================
 * DELETE EMPLOYEE
 * ============================================================
 */
export async function deleteEmployee(companyId: string, _id: string) {
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
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
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
        0,
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
    console.warn(
      `SKIPPING SERVER EMPLOYEE ${employee._id}: ` +
        `LOCAL CHANGES ARE UNSYNCED`,
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
}

/*
 * ============================================================
 * MARK EMPLOYEE AS SYNCED
 * ============================================================
 */
export async function markEmployeeSynced(companyId: string, _id: string) {
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
