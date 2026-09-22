import AdminUser from "../../../../../common/types/AdminUser.js";
import {
  PayrollEmployeeInput,
  PayrollResult,
  PayrollItem,
  PayrollBatchResult,
  PayrollCalculationContext,
} from "../../../../../common/types/payroll/Payroll.js";
import { PayrollSettings } from "../../../../../common/types/payroll/Payroll.js";

import { calculateComponent } from "./calculateComponent.js";

// Calculate payroll for one employee
export async function calculatePayroll(
  companyId: string,
  employee: PayrollEmployeeInput,
  admin: AdminUser,
  payrollSettings: PayrollSettings
): Promise<PayrollResult> {
  const earnings: PayrollItem[] = [];
  const deductions: PayrollItem[] = [];

  const baseSalary = employee.baseSalary;

  let totalEarnings = 0;
  let totalDeductions = 0;
  let grossSalary = baseSalary;
  let socialRate = 0;

  const date = new Date();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const lateDays = employee.attendance?.lateDays;
  const totalLateMinutes = employee.attendance?.totalLateMinutes;
  const absentDays = employee.attendance?.absentDays;

  /*
   * ============================================================
   * 1. CALCULATE ENABLED EARNINGS
   * ============================================================
   */

  for (const component of employee.components) {
    // Ignore disabled components
    if (component.enabled !== 1) continue;

    // Only earnings
    if (component.type !== "EARNING") continue;

    const context: PayrollCalculationContext = {
      companyId,
      payrollSettings,
      employeeId: employee.employeeId,
      baseSalary,
      grossSalary,
      lateDays: lateDays ?? 0,
      totalLateMinutes: totalLateMinutes ?? 0,
      absentDays: absentDays ?? 0,
      taxableSalary: grossSalary,
      totalEarnings,
      totalDeductions,
      netSalary: grossSalary - totalDeductions,
    };

    const amount = await calculateComponent(component, context);

    earnings.push({
      companyId,
      componentId: component._id,
      name: component.name,
      displayName: component.displayName,
      type: component.type,
      amount,
      taxable: component.taxable,
    });

    totalEarnings += amount;
    grossSalary += amount;
  }

  /*
   * ============================================================
   * 2. CALCULATE TAXABLE SALARY
   * ============================================================
   */

  const taxableSalary =
    baseSalary +
    earnings
      .filter((item) => item.taxable === 1)
      .reduce((total, item) => total + item.amount, 0);

  /*
   * ============================================================
   * 3. CALCULATE ENABLED DEDUCTIONS
   * ============================================================
   */

  for (const component of employee.components) {
    // Ignore disabled components
    if (component.enabled !== 1) continue;

    // Only deductions
    if (component.type !== "DEDUCTION") continue;

    if (component.name === "SOCIAL_SECURITY") {
      console.log("SOCIAL RATE:", component.value);
      socialRate = component.value ?? 0;
    }

    const context: PayrollCalculationContext = {
      companyId,
      payrollSettings,
      employeeId: employee.employeeId,
      baseSalary,
      lateDays: lateDays ?? 0,
      totalLateMinutes: totalLateMinutes ?? 0,
      absentDays: absentDays ?? 0,
      grossSalary,
      taxableSalary,
      socialRate,
      totalEarnings,
      totalDeductions,
      netSalary: grossSalary - totalDeductions,
    };

    const amount = await calculateComponent(component, context);

    deductions.push({
      companyId,
      componentId: component._id,
      name: component.name,
      displayName: component.displayName,
      type: component.type,
      amount,
    });

    totalDeductions += amount;
  }

  /*
   * ============================================================
   * 4. FINAL NET SALARY
   * ============================================================
   */

  const netSalary = grossSalary - totalDeductions;

  /*
   * ============================================================
   * 5. RETURN PAYROLL RESULT
   * ============================================================
   */

  return {
    companyId,
    employeeId: employee.employeeId,
    generatedBy: admin._id,
    month,
    year,
    baseSalary,
    grossSalary,
    taxableSalary,
    earnings,
    deductions,
    totalEarnings,
    totalDeductions,
    netSalary,
    status: "BROUILLON",
  };
}

// Calculate payroll for all employees
export async function calculatePayrolls(
  companyId: string,
  employees: PayrollEmployeeInput[],
  admin: AdminUser,
  payrollSettings: PayrollSettings
): Promise<PayrollResult[]> {
  return Promise.all(
    employees.map((employee) =>
      calculatePayroll(companyId, employee, admin, payrollSettings)
    )
  );
}

// Calculate payroll and return summary
export async function calculatePayrollsWithSummary(
  companyId: string,
  employees: PayrollEmployeeInput[],
  admin: AdminUser,
  payrollSettings: PayrollSettings
): Promise<PayrollBatchResult> {
  const results = await calculatePayrolls(
    companyId,
    employees,
    admin,
    payrollSettings
  );

  return {
    companyId,
    results,
    employeeCount: results.length,
    totalBasicSalary: results.reduce(
      (sum, result) => sum + result.baseSalary,
      0
    ),
    totalEarnings: results.reduce(
      (sum, result) => sum + result.totalEarnings,
      0
    ),
    totalDeductions: results.reduce(
      (sum, result) => sum + result.totalDeductions,
      0
    ),
    totalNetSalary: results.reduce((sum, result) => sum + result.netSalary, 0),
  };
}
