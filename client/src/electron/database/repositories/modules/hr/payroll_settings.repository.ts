import { randomUUID } from "crypto";
import { all, get, run } from "../../../db.js";
import { addToSyncQueue } from "../../shared/sync.repository.js";
import { PayrollSettings } from "../../../../../common/types/payroll/Payroll.js";

const ENTITY = "payroll_settings";

/**
 * Get the payroll settings for a specific company.
 *
 * Payroll settings are a singleton per company.
 */
export async function getPayrollSettings(
  companyId: string
): Promise<PayrollSettings | null> {
  const settings = await get<PayrollSettings>(
    `
    SELECT
      companyId,
      _id,
      currency,
      workingDays,
      workingHours,
      paymentDay,
      serverVersion,
      synced,
      createdAt,
      updatedAt,
      lastSyncedAt,
      isDeleted
    FROM payroll_settings
    WHERE companyId = ?
      AND COALESCE(isDeleted, 0) = 0
    ORDER BY createdAt ASC
    LIMIT 1
    `,
    [companyId]
  );

  return settings ?? null;
}

/**
 * Get payroll settings by ID, scoped to company.
 */
export async function getPayrollSettingsById(
  companyId: string,
  _id: string
): Promise<PayrollSettings | null> {
  const settings = await get<PayrollSettings>(
    `
    SELECT
      companyId,
      _id,
      currency,
      workingDays,
      workingHours,
      paymentDay,
      serverVersion,
      synced,
      createdAt,
      updatedAt,
      lastSyncedAt,
      isDeleted
    FROM payroll_settings
    WHERE _id = ?
      AND companyId = ?
    `,
    [_id, companyId]
  );

  return settings ?? null;
}

/**
 * Create payroll settings for a company.
 *
 * Payroll settings are a singleton per company.
 */
export async function createPayrollSettings(
  companyId: string,
  data: Omit<
    PayrollSettings,
    | "companyId"
    | "_id"
    | "synced"
    | "serverVersion"
    | "createdAt"
    | "updatedAt"
    | "lastSyncedAt"
    | "isDeleted"
  >
): Promise<PayrollSettings> {
  const existing = await getPayrollSettings(companyId);

  if (existing) {
    throw new Error("PAYROLL SETTINGS ALREADY EXIST FOR THIS COMPANY");
  }

  console.log("PAYROLL SETTINGS DATA", data);

  const _id = randomUUID();
  const now = new Date().toISOString();
  const serverVersion = 0;

  const settings: PayrollSettings = {
    companyId,
    _id,
    currency: data.currency,
    workingDays: data.workingDays,
    workingHours: data.workingHours,
    paymentDay: data.paymentDay,
    serverVersion,
    synced: 0,
    createdAt: now,
    updatedAt: now,
    isDeleted: 0,
  };

  await run(
    `
    INSERT INTO payroll_settings (
      companyId,
      _id,
      currency,
      workingDays,
      workingHours,
      paymentDay,
      serverVersion,
      synced,
      createdAt,
      updatedAt,
      isDeleted
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      settings.companyId,
      settings._id,
      settings.currency,
      settings.workingDays,
      settings.workingHours,
      settings.paymentDay,
      settings.serverVersion,
      settings.synced,
      settings.createdAt,
      settings.updatedAt,
      settings.isDeleted,
    ]
  );

  await addToSyncQueue({
    companyId: settings.companyId,
    entity: ENTITY,
    entityId: settings._id,
    operation: "create",
    payload: JSON.stringify(settings),
  });

  return settings;
}

/**
 * Upsert payroll settings received from the server.
 *
 * This function intentionally does NOT add the record
 * to the sync queue because it is a remote pull.
 */
export async function upsertPayrollSettings(
  settings: PayrollSettings
): Promise<PayrollSettings | null> {
  if (!settings) return null;

  console.log("SETTINGS TO UPSERT", settings);

  const existing = await getPayrollSettingsById(
    settings.companyId,
    settings._id
  );

  /*
   * Never overwrite a newer local server version with
   * an older version received from the server.
   */
  if (existing) {
    const localVersion = Number(existing.serverVersion ?? 0);
    const remoteVersion = Number(settings.serverVersion ?? 0);

    if (remoteVersion < localVersion) {
      console.log(
        `SKIPPING PAYROLL SETTINGS. LOCAL VERSION IS NEWER: ${settings._id}`,
        {
          localVersion,
          remoteVersion,
        }
      );

      return existing;
    }
  }

  await run(
    `
    INSERT INTO payroll_settings (
      companyId,
      _id,
      currency,
      workingDays,
      workingHours,
      paymentDay,
      serverVersion,
      synced,
      createdAt,
      updatedAt,
      lastSyncedAt,
      isDeleted
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

    ON CONFLICT(_id) DO UPDATE SET
      companyId = excluded.companyId,
      currency = excluded.currency,
      workingDays = excluded.workingDays,
      workingHours = excluded.workingHours,
      paymentDay = excluded.paymentDay,
      serverVersion = excluded.serverVersion,
      synced = excluded.synced,
      createdAt = excluded.createdAt,
      updatedAt = excluded.updatedAt,
      lastSyncedAt = excluded.lastSyncedAt,
      isDeleted = excluded.isDeleted
    `,
    [
      settings.companyId,
      settings._id,
      settings.currency,
      settings.workingDays,
      settings.workingHours,
      settings.paymentDay,
      settings.serverVersion ?? 0,
      settings.synced ?? 1,
      settings.createdAt,
      settings.updatedAt,
      settings.lastSyncedAt ?? null,
      settings.isDeleted ?? 0,
    ]
  );

  return settings;
}

/**
 * Update the complete payroll settings record.
 */
export async function updatePayrollSettings(
  companyId: string,
  settings: PayrollSettings
): Promise<PayrollSettings> {
  /*
   * Always verify both companyId and _id.
   */
  const existing = await getPayrollSettingsById(companyId, settings._id);

  if (!existing) {
    throw new Error(`PAYROLL SETTINGS ${settings._id} NOT FOUND`);
  }

  const updatedAt = new Date().toISOString();

  const updatedSettings: PayrollSettings = {
    ...settings,

    /*
     * Never allow the caller to change the tenant.
     */
    companyId,

    /*
     * Keep the server version that the client knows about.
     * The server will assign the new version after syncing.
     */
    serverVersion: existing.serverVersion ?? 0,

    updatedAt,
    synced: 0,
    isDeleted: 0,
  };

  await run(
    `
    UPDATE payroll_settings
    SET
      currency = ?,
      workingDays = ?,
      workingHours = ?,
      paymentDay = ?,
      serverVersion = ?,
      synced = ?,
      updatedAt = ?,
      isDeleted = ?
    WHERE _id = ?
      AND companyId = ?
    `,
    [
      updatedSettings.currency,
      updatedSettings.workingDays,
      updatedSettings.workingHours,
      updatedSettings.paymentDay,
      updatedSettings.serverVersion,
      updatedSettings.synced,
      updatedSettings.updatedAt,
      updatedSettings.isDeleted,
      updatedSettings._id,
      companyId,
    ]
  );

  await addToSyncQueue({
    companyId,
    entity: ENTITY,
    entityId: updatedSettings._id,
    operation: "update",
    payload: JSON.stringify(updatedSettings),
  });

  return updatedSettings;
}

/**
 * Update only selected payroll settings fields.
 */
export async function updatePayrollSettingsFields(
  companyId: string,
  _id: string,
  fields: Partial<
    Pick<
      PayrollSettings,
      "currency" | "workingDays" | "workingHours" | "paymentDay"
    >
  >
): Promise<PayrollSettings> {
  const existing = await getPayrollSettingsById(companyId, _id);

  if (!existing) {
    throw new Error(`PAYROLL SETTINGS ${_id} NOT FOUND`);
  }

  const updatedSettings: PayrollSettings = {
    ...existing,
    ...fields,

    /*
     * Keep the companyId from the existing record.
     */
    companyId,

    /*
     * Keep the current server version.
     */
    serverVersion: existing.serverVersion ?? 0,

    updatedAt: new Date().toISOString(),
    synced: 0,
    isDeleted: 0,
  };

  await run(
    `
    UPDATE payroll_settings
    SET
      currency = ?,
      workingDays = ?,
      workingHours = ?,
      paymentDay = ?,
      serverVersion = ?,
      synced = ?,
      updatedAt = ?,
      isDeleted = ?
    WHERE _id = ?
      AND companyId = ?
    `,
    [
      updatedSettings.currency,
      updatedSettings.workingDays,
      updatedSettings.workingHours,
      updatedSettings.paymentDay,
      updatedSettings.serverVersion,
      updatedSettings.synced,
      updatedSettings.updatedAt,
      updatedSettings.isDeleted,
      updatedSettings._id,
      companyId,
    ]
  );

  await addToSyncQueue({
    companyId,
    entity: ENTITY,
    entityId: updatedSettings._id,
    operation: "update",
    payload: JSON.stringify(updatedSettings),
  });

  return updatedSettings;
}

/**
 * Soft delete payroll settings.
 */
export async function deletePayrollSettings(
  companyId: string,
  _id: string
): Promise<void> {
  const existing = await getPayrollSettingsById(companyId, _id);

  if (!existing) {
    throw new Error(`PAYROLL SETTINGS ${_id} NOT FOUND`);
  }

  const updatedAt = new Date().toISOString();

  const deletedSettings: PayrollSettings = {
    ...existing,
    companyId,
    isDeleted: 1,
    synced: 0,
    serverVersion: existing.serverVersion ?? 0,
    updatedAt,
  };

  await run(
    `
    UPDATE payroll_settings
    SET
      isDeleted = 1,
      synced = 0,
      updatedAt = ?
    WHERE _id = ?
      AND companyId = ?
    `,
    [updatedAt, _id, companyId]
  );

  await addToSyncQueue({
    companyId,
    entity: ENTITY,
    entityId: _id,
    operation: "delete",
    payload: JSON.stringify(deletedSettings),
  });
}

/**
 * Restore payroll settings.
 */
export async function restorePayrollSettings(
  companyId: string,
  _id: string
): Promise<PayrollSettings> {
  const existing = await getPayrollSettingsById(companyId, _id);

  if (!existing) {
    throw new Error(`PAYROLL SETTINGS ${_id} NOT FOUND`);
  }

  const updatedAt = new Date().toISOString();

  const restoredSettings: PayrollSettings = {
    ...existing,
    companyId,
    isDeleted: 0,
    synced: 0,
    serverVersion: existing.serverVersion ?? 0,
    updatedAt,
  };

  await run(
    `
    UPDATE payroll_settings
    SET
      isDeleted = 0,
      synced = 0,
      updatedAt = ?
    WHERE _id = ?
      AND companyId = ?
    `,
    [updatedAt, _id, companyId]
  );

  await addToSyncQueue({
    companyId,
    entity: ENTITY,
    entityId: _id,
    operation: "update",
    payload: JSON.stringify(restoredSettings),
  });

  return restoredSettings;
}

/**
 * Mark payroll settings as synced.
 */
export async function markPayrollSettingsSynced(
  companyId: string,
  _id: string
): Promise<void> {
  const now = new Date().toISOString();

  await run(
    `
    UPDATE payroll_settings
    SET
      synced = 1,
      lastSyncedAt = ?
    WHERE _id = ?
      AND companyId = ?
    `,
    [now, _id, companyId]
  );
}

/**
 * Get unsynced payroll settings for a specific company.
 */
export async function getUnsyncedPayrollSettings(
  companyId: string
): Promise<PayrollSettings[]> {
  return all<PayrollSettings>(
    `
    SELECT
      companyId,
      _id,
      currency,
      workingDays,
      workingHours,
      paymentDay,
      serverVersion,
      synced,
      createdAt,
      updatedAt,
      lastSyncedAt,
      isDeleted
    FROM payroll_settings
    WHERE companyId = ?
      AND synced = 0
    ORDER BY updatedAt ASC
    `,
    [companyId]
  );
}
