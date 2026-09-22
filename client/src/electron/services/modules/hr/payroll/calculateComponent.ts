import { PayrollCalculationContext } from "../../../../../common/types/payroll/Payroll.js";
import { calculateAbsenceDeduction } from "./calculateAbsentDeduction.js";
import calculateIPR from "./calculateIPR.js";
import { PayrollComponentInput } from "../../../../../common/types/payroll/Payroll.js";
import { calculateLateDeduction } from "./calculateLateDeduction.js";

export function calculateComponent(
  component: PayrollComponentInput,
  context: PayrollCalculationContext
): number {
  switch (component.calculationType) {
    case "FIXE":
      return component.value ?? 0;

    case "MANUEL":
      return component.value ?? 0;

    case "POURCENTAGE_BASE":
      return context.baseSalary * ((component.value ?? 0) / 100);

    case "POURCENTAGE_BRUT":
      return context.grossSalary * ((component.value ?? 0) / 100);

    case "POURCENTAGE_IMPOSABLE":
      return context.taxableSalary * ((component.value ?? 0) / 100);

    case "QUANTITE_TAUX":
      return (component.quantity ?? 0) * (component.rate ?? 0);

    case "FORMULE_IPR": {
      console.log(
        `TAXABLE SALARY FOR EMPLOYEE ID ${context.employeeId} IS ${context.taxableSalary}.
        THE GROSS SALARY IS ${context.grossSalary}
        The social security rate is ${context.socialRate}
        `
      );
      return calculateIPR(
        context.taxableSalary,
        context.grossSalary,
        context.socialRate
      );
    }

    case "FORMULE_ABSENCE": {
      console.log(
        `BASE SALARY FOR EMPLOYEE ID ${context.employeeId} IS ${context.baseSalary}.
        THE GROSS SALARY IS ${context.grossSalary}
        `
      );
      return calculateAbsenceDeduction(
        context.employeeId,
        context.baseSalary,
        context.absentDays,
        context.payrollSettings
      );
    }

    case "FORMULE_RETARD": {
      console.log(
        `BASE SALARY FOR EMPLOYEE ID ${context.employeeId} IS ${context.baseSalary}.
        THE GROSS SALARY IS ${context.grossSalary}
        `
      );
      return calculateLateDeduction(
        context.employeeId,
        context.baseSalary,
        context.totalLateMinutes,
        context.payrollSettings
      );
    }

    default:
      return 0;
  }
}
