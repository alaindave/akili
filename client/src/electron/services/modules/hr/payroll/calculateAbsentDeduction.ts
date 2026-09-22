import { PayrollSettings } from "../../../../../common/types/payroll/Payroll.js";

export function calculateAbsenceDeduction(
  employeeId: string | undefined,
  baseSalary: number,
  absentDays: number,
  payrollSettings: PayrollSettings
): number {
  if (!employeeId) {
    console.error("CANNOT CALCULATE ABSENCE DEDUCTION: EMPLOYEE ID IS MISSING");

    return 0;
  }

  if (baseSalary <= 0) {
    return 0;
  }

  if (absentDays <= 0) {
    return 0;
  }

  if (!payrollSettings) {
    throw new Error("PAYROLL SETTINGS NOT FOUND");
  }

  const workingDays = payrollSettings.workingDays;

  if (!workingDays || workingDays <= 0) {
    throw new Error("INVALID PAYROLL WORKING DAYS");
  }

  const dailySalary = baseSalary / workingDays;

  const deduction = dailySalary * absentDays;

  console.log(
    `
    ABSENCE DEDUCTION
    -------------------------
    Employee: ${employeeId}
    Base salary: ${baseSalary}
    Working days: ${workingDays}
    Absent days: ${absentDays}
    Daily salary: ${dailySalary}
    Deduction: ${deduction}
    `
  );

  return Math.round(deduction);
}
