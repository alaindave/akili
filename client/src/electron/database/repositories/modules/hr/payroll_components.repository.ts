import { all, get, run } from "../../../db.js";
import PayrollComponent, {
  CreatePayrollComponentDto,
} from "../../../../../common/types/payroll/PayrollComponent.js";
import { randomUUID } from "crypto";
import { addToSyncQueue } from "../../shared/sync.repository.js";
import {
  addPayrollComponentToAllEmployees,
  removeDeletedPayrollComponentsFromEmployeeProfiles,
  updatePayrollComponentDefaults,
} from "../../../../services/modules/hr/payroll/payrollProfile.service.js";

// ============================================================
// CREATE
// ============================================================

export async function createPayrollComponent(
  companyId: string,
  component: CreatePayrollComponentDto
): Promise<PayrollComponent | null> {
  if (!component.companyId) {
    throw new Error("Cannot create payroll component without companyId");
  }

  console.log("RECEIVED PAYROLL COMPONENT:", component);

  const _id = randomUUID();
  const now = new Date().toISOString();

  /*
   * serverVersion is NULL locally until the server accepts
   * the entity and assigns its first serverVersion.
   */
  await run(
    `
      INSERT INTO payroll_components (
        companyId,
        _id,
        name,
        displayName,
        displayOrder,
        type,
        calculationType,
        calculationBase,
        defaultValue,
        taxable,
        isSystem,
        requiresHRApproval,
        enabled,
        synced,
        createdAt,
        updatedAt,
        lastSyncedAt,
        isDeleted,
        serverVersion
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
    [
      companyId,
      _id,
      component.name,
      component.displayName,
      component.displayOrder,
      component.type,
      component.calculationType,
      component.calculationBase,
      component.defaultValue,
      component.taxable ?? 1,
      0,
      component.requiresHRApproval ?? 0,
      1,
      0,
      now,
      now,
      null,
      0,
      0,
    ]
  );

  const savedPayrollComponent = {
    _id,
    ...component,
    createdAt: now,
    updatedAt: now,
    serverVersion: 0,
    synced: 0,
    isDeleted: 0,
  };

  console.log("PAYROLL COMPONENT TO SAVE TO SYNC QUEUE", savedPayrollComponent);

  await addToSyncQueue({
    companyId: companyId,
    entity: "payroll_component",
    entityId: _id,
    operation: "create",
    payload: JSON.stringify(savedPayrollComponent),
  });

  const newComponent = await getPayrollComponentById(companyId, _id);

  // Add the new component to employee payroll profiles.
  if (newComponent) {
    await addPayrollComponentToAllEmployees(component.companyId, newComponent);
  }

  return newComponent;
}

// ============================================================
// UPSERT FROM SERVER
// ============================================================

export async function upsertPayrollComponent(component: PayrollComponent) {
  const companyId = component.companyId;

  if (!companyId) {
    throw new Error("Cannot upsert payroll component without companyId");
  }

  console.log("COMPONENT TO UPSERT:", component);

  const incomingServerVersion = component.serverVersion ?? 0;

  const existing = await get<{
    serverVersion: number | null;
    synced: number;
  }>(
    `
    SELECT
      serverVersion,
      synced
    FROM payroll_components
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, component._id]
  );

  /*
   * Never overwrite a newer local/server version.
   */
  if (
    existing &&
    Number(existing.serverVersion ?? 0) > Number(incomingServerVersion)
  ) {
    return;
  }

  /*
   * Never overwrite a local change that has not yet
   * been pushed to the server.
   */
  if (existing && existing.synced === 0) {
    return;
  }

  await run(
    `
    INSERT INTO payroll_components (
      companyId,
      _id,
      name,
      displayName,
      type,
      calculationType,
      calculationBase,
      defaultValue,
      taxable,
      displayOrder,
      isSystem,
      requiresHRApproval,
      enabled,
      synced,
      createdAt,
      updatedAt,
      lastSyncedAt,
      serverVersion,
      isDeleted
    )

    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)

    ON CONFLICT(_id)
    DO UPDATE SET
      name = excluded.name,
      displayName = excluded.displayName,
      type = excluded.type,
      calculationType = excluded.calculationType,
      calculationBase = excluded.calculationBase,
      defaultValue = excluded.defaultValue,
      taxable = excluded.taxable,
      displayOrder = excluded.displayOrder,
      isSystem = excluded.isSystem,
      requiresHRApproval = excluded.requiresHRApproval,
      enabled = excluded.enabled,
      synced = 1,
      createdAt = excluded.createdAt,
      updatedAt = excluded.updatedAt,
      lastSyncedAt = excluded.lastSyncedAt,
      serverVersion = excluded.serverVersion,
      isDeleted = excluded.isDeleted
    `,
    [
      companyId,
      component._id,
      component.name,
      component.displayName,
      component.type,
      component.calculationType,
      component.calculationBase,
      component.defaultValue,
      component.taxable ?? 1,
      component.displayOrder,
      component.isSystem,
      component.requiresHRApproval,
      component.enabled,
      1,
      component.createdAt,
      component.updatedAt,
      component.lastSyncedAt ?? null,
      incomingServerVersion,
      component.isDeleted ?? 0,
    ]
  );

  return await getPayrollComponentById(companyId, component._id);
}

// ============================================================
// GET BY ID
// ============================================================

export async function getPayrollComponentById(
  companyId: string,
  _id: string
): Promise<PayrollComponent | null> {
  return await get<PayrollComponent>(
    `
    SELECT *
    FROM payroll_components
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, _id]
  );
}

// ============================================================
// GET ENABLED COMPONENTS
// ============================================================

export async function getEnabledPayrollComponents(
  companyId: string,
  type?: "EARNING" | "DEDUCTION"
): Promise<PayrollComponent[]> {
  if (type) {
    return await all<PayrollComponent>(
      `
      SELECT *
      FROM payroll_components
      WHERE companyId = ?
        AND enabled = 1
        AND isDeleted = 0
        AND type = ?
      ORDER BY displayOrder
      `,
      [companyId, type]
    );
  }

  return await all<PayrollComponent>(
    `
    SELECT *
    FROM payroll_components
    WHERE companyId = ?
      AND enabled = 1
      AND isDeleted = 0
    ORDER BY displayOrder
    `,
    [companyId]
  );
}

// ============================================================
// GET ALL COMPONENTS
// ============================================================

export async function getPayrollComponents(
  companyId: string,
  type?: "EARNING" | "DEDUCTION"
): Promise<PayrollComponent[]> {
  if (type) {
    return await all<PayrollComponent>(
      `
      SELECT *
      FROM payroll_components
      WHERE companyId = ?
        AND isDeleted = 0
        AND type = ?
      ORDER BY displayOrder ASC
      `,
      [companyId, type]
    );
  }

  return await all<PayrollComponent>(
    `
    SELECT *
    FROM payroll_components
    WHERE companyId = ?
      AND isDeleted = 0
    ORDER BY displayOrder ASC
    `,
    [companyId]
  );
}

// ============================================================
// UPDATE
// ============================================================

export async function updatePayrollComponents(
  companyId: string,
  components: PayrollComponent[]
) {
  if (!companyId) {
    throw new Error("Cannot update payroll components without companyId");
  }

  console.log("COMPONENTS TO UPDATE:", components);

  for (const component of components) {
    const updatedAt = new Date().toISOString();

    await run(
      `
      UPDATE payroll_components
      SET
        name = ?,
        displayName = ?,
        displayOrder = ?,
        type = ?,
        calculationType = ?,
        calculationBase = ?,
        defaultValue = ?,
        taxable = ?,
        requiresHRApproval = ?,
        enabled = ?,
        synced = 0,
        updatedAt = ?
      WHERE companyId = ?
        AND _id = ?
      `,
      [
        component.name,
        component.displayName,
        component.displayOrder,
        component.type,
        component.calculationType,
        component.calculationBase,
        component.defaultValue,
        component.taxable ?? 1,
        component.requiresHRApproval ?? 0,
        component.enabled,
        updatedAt,
        companyId,
        component._id,
      ]
    );

    /*
     * Preserve the last serverVersion known by the client.
     * The server will allocate a new version when this update
     * is accepted.
     */
    const updatedPayrollComponent = {
      ...component,
      companyId,
      _id: component._id,
      updatedAt,
      serverVersion: component.serverVersion ?? null,
      synced: 0,
    };

    console.log(
      "PAYROLL COMPONENT TO SAVE TO SYNC QUEUE",
      updatedPayrollComponent
    );

    await addToSyncQueue({
      companyId,
      entity: "payroll_component",
      entityId: component._id,
      operation: "update",
      payload: JSON.stringify(updatedPayrollComponent),
    });

    // Update employee payroll profiles.
    await updatePayrollComponentDefaults(companyId, updatedPayrollComponent);
  }

  return components;
}

// ============================================================
// DELETE
// ============================================================

export async function deletePayrollComponent(companyId: string, _id: string) {
  if (!companyId) {
    throw new Error("Cannot delete payroll component without companyId");
  }

  const updatedAt = new Date().toISOString();

  /*
   * Get the component before soft deleting it so that
   * its existing serverVersion can be sent to the server.
   */
  const component = await getPayrollComponentById(companyId, _id);

  if (!component) {
    throw new Error(`PAYROLL COMPONENT NOT FOUND: ${_id}`);
  }

  await run(
    `
    UPDATE payroll_components
    SET
      isDeleted = 1,
      synced = 0,
      updatedAt = ?
    WHERE companyId = ?
      AND _id = ?
    `,
    [updatedAt, companyId, _id]
  );

  console.log("PAYROLL COMPONENT DELETION:", {
    companyId,
    _id,
    deleted: true,
    updatedAt,
    serverVersion: component.serverVersion ?? null,
  });

  await removeDeletedPayrollComponentsFromEmployeeProfiles(companyId);

  await addToSyncQueue({
    companyId,
    entity: "payroll_component",
    entityId: _id,
    operation: "delete",
    payload: JSON.stringify({
      companyId,
      _id,
      updatedAt,
      serverVersion: component.serverVersion ?? null,
      isDeleted: 1,
    }),
  });

  return true;
}

// ============================================================
// ENABLE
// ============================================================

export async function enablePayrollComponent(companyId: string, id: string) {
  const updatedAt = new Date().toISOString();

  const component = await getPayrollComponentById(companyId, id);

  if (!component) {
    throw new Error(`PAYROLL COMPONENT NOT FOUND: ${id}`);
  }

  await run(
    `
    UPDATE payroll_components
    SET
      enabled = 1,
      synced = 0,
      updatedAt = ?
    WHERE companyId = ?
      AND _id = ?
    `,
    [updatedAt, companyId, id]
  );

  const updatedComponent = {
    ...component,
    companyId,
    enabled: 1,
    updatedAt,
    synced: 0,
    serverVersion: component.serverVersion ?? null,
  };

  await addToSyncQueue({
    companyId,
    entity: "payroll_component",
    entityId: id,
    operation: "update",
    payload: JSON.stringify(updatedComponent),
  });

  return getPayrollComponentById(companyId, id);
}

// ============================================================
// DISABLE
// ============================================================

export async function disablePayrollComponent(companyId: string, id: string) {
  const updatedAt = new Date().toISOString();

  const component = await getPayrollComponentById(companyId, id);

  if (!component) {
    throw new Error(`PAYROLL COMPONENT NOT FOUND: ${id}`);
  }

  await run(
    `
    UPDATE payroll_components
    SET
      enabled = 0,
      synced = 0,
      updatedAt = ?
    WHERE companyId = ?
      AND _id = ?
    `,
    [updatedAt, companyId, id]
  );

  const updatedComponent = {
    ...component,
    companyId,
    enabled: 0,
    updatedAt,
    synced: 0,
    serverVersion: component.serverVersion ?? null,
  };

  await addToSyncQueue({
    companyId,
    entity: "payroll_component",
    entityId: id,
    operation: "update",
    payload: JSON.stringify(updatedComponent),
  });

  return getPayrollComponentById(companyId, id);
}

// ============================================================
// MARK SYNCED
// ============================================================

export async function markPayrollComponentSynced(
  companyId: string,
  _id: string,
  serverVersion?: number
) {
  await run(
    `
    UPDATE payroll_components
    SET
      synced = 1,
      lastSyncedAt = ?,
      serverVersion = COALESCE(
        ?,
        serverVersion
      )
    WHERE companyId = ?
      AND _id = ?
    `,
    [new Date().toISOString(), serverVersion ?? null, companyId, _id]
  );

  return true;
}

// ============================================================
// GET UNSYNCED COMPONENTS
// ============================================================

export async function getUnsyncedPayrollComponents(
  companyId: string
): Promise<PayrollComponent[]> {
  return await all<PayrollComponent>(
    `
    SELECT *
    FROM payroll_components
    WHERE companyId = ?
      AND synced = 0
      AND isDeleted = 0
    ORDER BY updatedAt ASC
    `,
    [companyId]
  );
}
