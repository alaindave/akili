import { PayrollEmployeeInput } from "../../../../../common/types/payroll/Payroll.js";

export interface PayrollValidationResult {
  valid: boolean;
  message?: string;
  errors: string[];
}

export function validatePayroll(
  employee: PayrollEmployeeInput
): PayrollValidationResult {
  const errors: string[] = [];

  if (!employee.employeeId.trim()) {
    errors.push("Employee ID is required.");
  }

  if (!Number.isFinite(employee.baseSalary)) {
    errors.push("Base salary must be a valid number.");
  } else if (employee.baseSalary < 0) {
    errors.push("Base salary cannot be negative.");
  }

  if (employee.components.length === 0) {
    errors.push("At least one payroll component is required.");
  }

  employee.components.forEach((component, index) => {
    if (!component._id?.trim()) {
      errors.push(`Component #${index + 1}: ID is required.`);
    }

    if (!component.name.trim()) {
      errors.push(`Component #${index + 1}: Name is required.`);
    }

    if (!["EARNING", "DEDUCTION"].includes(component.type)) {
      errors.push(`Component "${component.name}": Invalid component type.`);
    }

    if (
      ![
        "FIXE",
        "MANUEL",
        "POURCENTAGE_BASE",
        "POURCENTAGE_BRUT",
        "POURCENTAGE_IMPOSABLE",
        "FORMULE_IPR",
        "FORMULE_ABSENCE",
        "FORMULE_RETARD",
      ].includes(component.calculationType)
    ) {
      errors.push(`Component "${component.name}": Invalid calculation type.`);
    }

    if (component.value != null && !Number.isFinite(component.value)) {
      errors.push(
        `Component "${component.name}": Value must be a valid number.`
      );
    }
  });

  return {
    valid: errors.length === 0,
    message: errors.length ? errors.join(", ") : undefined,
    errors,
  };
}

export function validatePayrolls(
  employees: PayrollEmployeeInput[]
): PayrollValidationResult {
  const errors: string[] = [];

  if (!employees || employees.length === 0) {
    errors.push("No employees provided");

    return {
      valid: false,
      message: errors.join(", "),
      errors,
    };
  }

  employees.forEach((employee, index) => {
    const result = validatePayroll(employee);

    if (!result.valid) {
      result.errors.forEach((error) => {
        errors.push(`Employee ${employee.employeeId || index + 1}: ${error}`);
      });
    }
  });

  return {
    valid: errors.length === 0,
    message: errors.length > 0 ? errors.join(", ") : undefined,
    errors,
  };
}
