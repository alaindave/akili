import { allDirect, getDirect, runDirect, transaction } from "../../../db.js";
import PayrollEmployeeProfile from "../../../../../common/types/payroll/PayrollEmployeeProfile.js";
import { addToSyncQueue, notifyPendingChanges } from "../../shared/sync.repository.js";

// The caller owns the transaction so employee, profiles, and queue commit together.
export async function updatePayrollAccountInTransaction(
  companyId: string,
  employeeId: string,
  accountNumber: string,
  updatedAt: string
) {
  const profiles = await allDirect<PayrollEmployeeProfile>(
    `SELECT * FROM payroll_employee_profiles
     WHERE companyId = ? AND employeeId = ? AND isDeleted = 0
       AND (accountNumber IS NULL OR accountNumber != ?)`,
    [companyId, employeeId, accountNumber]
  );
  for (const profile of profiles) {
    await runDirect(
      `UPDATE payroll_employee_profiles SET accountNumber = ?, updatedAt = ?, synced = 0
       WHERE companyId = ? AND _id = ?`,
      [accountNumber, updatedAt, companyId, profile._id]
    );
    await addToSyncQueue({
      companyId,
      entity: "payroll_profile",
      entityId: profile._id!,
      operation: "update",
      payload: JSON.stringify({ ...profile, accountNumber, updatedAt, synced: 0 }),
    }, true);
  }
}

export async function migratePayrollAccounts() {
  const companies = await transaction(async () => {
    const employees = await allDirect<{ companyId: string; employeeId: string }>(
      `SELECT DISTINCT companyId, employeeId FROM payroll_employee_profiles
       WHERE accountNumber IS NULL AND isDeleted = 0`
    );
    for (const { companyId, employeeId } of employees) {
      const employee = await getDirect<{ accountNumber?: string }>(
        "SELECT accountNumber FROM employees WHERE companyId = ? AND _id = ?",
        [companyId, employeeId]
      );
      await updatePayrollAccountInTransaction(
        companyId, employeeId, employee?.accountNumber?.trim() || "cash", new Date().toISOString()
      );
    }
    return [...new Set(employees.map((employee) => employee.companyId))];
  });
  for (const companyId of companies) await notifyPendingChanges(companyId);
}
