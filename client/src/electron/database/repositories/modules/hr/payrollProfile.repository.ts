import { randomUUID } from "crypto";

import { all, get, run, transaction } from "../../../db.js";

import PayrollEmployeeProfile, {
  CreatePayrollProfileDto,
} from "../../../../../common/types/hr/payroll/PayrollEmployeeProfile.js";

import { addToSyncQueue } from "../../shared/sync.repository.js";

import { getPayrollComponentById } from "./payrollComponents.repository.js";

import { PayrollEmployeeInput } from "../../../../../common/types/hr/payroll/Payroll.js";

import { SyncQueueItem } from "../../../../../common/types/shared/Sync.js";

type ProfileRow = PayrollEmployeeProfile;

export async function recoverPayrollProfileQueue(
  companyId: string
): Promise<void> {
  await transaction(async () => {
    const orphaned = await all<PayrollEmployeeProfile>(
      `SELECT p.* FROM payroll_employee_profiles p WHERE p.companyId = ?
       AND p.synced = 0 AND p.isDeleted = 1 AND NOT EXISTS (
         SELECT 1 FROM sync_queue q WHERE q.companyId = p.companyId
         AND q.entity = 'payroll_profile' AND q.entityId = p._id AND q.synced = 0)`,
      [companyId]
    );
    for (const profile of orphaned)
      await queuePayrollProfile(companyId, profile, "delete");
  });
}

export async function recoverPayrollProfileRevision(
  companyId: string,
  snapshot: PayrollEmployeeProfile,
  remote: PayrollEmployeeProfile
): Promise<boolean> {
  if (
    remote.companyId !== companyId ||
    remote._id !== snapshot._id ||
    !Number.isSafeInteger(remote.serverVersion) ||
    remote.serverVersion <= 0
  )
    return false;
  return transaction(async () => {
    const history = await all<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE companyId = ? AND entity = 'payroll_profile'
       AND entityId = ? AND synced = 1 ORDER BY _id DESC`,
      [companyId, snapshot._id]
    );
    const defaults: Record<string, unknown> = {
      enabled: 1,
      isOverridden: 0,
      isDeleted: 0,
      requiresHRApproval: 0,
      accountNumber: "cash",
      value: 0,
    };
    const fields = [
      "companyId",
      "_id",
      "employeeId",
      "componentId",
      "accountNumber",
      "name",
      "displayName",
      "displayOrder",
      "type",
      "calculationType",
      "value",
      "taxable",
      "requiresHRApproval",
      "enabled",
      "isOverridden",
      "isDeleted",
    ];
    const remoteFields = remote as unknown as Record<string, unknown>;
    const proven = history.some((item) => {
      const prior = JSON.parse(item.payload) as Record<string, unknown>;
      if (item.operation === "delete") prior.isDeleted = 1;
      return fields.every(
        (key) =>
          (prior[key] ?? defaults[key]) === (remoteFields[key] ?? defaults[key])
      );
    });
    if (!proven) return false;
    const pending = await all<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE companyId = ? AND entity = 'payroll_profile'
       AND entityId = ? AND synced = 0`,
      [companyId, snapshot._id]
    );
    for (const item of pending) {
      const payload = JSON.parse(item.payload) as PayrollEmployeeProfile;
      if ((payload.serverVersion ?? 0) !== (snapshot.serverVersion ?? 0))
        continue;
      await run(
        "UPDATE sync_queue SET payload = ? WHERE companyId = ? AND _id = ? AND synced = 0",
        [
          JSON.stringify({ ...payload, serverVersion: remote.serverVersion }),
          companyId,
          item._id,
        ]
      );
    }
    await run(
      `UPDATE payroll_employee_profiles SET serverVersion = ?
      WHERE companyId = ? AND _id = ? AND serverVersion = ?`,
      [
        remote.serverVersion,
        companyId,
        snapshot._id,
        snapshot.serverVersion ?? 0,
      ]
    );
    return true;
  });
}

const TABLE = "payroll_employee_profiles";

function normalizeComponentId(
  componentId: string | null | undefined
): string | null {
  const normalized = componentId?.trim();
  return normalized ? normalized : null;
}

function normalizeAccountNumber(
  accountNumber: string | null | undefined
): string {
  return accountNumber?.trim() || "cash";
}

function normalizeVersion(value: number | null | undefined): number {
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : 0;
}

async function queuePayrollProfile(
  companyId: string,
  profile: ProfileRow,
  operation: "create" | "update" | "delete"
): Promise<void> {
  if (!profile._id) throw new Error("PAYROLL PROFILE ID IS REQUIRED");
  const payload = {
    ...profile,
    companyId,
    componentId: normalizeComponentId(profile.componentId),
    accountNumber: normalizeAccountNumber(profile.accountNumber),
    serverVersion: normalizeVersion(profile.serverVersion),
  };

  await addToSyncQueue({
    companyId,
    entity: "payroll_profile",
    entityId: profile._id,
    operation,
    payload: JSON.stringify(payload),
  });
}

function getProfileValues(profile: ProfileRow): unknown[] {
  return [
    profile.companyId,
    profile.employeeId,
    normalizeComponentId(profile.componentId),
    normalizeAccountNumber(profile.accountNumber),
    profile.name,
    profile.displayName || profile.name,
    profile.displayOrder ?? 0,
    profile.type,
    profile.calculationType,
    profile.value ?? 0,
    profile.taxable ?? 0,
    profile.requiresHRApproval ?? 0,
    profile.enabled ?? 1,
    profile.isOverridden ?? 0,
    profile.createdAt,
    profile.updatedAt,
    normalizeVersion(profile.serverVersion),
    profile.synced ?? 0,
    profile.isDeleted ?? 0,
    profile._id,
  ];
}

async function insertProfile(profile: ProfileRow): Promise<void> {
  await run(
    `
      INSERT INTO ${TABLE} (
        companyId,
        employeeId,
        componentId,
        accountNumber,
        name,
        displayName,
        displayOrder,
        type,
        calculationType,
        value,
        taxable,
        requiresHRApproval,
        enabled,
        isOverridden,
        createdAt,
        updatedAt,
        serverVersion,
        synced,
        isDeleted,
        _id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    getProfileValues(profile)
  );
}

async function updateProfileRow(profile: ProfileRow): Promise<void> {
  await run(
    `
      UPDATE ${TABLE}
      SET
        employeeId = ?,
        componentId = ?,
        accountNumber = ?,
        name = ?,
        displayName = ?,
        displayOrder = ?,
        type = ?,
        calculationType = ?,
        value = ?,
        taxable = ?,
        requiresHRApproval = ?,
        enabled = ?,
        isOverridden = ?,
        updatedAt = ?,
        serverVersion = ?,
        synced = ?,
        isDeleted = ?
      WHERE companyId = ?
        AND _id = ?
    `,
    [
      profile.employeeId,
      normalizeComponentId(profile.componentId),
      normalizeAccountNumber(profile.accountNumber),
      profile.name,
      profile.displayName || profile.name,
      profile.displayOrder ?? 0,
      profile.type,
      profile.calculationType,
      profile.value ?? 0,
      profile.taxable ?? 0,
      profile.requiresHRApproval ?? 0,
      profile.enabled ?? 1,
      profile.isOverridden ?? 0,
      profile.updatedAt,
      normalizeVersion(profile.serverVersion),
      profile.synced ?? 0,
      profile.isDeleted ?? 0,
      profile.companyId,
      profile._id,
    ]
  );
}

/* =========================================================
   ACKNOWLEDGE SYNCED PAYROLL PROFILE
========================================================= */

export async function acknowledgePayrollProfile(
  companyId: string,
  snapshot: PayrollEmployeeProfile,
  queueId: string,
  serverVersion: number
): Promise<void> {
  if (!Number.isSafeInteger(serverVersion) || serverVersion <= 0) {
    throw new Error(
      "Payroll profile acknowledgement has no valid server version"
    );
  }
  await transaction(async () => {
    const pending = await all<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE companyId = ? AND entity = 'payroll_profile'
        AND entityId = ? AND synced = 0 AND _id != ?`,
      [companyId, snapshot._id, queueId]
    );
    for (const item of pending) {
      const payload = JSON.parse(item.payload) as PayrollEmployeeProfile;
      if ((payload.serverVersion ?? 0) !== (snapshot.serverVersion ?? 0))
        continue;
      await run(
        "UPDATE sync_queue SET payload = ? WHERE companyId = ? AND _id = ? AND synced = 0",
        [JSON.stringify({ ...payload, serverVersion }), companyId, item._id]
      );
    }
    await run(
      `UPDATE payroll_employee_profiles SET serverVersion = ?,
        synced = CASE WHEN updatedAt = ? AND ? = 0 THEN 1 ELSE 0 END,
        lastSyncedAt = CURRENT_TIMESTAMP
       WHERE companyId = ? AND _id = ? AND serverVersion = ?`,
      [
        serverVersion,
        snapshot.updatedAt,
        pending.length,
        companyId,
        snapshot._id,
        snapshot.serverVersion ?? 0,
      ]
    );
    await run(
      "UPDATE sync_queue SET synced = 1 WHERE companyId = ? AND _id = ? AND entity = 'payroll_profile' AND entityId = ?",
      [companyId, queueId, snapshot._id]
    );
  });
}

/* =========================================================
   CREATE PAYROLL PROFILE
========================================================= */

export async function createEmployeePayrollProfile(
  companyId: string,
  employeeId: string,
  profile: CreatePayrollProfileDto
) {
  return transaction(async () => {
    if (!companyId) {
      throw new Error(
        "Cannot create employee payroll profile without companyId"
      );
    }

    console.log("NEW EMPLOYEE PROFILE:", profile);

    const _id = randomUUID();
    const now = new Date().toISOString();

    const employee = await get<{ accountNumber?: string }>(
      "SELECT accountNumber FROM employees WHERE companyId = ? AND _id = ?",
      [companyId, employeeId]
    );
    const accountNumber = employee?.accountNumber?.trim() || "cash";

    // Local records have not received a server version yet.
    const serverVersion = 0;

    await run(
      `
    INSERT INTO payroll_employee_profiles (
      companyId,
      _id,
      employeeId,
      accountNumber,
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
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
      [
        companyId,
        _id,
        employeeId,
        accountNumber,
        profile.componentId ?? null,
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
      accountNumber,
      componentId: profile.componentId ?? _id,
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
  });
}

/* =========================================================
   CREATE MANY PAYROLL PROFILES
========================================================= */

export async function createManyEmployeePayrollProfiles(
  companyId: string,
  employeeId: string,
  profiles: CreatePayrollProfileDto[]
) {
  return transaction(async () => {
    for (const profile of profiles) {
      await createEmployeePayrollProfile(companyId, employeeId, profile);
    }
  });
}

/* =========================================================
   GET PROFILE BY ID
   Includes soft-deleted rows.
========================================================= */

export async function getEmployeePayrollProfileById(
  companyId: string,
  profileId: string
): Promise<ProfileRow | null> {
  return (
    (await get<ProfileRow>(
      `
        SELECT *
        FROM ${TABLE}
        WHERE companyId = ?
          AND _id = ?
        LIMIT 1
      `,
      [companyId, profileId]
    )) ?? null
  );
}

/* =========================================================
   GET PROFILE BY EMPLOYEE + COMPONENT
========================================================= */

export async function getEmployeePayrollProfileByEmployeeAndComponent(
  companyId: string,
  employeeId: string,
  componentId: string | null
): Promise<ProfileRow | null> {
  if (componentId == null || !componentId.trim()) {
    return null;
  }

  return (
    (await get<ProfileRow>(
      `
        SELECT *
        FROM ${TABLE}
        WHERE companyId = ?
          AND employeeId = ?
          AND componentId = ?
          AND isDeleted = 0
        LIMIT 1
      `,
      [companyId, employeeId, componentId.trim()]
    )) ?? null
  );
}

/* =========================================================
   GET ACTIVE PROFILE BY ID
========================================================= */

export async function getEmployeePayrollProfile(
  companyId: string,
  profileId: string
): Promise<ProfileRow | null> {
  return (
    (await get<ProfileRow>(
      `
        SELECT *
        FROM ${TABLE}
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
        LIMIT 1
      `,
      [companyId, profileId]
    )) ?? null
  );
}

/* =========================================================
   UPDATE PAYROLL PROFILE
========================================================= */

export async function updateEmployeePayrollProfile(
  companyId: string,
  profile: ProfileRow
): Promise<ProfileRow> {
  if (!profile._id) {
    throw new Error("PAYROLL PROFILE ID IS REQUIRED");
  }

  const existing = await getEmployeePayrollProfileById(companyId, profile._id);

  if (!existing) {
    throw new Error("PAYROLL PROFILE NOT FOUND");
  }

  if (existing.isDeleted) {
    throw new Error("CANNOT UPDATE A DELETED PAYROLL PROFILE");
  }

  const componentId = normalizeComponentId(profile.componentId);

  if (componentId) {
    const component = await getPayrollComponentById(companyId, componentId);

    if (!component) {
      throw new Error(`PAYROLL COMPONENT NOT FOUND: ${componentId}`);
    }

    const duplicate = await get<{ _id: string }>(
      `
        SELECT _id
        FROM ${TABLE}
        WHERE companyId = ?
          AND employeeId = ?
          AND componentId = ?
          AND isDeleted = 0
          AND _id != ?
        LIMIT 1
      `,
      [companyId, profile.employeeId, componentId, profile._id]
    );

    if (duplicate) {
      throw new Error(
        "THIS PAYROLL COMPONENT IS ALREADY ASSIGNED TO THIS EMPLOYEE"
      );
    }
  }

  const updated: ProfileRow = {
    ...existing,
    ...profile,
    companyId,
    serverVersion: existing.serverVersion,
    componentId: componentId ?? profile.componentId,
    accountNumber: normalizeAccountNumber(profile.accountNumber),
    updatedAt: new Date().toISOString(),
    synced: 0,
    isDeleted: 0,
  };

  await transaction(async () => {
    await updateProfileRow(updated);

    await queuePayrollProfile(companyId, updated, "update");
  });

  return updated;
}

/* =========================================================
   UPDATE MANY PAYROLL PROFILES
========================================================= */

export async function updateManyEmployeePayrollProfiles(
  companyId: string,
  profiles: ProfileRow[]
): Promise<ProfileRow[]> {
  const updated: ProfileRow[] = [];

  for (const profile of profiles) {
    updated.push(await updateEmployeePayrollProfile(companyId, profile));
  }

  return updated;
}

/* =========================================================
   UPSERT PROFILE FROM SERVER
========================================================= */

export async function upsertEmployeePayrollProfile(
  incoming: ProfileRow
): Promise<ProfileRow> {
  if (!incoming.companyId || !incoming._id) {
    throw new Error("PAYROLL PROFILE COMPANY ID AND PROFILE ID ARE REQUIRED");
  }

  const profile: ProfileRow = {
    ...incoming,
    componentId:
      normalizeComponentId(incoming.componentId) ?? incoming.componentId,
    accountNumber: normalizeAccountNumber(incoming.accountNumber),
    serverVersion: normalizeVersion(incoming.serverVersion),
    synced: 1,
    isDeleted: incoming.isDeleted ?? 0,
  };

  return transaction(async () => {
    const existingById = await get<ProfileRow>(
      `
        SELECT *
        FROM ${TABLE}
        WHERE companyId = ?
          AND _id = ?
        LIMIT 1
      `,
      [profile.companyId, profile._id]
    );

    /*
     * Do not overwrite unsynced local changes with server data.
     */
    if (existingById && Number(existingById.synced) === 0) {
      throw new Error(`PAYROLL_PROFILE_HAS_LOCAL_CHANGES:${profile._id}`);
    }

    if (
      existingById &&
      normalizeVersion(existingById.serverVersion) > profile.serverVersion
    ) {
      return existingById;
    }

    /*
     * Check the natural key only for real component IDs.
     * NULL component IDs are custom profiles and must not be
     * treated as one unique employee/component pair.
     */
    if (profile.componentId && !profile.isDeleted) {
      const existingByComponent = await get<ProfileRow>(
        `
          SELECT *
          FROM ${TABLE}
          WHERE companyId = ?
            AND employeeId = ?
            AND componentId = ?
            AND isDeleted = 0
          LIMIT 1
        `,
        [profile.companyId, profile.employeeId, profile.componentId]
      );

      if (existingByComponent && existingByComponent._id !== profile._id) {
        throw new Error(
          [
            "PAYROLL_PROFILE_ID_CONFLICT",
            `incomingId=${profile._id}`,
            `localId=${existingByComponent._id}`,
            `employeeId=${profile.employeeId}`,
            `componentId=${profile.componentId}`,
          ].join(":")
        );
      }
    }

    if (existingById) {
      await updateProfileRow(profile);
    } else {
      await insertProfile(profile);
    }

    return profile;
  });
}

/* =========================================================
   UPSERT MANY PROFILES FROM SERVER
========================================================= */

export async function upsertManyEmployeePayrollProfiles(
  profiles: ProfileRow[]
): Promise<ProfileRow[]> {
  const results: ProfileRow[] = [];

  for (const profile of profiles) {
    results.push(await upsertEmployeePayrollProfile(profile));
  }

  return results;
}

/* =========================================================
   GET ALL PROFILES FOR EMPLOYEE
========================================================= */

export async function getEmployeePayrollProfilesByEmployee(
  companyId: string,
  employeeId: string
): Promise<ProfileRow[]> {
  return all<ProfileRow>(
    `
      SELECT *
      FROM ${TABLE}
      WHERE companyId = ?
        AND employeeId = ?
        AND isDeleted = 0
      ORDER BY displayOrder ASC, name ASC
    `,
    [companyId, employeeId]
  );
}

/* =========================================================
   GET PROFILE BY COMPONENT
========================================================= */

export async function getEmployeePayrollProfileByComponent(
  companyId: string,
  employeeId: string,
  componentId: string | null
): Promise<ProfileRow | null> {
  if (!componentId?.trim()) {
    return null;
  }

  return getEmployeePayrollProfileByEmployeeAndComponent(
    companyId,
    employeeId,
    componentId
  );
}

/* =========================================================
   GET ALL ACTIVE PROFILES
========================================================= */

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

/* =========================================================
   GET UNSYNCED PROFILES
========================================================= */

export async function getUnsyncedEmployeePayrollProfiles(
  companyId: string
): Promise<ProfileRow[]> {
  return all<ProfileRow>(
    `
      SELECT *
      FROM ${TABLE}
      WHERE companyId = ?
        AND synced = 0
      ORDER BY updatedAt ASC
    `,
    [companyId]
  );
}

/* =========================================================
   MARK ONE PROFILE SYNCED
========================================================= */

export async function markPayrollEmployeeProfileSynced(
  companyId: string,
  _id: string,
  updatedAt?: string
) {
  return transaction(async () => {
    await run(
      `
    UPDATE payroll_employee_profiles
    SET
      synced = 1,
      lastSyncedAt = CURRENT_TIMESTAMP
    WHERE companyId = ?
      AND _id = ?
      AND (? IS NULL OR updatedAt = ?)
    `,
      [companyId, _id, updatedAt ?? null, updatedAt ?? null]
    );

    return true;
  });
}

/* =========================================================
   MARK MANY PROFILES SYNCED
========================================================= */

export async function markManyPayrollEmployeeProfileSynced(
  companyId: string,
  profileIds: string[]
): Promise<void> {
  for (const profileId of profileIds) {
    await markPayrollEmployeeProfileSynced(companyId, profileId);
  }
}

/* =========================================================
   SOFT DELETE PROFILE
========================================================= */

export async function deleteEmployeePayrollProfile(
  companyId: string,
  _id: string
) {
  return transaction(async () => {
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

    console.log(
      "DELETED PAYROLL PROFILE TO SAVE TO SYNC QUEUE",
      payrollProfile
    );

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
  });
}

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
      enabled: row.enabled ?? 0,
      taxable: row.taxable,
      value: row.value ?? 0,
    });
  }

  return [...employees.values()];
}

export async function restoreEmployeePayrollProfile(
  companyId: string,
  _id: string
) {
  return transaction(async () => {
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
  });
}

export async function permanentlyDeleteEmployeePayrollProfile(
  companyId: string,
  _id: string
) {
  return transaction(async () => {
    await run(
      `
    DELETE FROM payroll_employee_profiles
    WHERE companyId = ?
      AND _id = ?
    `,
      [companyId, _id]
    );

    return true;
  });
}

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
