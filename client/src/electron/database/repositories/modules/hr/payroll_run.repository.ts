import { randomUUID } from "crypto";
import { run, get, all, transaction, runDirect } from "../../../db.js";

import {
  PayrollBatchResult,
  PayrollResult,
  PayrollItem,
  PayrollRun,
  PayrollStatus,
} from "../../../../../common/types/payroll/Payroll.js";
import AdminUser from "../../../../../common/types/AdminUser.js";
import { addToSyncQueue } from "../../shared/sync.repository.js";
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
  description: string
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
  });
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

  await run(
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
  });

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

  const existingById = await get<
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

      return existingById;
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

    await run(
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
  // 2. No ID match.
  //    Check natural payroll period INSIDE THIS COMPANY.
  // ----------------------------------------------------------

  const existingByPeriod = await get<
    PayrollRun & {
      synced: number;
      serverVersion: number;
    }
  >(
    `
    SELECT *
    FROM payroll_runs
    WHERE companyId = ?
      AND month = ?
      AND year = ?
      AND isDeleted = 0
      AND status <> 'ANNULÉ'
    LIMIT 1
    `,
    [companyId, payrollRun.month, payrollRun.year]
  );

  if (existingByPeriod) {
    console.warn("PAYROLL RUN PERIOD CONFLICT", {
      incoming: payrollRun,
      existing: existingByPeriod,
    });

    if (existingByPeriod.synced === 0) {
      console.log(
        `SKIPPING PAYROLL RUN PERIOD CONFLICT. LOCAL CHANGES ARE PENDING: ${existingByPeriod._id}`
      );

      return existingByPeriod;
    }

    if (
      payrollRun.serverVersion &&
      payrollRun.serverVersion <= (existingByPeriod.serverVersion ?? 0)
    ) {
      console.log(
        `SKIPPING PAYROLL RUN PERIOD CONFLICT. LOCAL SERVER VERSION IS NEWER/EQUAL`
      );

      return existingByPeriod;
    }

    await run(
      `
      UPDATE payroll_runs
      SET
        _id = ?,
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
        companyId,
        existingByPeriod._id,
      ]
    );

    return true;
  }

  // ----------------------------------------------------------
  // 3. No local record exists.
  // ----------------------------------------------------------

  await run(
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
}

// ============================================================
// UPSERT PAYROLL RESULT FROM SERVER
// ============================================================

export async function upsertPayrollResult(
  companyId: string,
  payrollResult: PayrollResult
) {
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

  const existingById = await get<
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

      return existingById;
    }

    if (
      payrollResult.serverVersion &&
      payrollResult.serverVersion <= (existingById.serverVersion ?? 0)
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

    await run(
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
  // Check natural employee/month/year key
  // INSIDE THIS COMPANY
  // ----------------------------------------------------------

  const existingByPeriod = await get<
    PayrollResult & {
      synced: number;
      serverVersion: number;
    }
  >(
    `
    SELECT *
    FROM payroll_results
    WHERE companyId = ?
      AND employeeId = ?
      AND month = ?
      AND year = ?
      AND isDeleted = 0
      AND status <> 'ANNULÉ'
    LIMIT 1
    `,
    [
      companyId,
      payrollResult.employeeId,
      payrollResult.month,
      payrollResult.year,
    ]
  );

  if (existingByPeriod) {
    console.warn("PAYROLL RESULT PERIOD CONFLICT", {
      incoming: payrollResult,
      existing: existingByPeriod,
    });

    if (existingByPeriod.synced === 0) {
      console.log(
        `SKIPPING PAYROLL RESULT PERIOD CONFLICT. LOCAL CHANGES ARE PENDING: ${existingByPeriod._id}`
      );

      return existingByPeriod;
    }

    if (
      payrollResult.serverVersion &&
      payrollResult.serverVersion <= (existingByPeriod.serverVersion ?? 0)
    ) {
      console.log(
        `SKIPPING PAYROLL RESULT PERIOD CONFLICT. LOCAL SERVER VERSION IS NEWER/EQUAL`
      );

      return existingByPeriod;
    }

    await run(
      `
      UPDATE payroll_results
      SET
        _id = ?,
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
        payrollResult.approvedAt ?? null,
        payrollResult.paidAt ?? null,
        payrollResult.serverVersion,
        payrollResult.createdAt,
        payrollResult.updatedAt,
        payrollResult.isDeleted ?? 0,
        companyId,
        existingByPeriod._id,
      ]
    );

    return true;
  }

  // ----------------------------------------------------------
  // Insert server payroll result
  // ----------------------------------------------------------

  await run(
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
      ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?
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
      payrollResult.approvedAt ?? null,
      payrollResult.paidAt ?? null,
      payrollResult.serverVersion,
      payrollResult.createdAt,
      payrollResult.updatedAt,
      payrollResult.isDeleted ?? 0,
    ]
  );

  return true;
}

// ============================================================
// UPSERT PAYROLL ITEM FROM SERVER
// ============================================================

export async function upsertPayrollItem(
  companyId: string,
  payrollItem: PayrollItem
) {
  if (!companyId) {
    throw new Error("Company ID is required.");
  }

  if (payrollItem.companyId !== companyId) {
    throw new Error(
      "Payroll item companyId does not match the requested companyId."
    );
  }

  const existing = await get<
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

      return existing;
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

  await run(
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
}

// ============================================================
// UPDATE PAYROLL STATUS
// ============================================================

export async function updatePayrollStatus(
  companyId: string,
  payrollRunId: string,
  status: PayrollStatus
) {
  if (!companyId) {
    throw new Error("Company ID is required.");
  }

  const now = new Date().toISOString();

  // ----------------------------------------------------------
  // Make sure payroll run belongs to this company
  // ----------------------------------------------------------

  const payrollRun: PayrollRun | null = await get(
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

  const results: PayrollResult[] = await all(
    `
    SELECT *
    FROM payroll_results
    WHERE companyId = ?
      AND payrollRunId = ?
    `,
    [companyId, payrollRunId]
  );

  await run(
    `
    UPDATE payroll_runs
    SET
      status = ?,
      updatedAt = ?,
      synced = 0
    WHERE companyId = ?
      AND _id = ?
    `,
    [status, now, companyId, payrollRunId]
  );

  if (results.length > 0) {
    const resultIds = results.map((result) => result._id);

    const placeholders = resultIds.map(() => "?").join(", ");

    await run(
      `
      UPDATE payroll_results
      SET
        status = ?,
        updatedAt = ?,
        synced = 0
      WHERE companyId = ?
        AND _id IN (${placeholders})
      `,
      [status, now, companyId, ...resultIds]
    );
  }

  await addToSyncQueue({
    companyId,
    entity: "payroll_run",
    entityId: payrollRunId,
    operation: "update",
    payload: JSON.stringify({
      ...payrollRun,
      status,
      updatedAt: now,
    }),
  });

  for (const result of results) {
    if (!result._id) return;
    await addToSyncQueue({
      companyId,
      entity: "payroll_result",
      entityId: result._id,
      operation: "update",
      payload: JSON.stringify({
        ...result,
        status,
        updatedAt: now,
      }),
    });
  }

  return true;
}

// ============================================================
// CANCEL PAYROLL RUN
// ============================================================

export async function cancelPayrollRun(
  companyId: string,
  payrollRunId: string,
  admin: AdminUser
) {
  if (!companyId) {
    throw new Error("Company ID is required.");
  }

  const now = new Date().toISOString();

  const payrollRun: PayrollRun | null = await get(
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

  const results: PayrollResult[] = await all(
    `
    SELECT *
    FROM payroll_results
    WHERE companyId = ?
      AND payrollRunId = ?
    `,
    [companyId, payrollRunId]
  );

  await transaction(async () => {
    await runDirect(
      `
      UPDATE payroll_runs
      SET
        status = ?,
        cancelledBy = ?,
        cancelledAt = ?,
        updatedAt = ?,
        synced = 0
      WHERE companyId = ?
        AND _id = ?
      `,
      ["ANNULÉ", admin._id, now, now, companyId, payrollRunId]
    );

    await runDirect(
      `
      UPDATE payroll_results
      SET
        status = ?,
        cancelledAt = ?,
        updatedAt = ?,
        synced = 0
      WHERE companyId = ?
        AND payrollRunId = ?
      `,
      ["ANNULÉ", now, now, companyId, payrollRunId]
    );

    return true;
  });

  await addToSyncQueue({
    companyId,
    entity: "payroll_run",
    entityId: payrollRunId,
    operation: "update",
    payload: JSON.stringify({
      ...payrollRun,
      companyId,
      status: "ANNULÉ",
      cancelledBy: admin._id,
      cancelledAt: now,
      updatedAt: now,
    }),
  });

  for (const result of results) {
    if (!result._id) return;
    await addToSyncQueue({
      companyId,
      entity: "payroll_result",
      entityId: result._id,
      operation: "update",
      payload: JSON.stringify({
        ...result,
        companyId,
        status: "ANNULÉ",
        cancelledAt: now,
        updatedAt: now,
      }),
    });
  }

  await createPayrollStatusAudit(
    companyId,
    payrollRunId,
    admin,
    payrollRun.status,
    "ANNULÉ",
    "Annulation de la paie"
  );

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

  const payrollRun: PayrollRun | null = await get(
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

  const results = await all<{ _id: string }>(
    `
    SELECT *
    FROM payroll_results
    WHERE companyId = ?
      AND payrollRunId = ?
    `,
    [companyId, payrollRunId]
  );

  await transaction(async () => {
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
      `,
      ["VERIFICATION", now, now, companyId, payrollRunId]
    );
  });

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
  });

  for (const result of results) {
    await addToSyncQueue({
      companyId,
      entity: "payroll_result",
      entityId: result._id,
      operation: "update",
      payload: JSON.stringify({
        companyId,
        payrollRunId,
        managerEmail,
        status: "VERIFICATION",
        verifiedAt: now,
        updatedAt: now,
      }),
    });
  }

  await createPayrollStatusAudit(
    companyId,
    payrollRunId,
    admin,
    payrollRun.status,
    "VERIFICATION",
    "Modification du statut de la paie"
  );

  return true;
}

// ============================================================
// APPROVE PAYROLL RUN
// ============================================================

export async function approvePayrollRun(
  companyId: string,
  payrollRunId: string,
  admin: AdminUser
) {
  if (!companyId) {
    throw new Error("Company ID is required.");
  }

  const now = new Date().toISOString();

  const payrollRun = await get<{ _id: string; status: PayrollStatus }>(
    `
    SELECT _id, status
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

  const results = await all<{ _id: string }>(
    `
    SELECT _id
    FROM payroll_results
    WHERE companyId = ?
      AND payrollRunId = ?
    `,
    [companyId, payrollRunId]
  );

  await transaction(async () => {
    await runDirect(
      `
      UPDATE payroll_runs
      SET
        status = ?,
        approvedBy = ?,
        approvedAt = ?,
        updatedAt = ?,
        synced = 0
      WHERE companyId = ?
        AND _id = ?
      `,
      ["APPROUVÉ", admin._id, now, now, companyId, payrollRunId]
    );

    await runDirect(
      `
      UPDATE payroll_results
      SET
        status = ?,
        approvedAt = ?,
        updatedAt = ?,
        synced = 0
      WHERE companyId = ?
        AND payrollRunId = ?
      `,
      ["APPROUVÉ", now, now, companyId, payrollRunId]
    );
  });

  await addToSyncQueue({
    companyId,
    entity: "payroll_run",
    entityId: payrollRunId,
    operation: "update",
    payload: JSON.stringify({
      companyId,
      _id: payrollRunId,
      status: "APPROUVÉ",
      approvedBy: admin._id,
      approvedAt: now,
      updatedAt: now,
    }),
  });

  for (const result of results) {
    await addToSyncQueue({
      companyId,
      entity: "payroll_result",
      entityId: result._id,
      operation: "update",
      payload: JSON.stringify({
        companyId,
        _id: result._id,
        status: "APPROUVÉ",
        payrollRunId,
        approvedAt: now,
        updatedAt: now,
      }),
    });
  }

  await createPayrollStatusAudit(
    companyId,
    payrollRunId,
    admin,
    payrollRun.status,
    "APPROUVÉ",
    "Approbation de la paie"
  );

  return true;
}

// ============================================================
// PAYMENT PAYROLL RUN
// ============================================================

export async function paymentPayrollRun(
  companyId: string,
  managerEmail: string,
  payrollRunId: string,
  admin: AdminUser
) {
  if (!companyId) {
    throw new Error("Company ID is required.");
  }

  const now = new Date().toISOString();

  const payrollRun: PayrollRun | null = await get(
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

  const results: PayrollResult[] = await all(
    `
    SELECT *
    FROM payroll_results
    WHERE companyId = ?
      AND payrollRunId = ?
    `,
    [companyId, payrollRunId]
  );

  await transaction(async () => {
    await runDirect(
      `
      UPDATE payroll_runs
      SET
        status = ?,
        paidBy = ?,
        paidAt = ?,
        updatedAt = ?,
        synced = 0
      WHERE companyId = ?
        AND _id = ?
      `,
      ["PAYÉ", admin._id, now, now, companyId, payrollRunId]
    );

    await runDirect(
      `
      UPDATE payroll_results
      SET
        status = ?,
        paidAt = ?,
        updatedAt = ?,
        synced = 0
      WHERE companyId = ?
        AND payrollRunId = ?
      `,
      ["PAYÉ", now, now, companyId, payrollRunId]
    );
  });

  await addToSyncQueue({
    companyId,
    entity: "payroll_run",
    entityId: payrollRunId,
    operation: "update",
    payload: JSON.stringify({
      ...payrollRun,
      companyId,
      managerEmail,
      status: "PAYÉ",
      paidBy: admin._id,
      paidAt: now,
      updatedAt: now,
    }),
  });

  for (const result of results) {
    if (!result._id) continue;
    await addToSyncQueue({
      companyId,
      entity: "payroll_result",
      entityId: result._id,
      operation: "update",
      payload: JSON.stringify({
        ...result,
        companyId,
        managerEmail,
        status: "PAYÉ",
        paidAt: now,
        updatedAt: now,
      }),
    });
  }

  await createPayrollStatusAudit(
    companyId,
    payrollRunId,
    admin,
    payrollRun.status,
    "PAYÉ",
    "Marquage de la paie comme payée"
  );

  return true;
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
  });

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
  });

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
    });
  }

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
      e.department
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

export async function markPayrollRunSynced(companyId: string, _id: string) {
  return await run(
    `
    UPDATE payroll_runs
    SET
      synced = 1,
      lastSyncedAt = ?
    WHERE companyId = ?
      AND _id = ?
    `,
    [new Date().toISOString(), companyId, _id]
  );
}

// ============================================================
// MARK PAYROLL RESULT SYNCED
// ============================================================

export async function markPayrollResultSynced(companyId: string, _id: string) {
  return await run(
    `
    UPDATE payroll_results
    SET
      synced = 1,
      lastSyncedAt = ?
    WHERE companyId = ?
      AND _id = ?
    `,
    [new Date().toISOString(), companyId, _id]
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
