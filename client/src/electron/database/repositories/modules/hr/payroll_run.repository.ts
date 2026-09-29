import { randomUUID } from "crypto";
import {
  run,
  get,
  all,
  transaction,
  runDirect,
  getDirect,
  allDirect,
} from "../../../db.js";

import {
  PayrollBatchResult,
  PayrollResult,
  PayrollItem,
  PayrollRun,
  PayrollStatus,
} from "../../../../../common/types/payroll/Payroll.js";
import AdminUser from "../../../../../common/types/AdminUser.js";
import {
  addToSyncQueue,
  notifyPendingChanges,
} from "../../shared/sync.repository.js";
import { createAuditLog } from "../../shared/audit_log.repository.js";
import { PayrollRunDto } from "../../../../preload/hr/payroll_run.preload.cjs";

function getAdminName(
  admin: Pick<AdminUser, "firstName" | "lastName">
): string {
  return `${admin.firstName} ${admin.lastName}`.trim();
}

async function createPayrollStatusAudit(
  companyId: string,
  payrollRunId: string,
  admin: AdminUser,
  from: PayrollStatus,
  to: PayrollStatus,
  description: string,
  withinTransaction = false
): Promise<void> {
  await createAuditLog({
    companyId,
    userId: admin._id,
    userName: getAdminName(admin),
    action: "UPDATE",
    entity: "PAYROLL_RUN",
    entityId: payrollRunId,
    description,
    changes: { status: { from, to } },
  }, withinTransaction);
}

// ============================================================
// CREATE PAYROLL RUN
// ============================================================

export async function createPayrollRun(
  input: PayrollBatchResult,
  payrollRunDto: PayrollRunDto
) {
  if (!payrollRunDto.companyId) {
    throw new Error("Company ID is required.");
  }

  // ----------------------------------------------------------
  // Validate payroll period
  // ----------------------------------------------------------

  if (
    !Number.isInteger(payrollRunDto.month) ||
    payrollRunDto.month < 1 ||
    payrollRunDto.month > 12
  ) {
    throw new Error("Invalid payroll month. Month must be between 1 and 12.");
  }

  if (
    !Number.isInteger(payrollRunDto.year) ||
    payrollRunDto.year < 2000 ||
    payrollRunDto.year > 2100
  ) {
    throw new Error("Invalid payroll year.");
  }

  const now = new Date().toISOString();

  // ----------------------------------------------------------
  // Prevent duplicate payroll runs for THIS COMPANY
  // ----------------------------------------------------------

  const existingPayrollRun = await get<PayrollRun>(
    `
    SELECT *
    FROM payroll_runs
    WHERE companyId = ?
      AND year = ?
      AND month = ?
      AND isDeleted = 0
      AND status <> 'ANNULÉ'
    LIMIT 1
    `,
    [payrollRunDto.companyId, payrollRunDto.year, payrollRunDto.month]
  );

  if (existingPayrollRun) {
    throw new Error(
      `Une fiche de paye existe déjà pour ${payrollRunDto.month}/${payrollRunDto.year}.`
    );
  }

  // ----------------------------------------------------------
  // Create payroll run
  // ----------------------------------------------------------

  const payrollRun: PayrollRun = {
    _id: randomUUID(),
    companyId: payrollRunDto.companyId,
    managerEmail: payrollRunDto.managerEmail,
    generatedBy: payrollRunDto.admin._id,
    month: payrollRunDto.month,
    year: payrollRunDto.year,
    employeeCount: input.employeeCount,
    totalBasicSalary: input.totalBasicSalary,
    totalEarnings: input.totalEarnings,
    totalDeductions: input.totalDeductions,
    totalNetSalary: input.totalNetSalary,
    status: "BROUILLON",
    serverVersion: 0,
    synced: 0,
    createdAt: now,
    updatedAt: now,
    isDeleted: 0,
  };

  await transaction(async () => {
    await runDirect(
      `
      INSERT INTO payroll_runs (
        companyId,
        _id,
        generatedBy,
        month,
        year,
        employeeCount,
        totalBasicSalary,
        totalEarnings,
        totalDeductions,
        totalNetSalary,
        status,
        serverVersion,
        synced,
        createdAt,
        updatedAt,
        isDeleted
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payrollRun.companyId,
        payrollRun._id,
        payrollRun.generatedBy,
        payrollRun.month,
        payrollRun.year,
        payrollRun.employeeCount,
        payrollRun.totalBasicSalary,
        payrollRun.totalEarnings,
        payrollRun.totalDeductions,
        payrollRun.totalNetSalary,
        payrollRun.status,
        payrollRun.serverVersion,
        payrollRun.synced,
        payrollRun.createdAt,
        payrollRun.updatedAt,
        payrollRun.isDeleted,
      ]
    );

    await addToSyncQueue({
      companyId: payrollRun.companyId,
      entity: "payroll_run",
      entityId: payrollRun._id,
      operation: "create",
      payload: JSON.stringify(payrollRun),
    }, true);
  });
  await notifyPendingChanges(payrollRun.companyId);

  await createAuditLog({
    companyId: payrollRun.companyId,
    userId: payrollRunDto.admin._id,
    userName: getAdminName(payrollRunDto.admin),
    action: "CREATE",
    entity: "PAYROLL_RUN",
    entityId: payrollRun._id,
    description: "Création de la paie",
  });

  return payrollRun;
}

// ============================================================
// GET PAYROLL RUNS
// ============================================================

export async function getPayrollRuns(
  companyId: string,
  year: number,
  month: number
) {
  return await all<PayrollRun>(
    `
    SELECT
      pr.*,
      gen.firstName || ' ' || gen.lastName AS generatedByName
    FROM payroll_runs pr
    LEFT JOIN admin_users gen
      ON pr.generatedBy = gen._id
      AND gen.companyId = pr.companyId
    WHERE pr.companyId = ?
      AND pr.isDeleted = 0
      AND pr.year = ?
      AND pr.month = ?
    ORDER BY pr.createdAt DESC
    `,
    [companyId, year, month]
  );
}

// ============================================================
// GET PAYROLL RUN BY ID
// ============================================================

export async function getPayrollRunById(companyId: string, _id: string) {
  return await get<PayrollRun>(
    `
    SELECT
      pr.*,

      gen.firstName || ' ' || gen.lastName
        AS generatedByName,

      can.firstName || ' ' || can.lastName
        AS cancelledByName,

      ver.firstName || ' ' || ver.lastName
        AS submittedForVerificationByName,

      app.firstName || ' ' || app.lastName
        AS approvedByName,

      paid.firstName || ' ' || paid.lastName
        AS paidByName

    FROM payroll_runs pr

    LEFT JOIN admin_users gen
      ON pr.generatedBy = gen._id
      AND gen.companyId = pr.companyId

    LEFT JOIN admin_users can
      ON pr.cancelledBy = can._id
      AND can.companyId = pr.companyId

    LEFT JOIN admin_users ver
      ON pr.submittedForVerificationBy = ver._id
      AND ver.companyId = pr.companyId

    LEFT JOIN admin_users app
      ON pr.approvedBy = app._id
      AND app.companyId = pr.companyId

    LEFT JOIN admin_users paid
      ON pr.paidBy = paid._id
      AND paid.companyId = pr.companyId

    WHERE pr.companyId = ?
      AND pr._id = ?
    LIMIT 1
    `,
    [companyId, _id]
  );
}

// ============================================================
// GET PAYROLL RUN BY STATUS
// ============================================================

export async function getPayrollRunsByStatus(
  companyId: string,
  status: PayrollStatus
) {
  return await get<PayrollRun>(
    `
    SELECT
      pr.*,
      gen.firstName || ' ' || gen.lastName AS generatedByName
    FROM payroll_runs pr
    LEFT JOIN admin_users gen
      ON pr.generatedBy = gen._id
      AND gen.companyId = pr.companyId
    WHERE pr.companyId = ?
      AND pr.status = ?
      AND pr.isDeleted = 0
    ORDER BY pr.createdAt DESC
    LIMIT 1
    `,
    [companyId, status]
  );
}

// ============================================================
// UPSERT PAYROLL RUN FROM SERVER
// ============================================================

export async function upsertPayrollRun(
  companyId: string,
  payrollRun: PayrollRun
) {
  return transaction(async () => {
    const apply = async () => {
      if (!companyId) {
        throw new Error("Company ID is required.");
      }

      if (payrollRun.companyId !== companyId) {
        throw new Error(
          "Payroll run companyId does not match the requested companyId."
        );
      }

      console.log("PAYROLL RUN TO UPSERT", payrollRun);

      // ----------------------------------------------------------
      // 1. Look for canonical ID INSIDE THIS COMPANY
      // ----------------------------------------------------------

      const existingById = await getDirect<
        PayrollRun & {
          synced: number;
          serverVersion: number;
        }
      >(
        `
        SELECT *
        FROM payroll_runs
        WHERE companyId = ?
          AND _id = ?
        LIMIT 1
        `,
        [companyId, payrollRun._id]
      );

      if (existingById) {
        // Never overwrite pending local changes.
        if (existingById.synced === 0) {
          console.log(
            `SKIPPING PAYROLL RUN PULL. LOCAL CHANGES ARE PENDING: ${payrollRun._id}`
          );

          return false;
        }

        // ServerVersion is the source of truth.
        if (
          payrollRun.serverVersion &&
          payrollRun.serverVersion <= (existingById.serverVersion ?? 0)
        ) {
          console.log(
            `SKIPPING PAYROLL RUN PULL. LOCAL SERVER VERSION IS NEWER/EQUAL: ${payrollRun._id}`,
            {
              local: existingById.serverVersion,
              remote: payrollRun.serverVersion,
            }
          );

          return existingById;
        }

        await runDirect(
          `
          UPDATE payroll_runs
          SET
            generatedBy = ?,
            month = ?,
            year = ?,
            employeeCount = ?,
            totalBasicSalary = ?,
            totalEarnings = ?,
            totalDeductions = ?,
            totalNetSalary = ?,
            status = ?,
            cancelledBy = ?,
            cancelledAt = ?,
            submittedForVerificationBy = ?,
            submittedForVerificationAt = ?,
            approvedBy = ?,
            approvedAt = ?,
            paidBy = ?,
            paidAt = ?,
            serverVersion = ?,
            synced = 1,
            createdAt = ?,
            updatedAt = ?,
            isDeleted = ?
          WHERE companyId = ?
            AND _id = ?
          `,
          [
            payrollRun.generatedBy,
            payrollRun.month,
            payrollRun.year,
            payrollRun.employeeCount,
            payrollRun.totalBasicSalary,
            payrollRun.totalEarnings,
            payrollRun.totalDeductions,
            payrollRun.totalNetSalary,
            payrollRun.status,
            payrollRun.cancelledBy ?? null,
            payrollRun.cancelledAt ?? null,
            payrollRun.submittedForVerificationBy ?? null,
            payrollRun.submittedForVerificationAt ?? null,
            payrollRun.approvedBy ?? null,
            payrollRun.approvedAt ?? null,
            payrollRun.paidBy ?? null,
            payrollRun.paidAt ?? null,
            payrollRun.serverVersion,
            payrollRun.createdAt,
            payrollRun.updatedAt,
            payrollRun.isDeleted ?? 0,
            companyId,
            payrollRun._id,
          ]
        );

        return true;
      }

      // ----------------------------------------------------------
      // No canonical ID match: insert the distinct payroll run.
      // ----------------------------------------------------------

      await runDirect(
        `
        INSERT INTO payroll_runs (
          companyId,
          _id,
          generatedBy,
          month,
          year,
          employeeCount,
          totalBasicSalary,
          totalEarnings,
          totalDeductions,
          totalNetSalary,
          status,
          cancelledBy,
          cancelledAt,
          submittedForVerificationBy,
          submittedForVerificationAt,
          approvedBy,
          approvedAt,
          paidBy,
          paidAt,
          serverVersion,
          synced,
          createdAt,
          updatedAt,
          isDeleted
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, 1, ?, ?, ?
        )
        `,
        [
          payrollRun.companyId,
          payrollRun._id,
          payrollRun.generatedBy,
          payrollRun.month,
          payrollRun.year,
          payrollRun.employeeCount,
          payrollRun.totalBasicSalary,
          payrollRun.totalEarnings,
          payrollRun.totalDeductions,
          payrollRun.totalNetSalary,
          payrollRun.status,
          payrollRun.cancelledBy ?? null,
          payrollRun.cancelledAt ?? null,
          payrollRun.submittedForVerificationBy ?? null,
          payrollRun.submittedForVerificationAt ?? null,
          payrollRun.approvedBy ?? null,
          payrollRun.approvedAt ?? null,
          payrollRun.paidBy ?? null,
          payrollRun.paidAt ?? null,
          payrollRun.serverVersion,
          payrollRun.createdAt,
          payrollRun.updatedAt,
          payrollRun.isDeleted ?? 0,
        ]
      );

      return true;
    };
    return apply();
  });
}

// ============================================================
// UPSERT PAYROLL RESULT FROM SERVER
// ============================================================

export async function upsertPayrollResult(
  companyId: string,
  payrollResult: PayrollResult
) {
  return transaction(async () => {
    const apply = async () => {
      if (!companyId) {
        throw new Error("Company ID is required.");
      }

      if (payrollResult.companyId !== companyId) {
        throw new Error(
          "Payroll result companyId does not match the requested companyId."
        );
      }

      console.log("PAYROLL RESULT TO UPSERT", payrollResult);

      // ----------------------------------------------------------
      // Look for canonical ID INSIDE THIS COMPANY
      // ----------------------------------------------------------

      const existingById = await getDirect<
        PayrollResult & {
          synced: number;
          serverVersion: number;
        }
      >(
        `
        SELECT *
        FROM payroll_results
        WHERE companyId = ?
          AND _id = ?
        LIMIT 1
        `,
        [companyId, payrollResult._id]
      );

      if (existingById) {
        if (existingById.synced === 0) {
          console.log(
            `SKIPPING PAYROLL RESULT PULL. LOCAL CHANGES ARE PENDING: ${payrollResult._id}`
          );

          return false;
        }

        if (
          payrollResult.serverVersion &&
          payrollResult.serverVersion < (existingById.serverVersion ?? 0)
        ) {
          console.log(
            `SKIPPING PAYROLL RESULT PULL. LOCAL SERVER VERSION IS NEWER/EQUAL: ${payrollResult._id}`,
            {
              local: existingById.serverVersion,
              remote: payrollResult.serverVersion,
            }
          );

          return existingById;
        }

        await runDirect(
          `
          UPDATE payroll_results
          SET
            payrollRunId = ?,
            employeeId = ?,
            month = ?,
            year = ?,
            baseSalary = ?,
            grossSalary = ?,
            totalEarnings = ?,
            totalDeductions = ?,
            netSalary = ?,
            status = ?,
            cancelledAt = ?,
            verifiedAt = ?,
            approvedBy = ?,
            paidBy = ?,
            approvedAt = ?,
            paidAt = ?,
            serverVersion = ?,
            createdAt = ?,
            updatedAt = ?,
            synced = 1,
            isDeleted = ?
          WHERE companyId = ?
            AND _id = ?
          `,
          [
            payrollResult.payrollRunId,
            payrollResult.employeeId,
            payrollResult.month,
            payrollResult.year,
            payrollResult.baseSalary,
            payrollResult.grossSalary,
            payrollResult.totalEarnings,
            payrollResult.totalDeductions,
            payrollResult.netSalary,
            payrollResult.status,
            payrollResult.cancelledAt ?? null,
            payrollResult.verifiedAt ?? null,
            payrollResult.approvedBy ?? null,
            payrollResult.paidBy ?? null,
            payrollResult.approvedAt ?? null,
            payrollResult.paidAt ?? null,
            payrollResult.serverVersion,
            payrollResult.createdAt,
            payrollResult.updatedAt,
            payrollResult.isDeleted ?? 0,
            companyId,
            payrollResult._id,
          ]
        );

        return true;
      }

      // ----------------------------------------------------------
      // Insert the distinct server payroll result without changing local IDs.
      // ----------------------------------------------------------

      await runDirect(
        `
        INSERT INTO payroll_results (
          companyId,
          _id,
          payrollRunId,
          employeeId,
          month,
          year,
          baseSalary,
          grossSalary,
          totalEarnings,
          totalDeductions,
          netSalary,
          status,
          cancelledAt,
          verifiedAt,
          approvedBy,
          paidBy,
          approvedAt,
          paidAt,
          serverVersion,
          createdAt,
          updatedAt,
          synced,
          isDeleted
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?
        )
        `,
        [
          payrollResult.companyId,
          payrollResult._id,
          payrollResult.payrollRunId,
          payrollResult.employeeId,
          payrollResult.month,
          payrollResult.year,
          payrollResult.baseSalary,
          payrollResult.grossSalary,
          payrollResult.totalEarnings,
          payrollResult.totalDeductions,
          payrollResult.netSalary,
          payrollResult.status,
          payrollResult.cancelledAt ?? null,
          payrollResult.verifiedAt ?? null,
          payrollResult.approvedBy ?? null,
          payrollResult.paidBy ?? null,
          payrollResult.approvedAt ?? null,
          payrollResult.paidAt ?? null,
          payrollResult.serverVersion,
          payrollResult.createdAt,
          payrollResult.updatedAt,
          payrollResult.isDeleted ?? 0,
        ]
      );

      return true;
    };
    return apply();
  });
}

// ============================================================
// UPSERT PAYROLL ITEM FROM SERVER
// ============================================================

export async function upsertPayrollItem(
  companyId: string,
  payrollItem: PayrollItem
) {
  return transaction(async () => {
    const apply = async () => {
      if (!companyId) {
        throw new Error("Company ID is required.");
      }

      if (payrollItem.companyId !== companyId) {
        throw new Error(
          "Payroll item companyId does not match the requested companyId."
        );
      }

      const existing = await getDirect<
        PayrollItem & {
          synced: number;
          serverVersion: number;
        }
      >(
        `
        SELECT *
        FROM payroll_items
        WHERE companyId = ?
          AND _id = ?
        LIMIT 1
        `,
        [companyId, payrollItem._id]
      );

      if (existing) {
        if (existing.synced === 0) {
          console.log(
            `SKIPPING PAYROLL ITEM PULL. LOCAL CHANGES ARE PENDING: ${payrollItem._id}`
          );

          return false;
        }

        if (
          payrollItem.serverVersion &&
          payrollItem.serverVersion <= (existing.serverVersion ?? 0)
        ) {
          console.log(
            `SKIPPING PAYROLL ITEM PULL. LOCAL SERVER VERSION IS NEWER/EQUAL: ${payrollItem._id}`
          );

          return existing;
        }
      }

      await runDirect(
        `
        INSERT INTO payroll_items (
          companyId,
          _id,
          payrollResultId,
          employeeId,
          componentId,
          name,
          displayName,
          type,
          amount,
          serverVersion,
          createdAt,
          updatedAt,
          synced,
          isDeleted
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, 1, ?
        )
        ON CONFLICT(_id)
        DO UPDATE SET
          companyId = excluded.companyId,
          payrollResultId = excluded.payrollResultId,
          employeeId = excluded.employeeId,
          componentId = excluded.componentId,
          name = excluded.name,
          displayName = excluded.displayName,
          type = excluded.type,
          amount = excluded.amount,
          serverVersion = excluded.serverVersion,
          createdAt = excluded.createdAt,
          updatedAt = excluded.updatedAt,
          synced = 1,
          isDeleted = excluded.isDeleted
        WHERE payroll_items.companyId = excluded.companyId
        `,
        [
          payrollItem.companyId,
          payrollItem._id,
          payrollItem.payrollResultId,
          payrollItem.employeeId,
          payrollItem.componentId,
          payrollItem.name,
          payrollItem.displayName ?? null,
          payrollItem.type,
          payrollItem.amount,
          payrollItem.serverVersion,
          payrollItem.createdAt,
          payrollItem.updatedAt,
          payrollItem.isDeleted ?? 0,
        ]
      );

      return true;
    };
    return apply();
  });
}

// ============================================================
// UPDATE PAYROLL STATUS
// ============================================================

export async function updatePayrollStatus(
  companyId: string,
  payrollRunId: string,
  status: PayrollStatus
) {
  if (!companyId) throw new Error("Company ID is required.");
  if (status !== "BROUILLON")
    throw new Error("Utilisez les actions individuelles des bulletins.");
  await transaction(async () => {
    const payrollRun = await getDirect<PayrollRun>(
      "SELECT * FROM payroll_runs WHERE companyId = ? AND _id = ? AND isDeleted = 0",
      [companyId, payrollRunId]
    );
    if (!payrollRun || payrollRun.status === "ANNULÉ")
      throw new Error("Paie introuvable ou annulée.");
    const results = await allDirect<PayrollResult>(
      "SELECT * FROM payroll_results WHERE companyId = ? AND payrollRunId = ? AND isDeleted = 0",
      [companyId, payrollRunId]
    );
    if (results.some((r) => r.status === "APPROUVÉ" || r.status === "PAYÉ")) {
      throw new Error(
        "Cette paie contient des bulletins déjà approuvés ou payés."
      );
    }
    const now = new Date().toISOString();
    await runDirect(
      "UPDATE payroll_runs SET status = ?, updatedAt = ?, synced = 0 WHERE companyId = ? AND _id = ?",
      [status, now, companyId, payrollRunId]
    );
    await runDirect(
      "UPDATE payroll_results SET status = ?, updatedAt = ?, synced = 0 WHERE companyId = ? AND payrollRunId = ? AND isDeleted = 0",
      [status, now, companyId, payrollRunId]
    );
    await addToSyncQueue(
      {
        companyId,
        entity: "payroll_run",
        entityId: payrollRunId,
        operation: "update",
        payload: JSON.stringify({ ...payrollRun, status, updatedAt: now }),
      },
      true
    );
    for (const result of results) {
      await addToSyncQueue(
        {
          companyId,
          entity: "payroll_result",
          entityId: result._id!,
          operation: "update",
          payload: JSON.stringify({ ...result, status, updatedAt: now }),
        },
        true
      );
    }
  });
  await notifyPendingChanges(companyId);
  return true;
}

// ============================================================
// CANCEL PAYROLL RUN
// ============================================================

export async function getProcessedPayrollRuns(companyId: string) {
  if (!companyId) throw new Error("Company ID is required.");
  return all<PayrollRun>(
    `SELECT * FROM payroll_runs WHERE companyId = ? AND isDeleted = 0
     AND status IN ('APPROUVÉ', 'PAYÉ') ORDER BY year DESC, month DESC, createdAt DESC`,
    [companyId]
  );
}

export function cancelPayrollRun(companyId: string, payrollRunId: string, admin: AdminUser) {
  return cancelRun(companyId, payrollRunId, admin, false);
}

export function cancelProcessedPayrollRun(companyId: string, payrollRunId: string, admin: AdminUser) {
  return cancelRun(companyId, payrollRunId, admin, true);
}

async function cancelRun(
  companyId: string, payrollRunId: string, admin: AdminUser, fromSettings: boolean
) {
  if (!companyId || admin.companyId !== companyId || !["ADMIN", "MANAGER"].includes(admin.role)) {
    throw new Error("Seul un administrateur ou un responsable de cette entreprise peut annuler la paie.");
  }
  await transaction(async () => {
    const payrollRun = await getDirect<PayrollRun>(
      "SELECT * FROM payroll_runs WHERE companyId = ? AND _id = ? AND isDeleted = 0",
      [companyId, payrollRunId]
    );
    if (!payrollRun) throw new Error("Paie introuvable.");
    if (payrollRun.status === "ANNULÉ") return;
    if (fromSettings && !["APPROUVÉ", "PAYÉ"].includes(payrollRun.status)) {
      throw new Error("Sélectionnez une paie approuvée ou payée.");
    }
    const results = await allDirect<PayrollResult>(
      "SELECT * FROM payroll_results WHERE companyId = ? AND payrollRunId = ? AND isDeleted = 0",
      [companyId, payrollRunId]
    );
    if (!fromSettings && results.some((result) => ["APPROUVÉ", "PAYÉ"].includes(result.status))) {
      throw new Error("Utilisez les paramètres de paie pour annuler une paie approuvée ou payée.");
    }
    const now = new Date().toISOString();
    await runDirect(
      `UPDATE payroll_runs SET status = 'ANNULÉ', cancelledBy = ?, cancelledAt = ?, updatedAt = ?, synced = 0
       WHERE companyId = ? AND _id = ?`,
      [admin._id, now, now, companyId, payrollRunId]
    );
    await runDirect(
      `UPDATE payroll_results SET status = 'ANNULÉ', cancelledAt = ?, updatedAt = ?, synced = 0
       WHERE companyId = ? AND payrollRunId = ? AND isDeleted = 0`,
      [now, now, companyId, payrollRunId]
    );
    await addToSyncQueue({
      companyId, entity: "payroll_run", entityId: payrollRunId, operation: "update",
      payload: JSON.stringify({ ...payrollRun, status: "ANNULÉ", cancelledBy: admin._id,
        cancelledAt: now, updatedAt: now, cancellationFromSettings: fromSettings }),
    }, true);
    for (const result of results) {
      await addToSyncQueue({
        companyId, entity: "payroll_result", entityId: result._id!, operation: "update",
        payload: JSON.stringify({ ...result, status: "ANNULÉ", cancelledAt: now, updatedAt: now }),
      }, true);
    }
    await createAuditLog({
      companyId, userId: admin._id, userName: getAdminName(admin), action: "UPDATE",
      entity: "PAYROLL_RUN", entityId: payrollRunId,
      description: fromSettings ? "Annulation de la paie depuis les paramètres" : "Annulation de la paie",
      changes: { status: { from: payrollRun.status, to: "ANNULÉ" } },
    }, true);
  });
  await notifyPendingChanges(companyId);
  return true;
}

// ============================================================
// VERIFY PAYROLL RUN
// ============================================================

export async function verifyPayrollRun(
  companyId: string,
  managerEmail: string,
  payrollRunId: string,
  admin: AdminUser
) {
  if (!companyId) {
    throw new Error("Company ID is required.");
  }

  const now = new Date().toISOString();

  await transaction(async () => {
    const payrollRun: PayrollRun | null = await getDirect(
      `
      SELECT *
      FROM payroll_runs
      WHERE companyId = ?
        AND _id = ?
        AND isDeleted = 0
      LIMIT 1
      `,
      [companyId, payrollRunId]
    );

    if (!payrollRun) {
      throw new Error(`Payroll run not found for company: ${payrollRunId}`);
    }

    const results = await allDirect<{ _id: string }>(
      `
      SELECT *
      FROM payroll_results
      WHERE companyId = ?
        AND payrollRunId = ?
        AND isDeleted = 0
      `,
      [companyId, payrollRunId]
    );

    if (payrollRun.status !== "BROUILLON") {
      throw new Error("Seule une paie en brouillon peut être soumise à vérification.");
    }

    const processed = await getDirect<{ _id: string }>(
      "SELECT _id FROM payroll_results WHERE companyId = ? AND payrollRunId = ? AND isDeleted = 0 AND status IN ('APPROUVÉ', 'PAYÉ') LIMIT 1",
      [companyId, payrollRunId]
    );
    if (processed)
      throw new Error(
        "Cette paie contient des bulletins déjà approuvés ou payés."
      );

    await runDirect(
      `
      UPDATE payroll_runs
      SET
        status = ?,
        submittedForVerificationBy = ?,
        submittedForVerificationAt = ?,
        updatedAt = ?,
        synced = 0
      WHERE companyId = ?
        AND _id = ?
      `,
      ["VERIFICATION", admin._id, now, now, companyId, payrollRunId]
    );

    await runDirect(
      `
      UPDATE payroll_results
      SET
        status = ?,
        verifiedAt = ?,
        updatedAt = ?,
        synced = 0
      WHERE companyId = ?
        AND payrollRunId = ?
        AND isDeleted = 0
      `,
      ["VERIFICATION", now, now, companyId, payrollRunId]
    );

    await addToSyncQueue({
      companyId,
      entity: "payroll_run",
      entityId: payrollRunId,
      operation: "update",
      payload: JSON.stringify({
        ...payrollRun,
        managerEmail,
        status: "VERIFICATION",
        submittedForVerificationBy: admin._id,
        submittedForVerificationAt: now,
        updatedAt: now,
      }),
    }, true);

    for (const result of results) {
      await addToSyncQueue({
        companyId,
        entity: "payroll_result",
        entityId: result._id,
        operation: "update",
        payload: JSON.stringify({
          _id: result._id,
          companyId,
          payrollRunId,
          managerEmail,
          status: "VERIFICATION",
          verifiedAt: now,
          updatedAt: now,
        }),
      }, true);
    }

    await createPayrollStatusAudit(
      companyId,
      payrollRunId,
      admin,
      payrollRun.status,
      "VERIFICATION",
      "Modification du statut de la paie",
      true
    );
  });
  await notifyPendingChanges(companyId);

  return true;
}

// Run status is derived from all active payslips, including those outside UI filters.
// This helper runs inside the database transaction owned by its caller.
async function refreshPayrollRunStatus(
  companyId: string,
  payrollRunId: string
) {
  const payrollRun = await getDirect<PayrollRun>(
    "SELECT * FROM payroll_runs WHERE companyId = ? AND _id = ? AND isDeleted = 0",
    [companyId, payrollRunId]
  );
  if (!payrollRun || payrollRun.status === "ANNULÉ") return;
  const results = await allDirect<PayrollResult>(
    "SELECT * FROM payroll_results WHERE companyId = ? AND payrollRunId = ? AND isDeleted = 0",
    [companyId, payrollRunId]
  );
  // Do not report completion while a sync has only downloaded part of the run.
  const complete =
    results.length > 0 && results.length >= payrollRun.employeeCount;
  const allApproved =
    complete &&
    results.every((r) => r.status === "APPROUVÉ" || r.status === "PAYÉ");
  const allPaid = complete && results.every((r) => r.status === "PAYÉ");
  const status: PayrollStatus = allPaid
    ? "PAYÉ"
    : allApproved
    ? "APPROUVÉ"
    : (complete || payrollRun.status === "BROUILLON") &&
      results.every((r) => r.status === "BROUILLON")
    ? "BROUILLON"
    : "VERIFICATION";
  const lastApproved = [...results].sort((a, b) =>
    (b.approvedAt ?? "").localeCompare(a.approvedAt ?? "")
  )[0];
  const lastPaid = [...results].sort((a, b) =>
    (b.paidAt ?? "").localeCompare(a.paidAt ?? "")
  )[0];
  await runDirect(
    `UPDATE payroll_runs SET status = ?, approvedAt = ?, approvedBy = ?, paidAt = ?, paidBy = ?
     WHERE companyId = ? AND _id = ?`,
    [
      status,
      allApproved
        ? lastApproved?.approvedAt ?? payrollRun.approvedAt ?? null
        : null,
      allApproved
        ? lastApproved?.approvedBy ?? payrollRun.approvedBy ?? null
        : null,
      allPaid ? lastPaid?.paidAt ?? payrollRun.paidAt ?? null : null,
      allPaid ? lastPaid?.paidBy ?? payrollRun.paidBy ?? null : null,
      companyId,
      payrollRunId,
    ]
  );
}

// Reconcile after pulling both runs and results, preserving pending individual actions.
export async function refreshPayrollRunStatuses(companyId: string) {
  await transaction(async () => {
    const runs = await allDirect<{ _id: string }>(
      "SELECT _id FROM payroll_runs WHERE companyId = ? AND isDeleted = 0",
      [companyId]
    );
    for (const run of runs) await refreshPayrollRunStatus(companyId, run._id);
  });
}

async function transitionPayslip(
  companyId: string,
  payrollResultId: string,
  admin: AdminUser,
  target: "APPROUVÉ" | "PAYÉ"
) {
  if (!companyId || admin.companyId !== companyId || admin.role !== "MANAGER") {
    throw new Error(
      "Seul un responsable de cette entreprise peut approuver ou payer un bulletin."
    );
  }
  const result = await transaction(async () => {
    const payslip = await getDirect<PayrollResult>(
      "SELECT * FROM payroll_results WHERE companyId = ? AND _id = ? AND isDeleted = 0",
      [companyId, payrollResultId]
    );
    if (!payslip?.payrollRunId)
      throw new Error("Bulletin de paie introuvable.");
    const payrollRun = await getDirect<PayrollRun>(
      "SELECT * FROM payroll_runs WHERE companyId = ? AND _id = ? AND isDeleted = 0",
      [companyId, payslip.payrollRunId]
    );
    if (
      !payrollRun ||
      payrollRun.status === "ANNULÉ" ||
      payrollRun.status === "BROUILLON"
    ) {
      throw new Error(
        "La paie doit être soumise à vérification avant cette action."
      );
    }
    // Repeated clicks and retried IPC calls must not create duplicate transitions.
    if (
      payslip.status === target ||
      (target === "APPROUVÉ" && payslip.status === "PAYÉ")
    )
      return payslip;
    const expected = target === "APPROUVÉ" ? "VERIFICATION" : "APPROUVÉ";
    if (payslip.status !== expected) {
      throw new Error(
        target === "PAYÉ"
          ? "Ce bulletin doit être approuvé avant son paiement."
          : "Ce bulletin doit être en vérification avant son approbation."
      );
    }
    const now = new Date().toISOString();
    const dateField = target === "APPROUVÉ" ? "approvedAt" : "paidAt";
    const actorField = target === "APPROUVÉ" ? "approvedBy" : "paidBy";
    await runDirect(
      `UPDATE payroll_results SET status = ?, ${dateField} = ?, ${actorField} = ?, updatedAt = ?, synced = 0
       WHERE companyId = ? AND _id = ?`,
      [target, now, admin._id, now, companyId, payrollResultId]
    );
    const updated = {
      ...payslip,
      status: target,
      [dateField]: now,
      [actorField]: admin._id,
      updatedAt: now,
    };
    await addToSyncQueue(
      {
        companyId,
        entity: "payroll_result",
        entityId: payrollResultId,
        operation: "update",
        payload: JSON.stringify(updated),
      },
      true
    );
    await refreshPayrollRunStatus(companyId, payslip.payrollRunId);
    await createAuditLog(
      {
        companyId,
        userId: admin._id,
        userName: getAdminName(admin),
        action: "UPDATE",
        entity: "PAYROLL_RUN",
        entityId: payslip.payrollRunId,
        description: `${
          target === "APPROUVÉ" ? "Approbation" : "Paiement"
        } du bulletin de l'employé ${payslip.employeeId}`,
        changes: {
          payslipId: { from: payrollResultId, to: payrollResultId },
          status: { from: payslip.status, to: target },
        },
      },
      true
    );
    return updated;
  });
  await notifyPendingChanges(companyId);
  return result;
}

export function approvePayslip(
  companyId: string,
  payrollResultId: string,
  admin: AdminUser
) {
  return transitionPayslip(companyId, payrollResultId, admin, "APPROUVÉ");
}

export function payPayslip(
  companyId: string,
  payrollResultId: string,
  admin: AdminUser
) {
  return transitionPayslip(companyId, payrollResultId, admin, "PAYÉ");
}

// ============================================================
// SAVE PAYROLL RESULT
// ============================================================

export async function savePayrollResult(
  companyId: string,
  payrollRunId: string,
  result: PayrollResult
) {
  if (!companyId) {
    throw new Error("Company ID is required.");
  }

  const now = new Date().toISOString();

  // ----------------------------------------------------------
  // Get payroll period from THIS COMPANY'S payroll run
  // ----------------------------------------------------------

  const payrollRun = await get<PayrollRun>(
    `
    SELECT
      _id,
      companyId,
      month,
      year
    FROM payroll_runs
    WHERE companyId = ?
      AND _id = ?
      AND isDeleted = 0
    LIMIT 1
    `,
    [companyId, payrollRunId]
  );

  if (!payrollRun) {
    throw new Error(`Payroll run not found: ${payrollRunId}`);
  }

  const month = payrollRun.month;
  const year = payrollRun.year;

  const payrollResultId = randomUUID();

  const items = [...result.earnings, ...result.deductions].map((item) => ({
    _id: randomUUID(),
    companyId,
    payrollResultId,
    employeeId: result.employeeId,
    componentId: item.componentId,
    name: item.name,
    displayName: item.displayName,
    type: item.type,
    amount: item.amount,
    serverVersion: 0,
    createdAt: now,
    updatedAt: now,
    isDeleted: 0,
  }));

  await transaction(async () => {
    // --------------------------------------------------------
    // Payroll result
    // --------------------------------------------------------

    await runDirect(
      `
      INSERT INTO payroll_results (
        companyId,
        _id,
        payrollRunId,
        employeeId,
        month,
        year,
        baseSalary,
        grossSalary,
        totalEarnings,
        totalDeductions,
        netSalary,
        status,
        serverVersion,
        createdAt,
        updatedAt,
        synced,
        isDeleted
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, 0, 0
      )
      `,
      [
        companyId,
        payrollResultId,
        payrollRunId,
        result.employeeId,
        month,
        year,
        result.baseSalary,
        result.grossSalary,
        result.totalEarnings,
        result.totalDeductions,
        result.netSalary,
        result.status,
        0,
        now,
        now,
      ]
    );

    // --------------------------------------------------------
    // Payroll items
    // --------------------------------------------------------

    for (const item of items) {
      await runDirect(
        `
        INSERT INTO payroll_items (
          companyId,
          _id,
          payrollResultId,
          employeeId,
          componentId,
          name,
          displayName,
          type,
          amount,
          serverVersion,
          createdAt,
          updatedAt,
          synced,
          isDeleted
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, 0, 0
        )
        `,
        [
          item.companyId,
          item._id,
          item.payrollResultId,
          item.employeeId,
          item.componentId,
          item.name,
          item.displayName ?? null,
          item.type,
          item.amount,
          0,
          item.createdAt,
          item.updatedAt,
        ]
      );
    }

    // ----------------------------------------------------------
    // Queue payroll result
    // ----------------------------------------------------------

    await addToSyncQueue({
      companyId,
      entity: "payroll_result",
      entityId: payrollResultId,
      operation: "create",
      payload: JSON.stringify({
        companyId,
        _id: payrollResultId,
        payrollRunId,
        employeeId: result.employeeId,
        month,
        year,
        baseSalary: result.baseSalary,
        grossSalary: result.grossSalary,
        totalEarnings: result.totalEarnings,
        totalDeductions: result.totalDeductions,
        netSalary: result.netSalary,
        status: result.status,
        serverVersion: 0,
        createdAt: now,
        updatedAt: now,
        isDeleted: 0,
      }),
    }, true);

    // ----------------------------------------------------------
    // Queue payroll items
    // ----------------------------------------------------------

    for (const item of items) {
      await addToSyncQueue({
        companyId,
        entity: "payroll_item",
        entityId: item._id,
        operation: "create",
        payload: JSON.stringify(item),
      }, true);
    }

  });
  await notifyPendingChanges(companyId);

  return payrollResultId;
}

// ============================================================
// BULK SAVE PAYROLL RESULTS
// ============================================================

export async function savePayrollResults(
  companyId: string,
  payrollRunId: string,
  results: PayrollResult[]
) {
  for (const result of results) {
    await savePayrollResult(companyId, payrollRunId, result);
  }
}

// ============================================================
// GET PAYROLL RESULTS
// ============================================================

export async function getPayrollResults(
  companyId: string,
  payrollRunId: string
) {
  return await all<PayrollResult>(
    `
    SELECT
      pr.*,
      e.firstName,
      e.lastName,
      e.department,
      e.accountNumber
    FROM payroll_results pr
    LEFT JOIN employees e
      ON pr.employeeId = e._id
      AND e.companyId = pr.companyId
    WHERE pr.companyId = ?
      AND pr.payrollRunId = ?
    ORDER BY pr.createdAt DESC
    `,
    [companyId, payrollRunId]
  );
}

// ============================================================
// GET EMPLOYEE PAYROLL RESULTS
// ============================================================

export async function getEmployeePayrollResults(
  companyId: string,
  employeeId: string,
  payrollRunId?: string
) {
  if (payrollRunId) {
    return await get<PayrollResult>(
      `
      SELECT *
      FROM payroll_results
      WHERE companyId = ?
        AND payrollRunId = ?
        AND employeeId = ?
        AND isDeleted = 0
      ORDER BY createdAt DESC
      `,
      [companyId, payrollRunId, employeeId]
    );
  }

  return await all<PayrollResult>(
    `
    SELECT *
    FROM payroll_results
    WHERE companyId = ?
      AND employeeId = ?
      AND isDeleted = 0
    ORDER BY year DESC, month DESC, createdAt DESC
    `,
    [companyId, employeeId]
  );
}

// ============================================================
// GET EMPLOYEE PAYROLL RESULT BY MONTH/YEAR
// ============================================================

export async function getEmployeePayrollResultByMonthAndYear(
  companyId: string,
  employeeId: string,
  month: number,
  year: number
) {
  return await get<PayrollResult>(
    `
    SELECT *
    FROM payroll_results
    WHERE companyId = ?
      AND employeeId = ?
      AND month = ?
      AND year = ?
      AND isDeleted = 0
    LIMIT 1
    `,
    [companyId, employeeId, month, year]
  );
}

// ============================================================
// GET PAYROLL ITEMS
// ============================================================

export async function getPayrollItems(
  companyId: string,
  payrollResultId: string,
  employeeId?: string
) {
  if (employeeId) {
    return await all<PayrollItem>(
      `
      SELECT *
      FROM payroll_items
      WHERE companyId = ?
        AND payrollResultId = ?
        AND employeeId = ?
        AND isDeleted = 0
      ORDER BY createdAt ASC
      `,
      [companyId, payrollResultId, employeeId]
    );
  }

  return await all<PayrollItem>(
    `
    SELECT *
    FROM payroll_items
    WHERE companyId = ?
      AND payrollResultId = ?
      AND isDeleted = 0
    ORDER BY createdAt ASC
    `,
    [companyId, payrollResultId]
  );
}

// ============================================================
// MARK PAYROLL RUN SYNCED
// ============================================================

export async function markPayrollRunSynced(
  companyId: string,
  _id: string,
  updatedAt?: string
) {
  return await run(
    `
    UPDATE payroll_runs
    SET
      synced = 1,
      lastSyncedAt = ?
    WHERE companyId = ?
      AND _id = ?
      AND NOT EXISTS (SELECT 1 FROM sync_queue q WHERE q.companyId = payroll_runs.companyId
        AND q.entity = 'payroll_run' AND q.entityId = payroll_runs._id AND q.synced = 0)
      AND (? IS NULL OR updatedAt = ?)
    `,
    [
      new Date().toISOString(),
      companyId,
      _id,
      updatedAt ?? null,
      updatedAt ?? null,
    ]
  );
}

// ============================================================
// MARK PAYROLL RESULT SYNCED
// ============================================================

export async function markPayrollResultSynced(
  companyId: string,
  _id: string,
  updatedAt?: string
) {
  return await run(
    `
    UPDATE payroll_results
    SET
      synced = 1,
      lastSyncedAt = ?
    WHERE companyId = ?
      AND _id = ?
      AND NOT EXISTS (SELECT 1 FROM sync_queue q WHERE q.companyId = payroll_results.companyId
        AND q.entity = 'payroll_result' AND q.entityId = payroll_results._id AND q.synced = 0)
      AND (? IS NULL OR updatedAt = ?)
    `,
    [
      new Date().toISOString(),
      companyId,
      _id,
      updatedAt ?? null,
      updatedAt ?? null,
    ]
  );
}

// ============================================================
// MARK PAYROLL ITEM SYNCED
// ============================================================

export async function markPayrollItemSynced(companyId: string, _id: string) {
  return await run(
    `
    UPDATE payroll_items
    SET
      synced = 1,
      lastSyncedAt = ?
    WHERE companyId = ?
      AND _id = ?
      AND NOT EXISTS (SELECT 1 FROM sync_queue q WHERE q.companyId = payroll_items.companyId
        AND q.entity = 'payroll_item' AND q.entityId = payroll_items._id AND q.synced = 0)
    `,
    [new Date().toISOString(), companyId, _id]
  );
}

// ============================================================
// DELETE PAYROLL RUN
// ============================================================

export async function deletePayrollRun(
  companyId: string,
  payrollRunId: string
) {
  if (!companyId) {
    throw new Error("Company ID is required.");
  }

  const updatedAt = new Date().toISOString();

  // ----------------------------------------------------------
  // Verify payroll run belongs to company
  // ----------------------------------------------------------

  const payrollRun = await get<{ _id: string }>(
    `
    SELECT _id
    FROM payroll_runs
    WHERE companyId = ?
      AND _id = ?
    LIMIT 1
    `,
    [companyId, payrollRunId]
  );

  if (!payrollRun) {
    throw new Error(`Payroll run not found: ${payrollRunId}`);
  }

  // ----------------------------------------------------------
  // Get payroll results
  // ----------------------------------------------------------

  const results = await all<{ _id: string }>(
    `
    SELECT _id
    FROM payroll_results
    WHERE companyId = ?
      AND payrollRunId = ?
    `,
    [companyId, payrollRunId]
  );

  const resultIds = results.map((result) => result._id);

  // ----------------------------------------------------------
  // Get payroll items
  // ----------------------------------------------------------

  let items: { _id: string }[] = [];

  if (resultIds.length > 0) {
    const placeholders = resultIds.map(() => "?").join(", ");

    items = await all<{ _id: string }>(
      `
      SELECT _id
      FROM payroll_items
      WHERE companyId = ?
        AND payrollResultId IN (${placeholders})
      `,
      [companyId, ...resultIds]
    );
  }

  // ----------------------------------------------------------
  // Delete locally
  // ----------------------------------------------------------

  await transaction(async () => {
    const processed = await getDirect<{ _id: string }>(
      "SELECT _id FROM payroll_results WHERE companyId = ? AND payrollRunId = ? AND isDeleted = 0 AND status IN ('APPROUVÉ', 'PAYÉ') LIMIT 1",
      [companyId, payrollRunId]
    );
    if (processed)
      throw new Error(
        "Cette paie contient des bulletins déjà approuvés ou payés."
      );

    if (resultIds.length > 0) {
      const placeholders = resultIds.map(() => "?").join(", ");

      await runDirect(
        `
        DELETE FROM payroll_items
        WHERE companyId = ?
          AND payrollResultId IN (${placeholders})
        `,
        [companyId, ...resultIds]
      );
    }

    await runDirect(
      `
      DELETE FROM payroll_results
      WHERE companyId = ?
        AND payrollRunId = ?
      `,
      [companyId, payrollRunId]
    );

    await runDirect(
      `
      DELETE FROM payroll_runs
      WHERE companyId = ?
        AND _id = ?
      `,
      [companyId, payrollRunId]
    );
  });

  // ----------------------------------------------------------
  // Queue payroll items
  // ----------------------------------------------------------

  for (const item of items) {
    await addToSyncQueue({
      companyId,
      entity: "payroll_item",
      entityId: item._id,
      operation: "delete",
      payload: JSON.stringify({
        companyId,
        _id: item._id,
        isDeleted: 1,
        updatedAt,
      }),
    });
  }

  // ----------------------------------------------------------
  // Queue payroll results
  // ----------------------------------------------------------

  for (const result of results) {
    await addToSyncQueue({
      companyId,
      entity: "payroll_result",
      entityId: result._id,
      operation: "delete",
      payload: JSON.stringify({
        companyId,
        _id: result._id,
        isDeleted: 1,
        updatedAt,
      }),
    });
  }

  // ----------------------------------------------------------
  // Queue payroll run
  // ----------------------------------------------------------

  await addToSyncQueue({
    companyId,
    entity: "payroll_run",
    entityId: payrollRunId,
    operation: "delete",
    payload: JSON.stringify({
      companyId,
      _id: payrollRunId,
      isDeleted: 1,
      updatedAt,
    }),
  });

  return true;
}
