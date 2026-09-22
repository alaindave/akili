import { PayrollSettings } from "../../../../../common/types/payroll/Payroll.js";

export function calculateLateDeduction(
  employeeId: string | undefined,
  baseSalary: number,
  totalLateMinutes: number,
  payrollSettings: PayrollSettings
): number {
  if (!employeeId) {
    console.error("LATE DEDUCTION: EMPLOYEE ID NOT PROVIDED");
    return 0;
  }

  if (baseSalary <= 0) {
    return 0;
  }

  if (totalLateMinutes <= 0) {
    return 0;
  }

  if (payrollSettings.workingDays <= 0) {
    console.error(
      `LATE DEDUCTION: INVALID WORKING DAYS FOR EMPLOYEE ${employeeId}`
    );
    return 0;
  }

  if (payrollSettings.workingHours <= 0) {
    console.error(
      `LATE DEDUCTION: INVALID WORKING HOURS FOR EMPLOYEE ${employeeId}`
    );
    return 0;
  }

  // Salary earned for one working day
  const dailyRate = baseSalary / payrollSettings.workingDays;

  // Salary earned for one working hour
  const hourlyRate = dailyRate / payrollSettings.workingHours;

  // Convert late minutes into hours
  const lateHours = totalLateMinutes / 60;

  // Final deduction
  const deduction = hourlyRate * lateHours;

  console.log(`LATE DEDUCTION FOR EMPLOYEE ${employeeId}`, {
    baseSalary,
    workingDays: payrollSettings.workingDays,
    workingHours: payrollSettings.workingHours,
    totalLateMinutes,
    dailyRate,
    hourlyRate,
    lateHours,
    deduction,
  });

  return Math.max(0, deduction);
}
