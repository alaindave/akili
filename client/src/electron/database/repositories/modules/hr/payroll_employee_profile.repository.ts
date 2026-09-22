import { all, get, run } from "../../../db.js";
import PayrollEmployeeProfile, {
  CreatePayrollProfileDto,
} from "../../../../../common/types/payroll/PayrollEmployeeProfile.js";
import { addToSyncQueue } from "../../shared/sync.repository.js";
import { randomUUID } from "crypto";
import { getPayrollComponentById } from "./payroll_components.repository.js";
import { PayrollEmployeeInput } from "../../../../../common/types/payroll/Payroll.js";

// ============================================================
// CREATE
// ============================================================

export async function createEmployeePayrollProfile(
  companyId: string,
  employeeId: string,
  profile: CreatePayrollProfileDto
) {
  if (!companyId) {
    throw new Error("Cannot create employee payroll profile without companyId");
  }

  console.log("NEW EMPLOYEE PROFILE:", profile);

  const _id = randomUUID();
  const now = new Date().toISOString();

  // Local records have not received a server version yet.
  const serverVersion = 0;

  await run(
    `
    INSERT INTO payroll_employee_profiles (
      companyId,
      _id,
      employeeId,
      componentId,
      name,
      displayName,
      displayOrder,
      type,
      calculationType,
      value,
      taxable,
      requiresHRApproval,
      enabled,
      synced,
      isDeleted,
      serverVersion,
      createdAt,
      updatedAt
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
    [
      companyId,
      _id,
      employeeId,
      profile.componentId ?? _id,
      profile.name,
      profile.displayName,
      profile.displayOrder,
      profile.type,
      profile.calculationType,
      profile.value,
      profile.taxable,
      profile.requiresHRApproval ?? 0,
      1,
      0,
      0,
      serverVersion,
      now,
      now,
    ]
  );

  const payrollProfile = {
    ...profile,
    companyId,
    employeeId,
    _id,
    serverVersion,
    createdAt: now,
    updatedAt: now,
  };

  console.log("PAYROLL PROFILE TO SAVE TO SYNC QUEUE", payrollProfile);

  await addToSyncQueue({
    companyId,
    entity: "payroll_profile",
    entityId: _id,
    operation: "create",
    payload: JSON.stringify(payrollProfile),
  });

  return payrollProfile;
}

// ============================================================
// CREATE MANY
// ============================================================

export async function createManyEmployeePayrollProfiles(
  companyId: string,
  employeeId: string,
  profiles: CreatePayrollProfileDto[]
) {
  for (const profile of profiles) {
    await createEmployeePayrollProfile(companyId, employeeId, profile);
  }
}

// ============================================================
// UPDATE
// ============================================================

export async function updateEmployeePayrollProfile(
  companyId: string,
  profile: PayrollEmployeeProfile
) {
  if (!profile._id) return;

  if (!companyId) {
    throw new Error("Cannot update employee payroll profile without companyId");
  }

  let isOverridden;

  const component = await getPayrollComponentById(
    companyId,
    profile.componentId
  );

  /*
   * CUSTOM PROFILE / COMPONENT NO LONGER EXISTS
   */
  if (!component) {
    console.log(`PAYROLL COMPONENT NOT FOUND FOR PROFILE ${profile._id}`);

    const existingProfile = await getEmployeePayrollProfile(
      companyId,
      profile._id
    );

    if (existingProfile) {
      console.log("PAYROLL PROFILE TO UPDATE", profile);

      const now = new Date().toISOString();

      await run(
        `
        UPDATE payroll_employee_profiles
        SET
          displayName = ?,
          displayOrder = ?,
          type = ?,
          calculationType = ?,
          calculationBase = ?,
          value = ?,
          taxable = ?,
          requiresHRApproval = ?,
          enabled = ?,
          synced = ?,
          isOverridden = ?,
          isDeleted = ?,
          updatedAt = ?,
          lastSyncedAt = ?
        WHERE companyId = ?
          AND _id = ?
        `,
        [
          profile.displayName,
          profile.displayOrder,
          profile.type,
          profile.calculationType,
          profile.calculationBase,
          profile.value,
          profile.taxable,
          profile.requiresHRApproval,
          profile.enabled,
          0,
          profile.isOverridden,
          profile.isDeleted,
          now,
          profile.lastSyncedAt ?? null,
          companyId,
          profile._id,
        ]
      );

      const updatedProfile = await getEmployeePayrollProfile(
        companyId,
        profile._id
      );

      console.log(
        "UPDATED PAYROLL PROFILE TO SAVE TO SYNC QUEUE",
        updatedProfile
      );

      if (updatedProfile) {
        await addToSyncQueue({
          companyId,
          entity: "payroll_profile",
          entityId: profile._id,
          operation: "update",
          payload: JSON.stringify({
            ...updatedProfile,
            companyId,
          }),
        });
      }

      return updatedProfile;
    }

    throw new Error("NO DEFAULT OR CUSTOM COMPONENTS FOUND WITH THAT ID");
  }

  /*
   * Determine whether this profile has been customized.
   */
  isOverridden =
    profile.displayName !== component.displayName ||
    profile.displayOrder !== component.displayOrder ||
    profile.type !== component.type ||
    profile.calculationType !== component.calculationType ||
    profile.calculationBase !== component.calculationBase ||
    profile.value !== component.defaultValue ||
    profile.enabled !== component.enabled ||
    profile.requiresHRApproval !== component.requiresHRApproval;

  profile.isOverridden = isOverridden ? 1 : 0;

  console.log("PAYROLL PROFILE TO UPDATE", profile);

  const now = new Date().toISOString();

  await run(
    `
    UPDATE payroll_employee_profiles
    SET
      displayName = ?,
      displayOrder = ?,
      type = ?,
      calculationType = ?,
      calculationBase = ?,
      value = ?,
      taxable = ?,
      requiresHRApproval = ?,
      enabled = ?,
      synced = ?,
      isOverridden = ?,
      isDeleted = ?,
      updatedAt = ?,
      lastSyncedAt = ?
    WHERE companyId = ?
      AND _id = ?
    `,
    [
      profile.displayName,
      profile.displayOrder,
      profile.type,
      profile.calculationType,
      profile.calculationBase,
      profile.value,
      profile.taxable,
      profile.requiresHRApproval,
      profile.enabled,
      0,
      profile.isOverridden,
      profile.isDeleted,
      now,
      profile.lastSyncedAt ?? null,
      companyId,
      profile._id,
    ]
  );

  const updatedProfile = await getEmployeePayrollProfile(
    companyId,
    profile._id
  );

  console.log("UPDATED PAYROLL PROFILE TO SAVE TO SYNC QUEUE", updatedProfile);

  if (updatedProfile) {
    await addToSyncQueue({
      companyId,
      entity: "payroll_profile",
      entityId: profile._id,
      operation: "update",
      payload: JSON.stringify({
        ...updatedProfile,
        companyId,
      }),
    });
  }

  return updatedProfile;
}

// ============================================================
// UPDATE MANY
// ============================================================

export async function updateManyEmployeePayrollProfiles(
  companyId: string,
  profiles: PayrollEmployeeProfile[]
) {
  for (const profile of profiles) {
    await updateEmployeePayrollProfile(companyId, profile);
  }
}

/*
 * ============================================================
 * SYNC LOOKUPS
 * ============================================================
 *
 * These functions intentionally DO NOT filter isDeleted.
 *
 * During a pull sync, a remotely deleted profile still needs
 * to be found locally so that it can be updated as deleted
 * instead of being inserted as a new record.
 */

// ============================================================
// Get profile by exact ID
// ============================================================

export async function getEmployeePayrollProfileById(
  companyId: string,
  _id: string
): Promise<PayrollEmployeeProfile | null> {
  return await get<PayrollEmployeeProfile>(
    `
    SELECT *
    FROM payroll_employee_profiles
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, _id]
  );
}

// ============================================================
// Get profile by employee + component
// ============================================================

export async function getEmployeePayrollProfileByEmployeeAndComponent(
  companyId: string,
  employeeId: string,
  componentId: string
): Promise<PayrollEmployeeProfile | null> {
  return await get<PayrollEmployeeProfile>(
    `
    SELECT *
    FROM payroll_employee_profiles
    WHERE companyId = ?
      AND employeeId = ?
      AND componentId = ?
    LIMIT 1
    `,
    [companyId, employeeId, componentId]
  );
}

/*
 * ============================================================
 * PULL SYNC UPSERT
 * ============================================================
 */

export async function upsertEmployeePayrollProfile(
  profile: PayrollEmployeeProfile
) {
  if (!profile._id) return;

  const companyId = profile.companyId;

  if (!companyId) {
    throw new Error("Cannot upsert employee payroll profile without companyId");
  }

  /*
   * 1. First find the exact record by companyId + _id.
   */
  let local = await getEmployeePayrollProfileById(companyId, profile._id);

  /*
   * 2. If the _id doesn't exist locally, find the existing
   *    record using companyId + employeeId + componentId.
   */
  if (!local) {
    local = await getEmployeePayrollProfileByEmployeeAndComponent(
      companyId,
      profile.employeeId,
      profile.componentId
    );
  }

  /*
   * 3. Existing local record.
   */
  if (local && local._id) {
    const localVersion = Number(local.serverVersion ?? 0);

    const remoteVersion = Number(profile.serverVersion ?? 0);

    /*
     * Never overwrite a newer local/server version with
     * an older remote version.
     */
    if (remoteVersion < localVersion) {
      console.log(
        `SKIPPING REMOTE PAYROLL EMPLOYEE PROFILE. LOCAL VERSION IS NEWER: ${profile._id}`,
        {
          localId: local._id,
          remoteId: profile._id,
          localVersion,
          remoteVersion,
        }
      );

      return local;
    }

    /*
     * Do not overwrite a local change that is still waiting
     * to be pushed to the server.
     */
    if (local.synced === 0) {
      console.log(
        `SKIPPING REMOTE PAYROLL EMPLOYEE PROFILE. LOCAL CHANGES NOT SYNCED: ${profile._id}`,
        {
          localId: local._id,
          remoteId: profile._id,
        }
      );

      return local;
    }

    await run(
      `
      UPDATE payroll_employee_profiles
      SET
        companyId = ?,
        employeeId = ?,
        componentId = ?,
        name = ?,
        displayName = ?,
        displayOrder = ?,
        type = ?,
        calculationType = ?,
        calculationBase = ?,
        value = ?,
        taxable = ?,
        requiresHRApproval = ?,
        enabled = ?,
        isOverridden = ?,
        synced = 1,
        isDeleted = ?,
        serverVersion = ?,
        createdAt = ?,
        updatedAt = ?,
        lastSyncedAt = CURRENT_TIMESTAMP
      WHERE companyId = ?
        AND _id = ?
      `,
      [
        companyId,
        profile.employeeId,
        profile.componentId,
        profile.name,
        profile.displayName,
        profile.displayOrder,
        profile.type,
        profile.calculationType,
        profile.calculationBase,
        profile.value,
        profile.taxable,
        profile.requiresHRApproval,
        profile.enabled,
        profile.isOverridden ?? 0,
        profile.isDeleted ?? 0,
        profile.serverVersion ?? 0,
        profile.createdAt,
        profile.updatedAt,
        companyId,
        local._id,
      ]
    );

    return await getEmployeePayrollProfileById(companyId, local._id);
  }

  /*
   * 4. No matching local record exists.
   */
  await run(
    `
    INSERT INTO payroll_employee_profiles (
      companyId,
      _id,
      employeeId,
      componentId,
      name,
      displayName,
      displayOrder,
      type,
      calculationType,
      calculationBase,
      value,
      taxable,
      requiresHRApproval,
      enabled,
      isOverridden,
      synced,
      isDeleted,
      serverVersion,
      createdAt,
      updatedAt,
      lastSyncedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    [
      companyId,
      profile._id,
      profile.employeeId,
      profile.componentId,
      profile.name,
      profile.displayName,
      profile.displayOrder,
      profile.type,
      profile.calculationType,
      profile.calculationBase,
      profile.value,
      profile.taxable,
      profile.requiresHRApproval,
      profile.enabled,
      profile.isOverridden ?? 0,
      1,
      profile.isDeleted ?? 0,
      profile.serverVersion ?? 0,
      profile.createdAt,
      profile.updatedAt,
    ]
  );

  return await getEmployeePayrollProfileById(companyId, profile._id);
}

// ============================================================
// UPSERT MANY
// ============================================================

export async function upsertManyEmployeePayrollProfiles(
  profiles: PayrollEmployeeProfile[]
) {
  for (const profile of profiles) {
    await upsertEmployeePayrollProfile(profile);
  }
}

// ============================================================
// GET ALL EMPLOYEE PAYROLL INPUTS
// ============================================================

export async function getAllEmployeePayrollInputs(
  companyId: string
): Promise<PayrollEmployeeInput[]> {
  const rows = await all<
    PayrollEmployeeProfile & {
      employeeName?: string;
    }
  >(
    `
    SELECT *
    FROM payroll_employee_profiles
    WHERE companyId = ?
      AND isDeleted = 0
      AND enabled = 1
    ORDER BY employeeId, displayOrder
    `,
    [companyId]
  );

  const employees = new Map<string, PayrollEmployeeInput>();

  for (const row of rows) {
    let employee = employees.get(row.employeeId);

    if (!employee) {
      employee = {
        companyId,
        employeeId: row.employeeId,
        baseSalary: 0,
        components: [],
      };

      employees.set(row.employeeId, employee);
    }

    // Base salary is the value of the BASE_SALARY component
    if (row.name === "BASE_SALARY") {
      employee.baseSalary = row.value ?? 0;

      continue;
    }

    employee.components.push({
      companyId,
      _id: row.componentId,
      name: row.name,
      displayName: row.displayName,
      displayOrder: row.displayOrder,
      type: row.type,
      calculationType: row.calculationType,
      calculationBase: row.calculationBase,
      enabled: row.enabled ?? 0,
      taxable: row.taxable,
      value: row.value ?? 0,
    });
  }

  return [...employees.values()];
}

// ============================================================
// GET PROFILE
// ============================================================

export async function getEmployeePayrollProfile(
  companyId: string,
  _id: string
) {
  return await get<PayrollEmployeeProfile>(
    `
    SELECT *
    FROM payroll_employee_profiles
    WHERE companyId = ?
      AND _id = ?
      AND isDeleted = 0
    `,
    [companyId, _id]
  );
}

// ============================================================
// GET PROFILES BY EMPLOYEE
// ============================================================

export async function getEmployeePayrollProfilesByEmployee(
  companyId: string,
  employeeId: string
) {
  return await all<PayrollEmployeeProfile>(
    `
    SELECT *
    FROM payroll_employee_profiles
    WHERE companyId = ?
      AND employeeId = ?
      AND isDeleted = 0
    ORDER BY displayName
    `,
    [companyId, employeeId]
  );
}

// ============================================================
// GET PROFILE BY COMPONENT
// ============================================================

export async function getEmployeePayrollProfileByComponent(
  companyId: string,
  employeeId: string,
  componentId: string
) {
  return await get<PayrollEmployeeProfile>(
    `
    SELECT *
    FROM payroll_employee_profiles
    WHERE companyId = ?
      AND employeeId = ?
      AND componentId = ?
      AND isDeleted = 0
    `,
    [companyId, employeeId, componentId]
  );
}

// ============================================================
// GET ALL PROFILES
// ============================================================

export async function getAllEmployeePayrollProfiles(
  companyId: string,
  employeeID?: string,
  type?: "EARNING" | "DEDUCTION"
): Promise<PayrollEmployeeProfile[]> {
  if (type && employeeID) {
    return await all(
      `
      SELECT *
      FROM payroll_employee_profiles
      WHERE companyId = ?
        AND employeeId = ?
        AND type = ?
        AND isDeleted = 0
      ORDER BY displayOrder
      `,
      [companyId, employeeID, type]
    );
  }

  if (employeeID) {
    return await all(
      `
      SELECT *
      FROM payroll_employee_profiles
      WHERE companyId = ?
        AND employeeId = ?
        AND isDeleted = 0
      ORDER BY displayOrder
      `,
      [companyId, employeeID]
    );
  }

  return await all(
    `
    SELECT *
    FROM payroll_employee_profiles
    WHERE companyId = ?
      AND isDeleted = 0
    ORDER BY displayOrder
    `,
    [companyId]
  );
}

// ============================================================
// GET UNSYNCED PROFILES
// ============================================================

export async function getUnsyncedEmployeePayrollProfiles(companyId: string) {
  return await all<PayrollEmployeeProfile>(
    `
    SELECT *
    FROM payroll_employee_profiles
    WHERE companyId = ?
      AND synced = 0
    ORDER BY updatedAt ASC
    `,
    [companyId]
  );
}

// ============================================================
// MARK PROFILE SYNCED
// ============================================================

export async function markPayrollEmployeeProfileSynced(
  companyId: string,
  _id: string
) {
  await run(
    `
    UPDATE payroll_employee_profiles
    SET
      synced = 1,
      lastSyncedAt = CURRENT_TIMESTAMP
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, _id]
  );

  return true;
}

// ============================================================
// MARK MANY PROFILES SYNCED
// ============================================================

export async function markManyPayrollEmployeeProfileSynced(
  companyId: string,
  ids: string[]
) {
  for (const id of ids) {
    await markPayrollEmployeeProfileSynced(companyId, id);
  }
}

// ============================================================
// DELETE
// ============================================================

export async function deleteEmployeePayrollProfile(
  companyId: string,
  _id: string
) {
  const now = new Date().toISOString();

  const existingProfile = await getEmployeePayrollProfileById(companyId, _id);

  if (!existingProfile) {
    return false;
  }

  await run(
    `
    UPDATE payroll_employee_profiles
    SET
      isDeleted = 1,
      synced = 0,
      updatedAt = ?
    WHERE companyId = ?
      AND _id = ?
    `,
    [now, companyId, _id]
  );

  const payrollProfile = await getEmployeePayrollProfileById(companyId, _id);

  console.log("DELETED PAYROLL PROFILE TO SAVE TO SYNC QUEUE", payrollProfile);

  await addToSyncQueue({
    companyId,
    entity: "payroll_profile",
    entityId: _id,
    operation: "delete",
    payload: JSON.stringify({
      ...payrollProfile,
      companyId,
      _id,
      updatedAt: now,
      serverVersion: payrollProfile?.serverVersion ?? 0,
      isDeleted: 1,
    }),
  });

  return true;
}

// ============================================================
// RESTORE
// ============================================================

export async function restoreEmployeePayrollProfile(
  companyId: string,
  _id: string
) {
  const now = new Date().toISOString();

  const existingProfile = await getEmployeePayrollProfileById(companyId, _id);

  if (!existingProfile) {
    return false;
  }

  await run(
    `
    UPDATE payroll_employee_profiles
    SET
      isDeleted = 0,
      synced = 0,
      updatedAt = ?
    WHERE companyId = ?
      AND _id = ?
    `,
    [now, companyId, _id]
  );

  const restoredProfile = await getEmployeePayrollProfileById(companyId, _id);

  if (restoredProfile) {
    await addToSyncQueue({
      companyId,
      entity: "payroll_profile",
      entityId: _id,
      operation: "update",
      payload: JSON.stringify({
        ...restoredProfile,
        companyId,
        isDeleted: 0,
        updatedAt: now,
      }),
    });
  }

  return true;
}

// ============================================================
// PERMANENT DELETE
// ============================================================

export async function permanentlyDeleteEmployeePayrollProfile(
  companyId: string,
  _id: string
) {
  await run(
    `
    DELETE FROM payroll_employee_profiles
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, _id]
  );

  return true;
}

// ============================================================
// EXISTS
// ============================================================

export async function employeePayrollProfileExists(
  companyId: string,
  employeeId: string,
  componentId: string
): Promise<boolean> {
  const profile = await getEmployeePayrollProfileByComponent(
    companyId,
    employeeId,
    componentId
  );

  return !!profile;
}

// ============================================================
// COUNT
// ============================================================

export async function countEmployeePayrollProfiles(
  companyId: string
): Promise<number> {
  const result = await get<{ count: number }>(
    `
    SELECT COUNT(*) AS count
    FROM payroll_employee_profiles
    WHERE companyId = ?
      AND isDeleted = 0
    `,
    [companyId]
  );

  return result?.count ?? 0;
}
