import type Company from "../../shared/Company.js";
import { formatReportDate, reportMonthPeriod } from "../../../utils/reportDate.js";
import type Employee from "../employees/Employee.js";
import type { PayrollItem, PayrollResult } from "./Payroll.js";

export interface PayslipDocumentData {
  company: Company;
  employee: Employee;
  payroll: PayrollResult;
  items: PayrollItem[];
  currency: string;
}

export function payslipPeriod(month: number, year: number) {
  return reportMonthPeriod(month, year);
}

export function payslipMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency })
    .format(amount)
    .replace(/[\u00a0\u202f]/g, " ");
}

export function payslipDate(date?: string) {
  return formatReportDate(date);
}

export function payslipRows(data: PayslipDocumentData) {
  return [
    {
      label: "Salaire de base",
      earning: data.payroll.baseSalary,
      deduction: null,
    },
    ...data.items
      .filter((item) => item.type === "EARNING")
      .map((item) => ({
        label: item.displayName || item.name,
        earning: item.amount,
        deduction: null,
      })),
    ...data.items
      .filter((item) => item.type === "DEDUCTION")
      .map((item) => ({
        label: item.displayName || item.name,
        earning: null,
        deduction: item.amount,
      })),
  ];
}
