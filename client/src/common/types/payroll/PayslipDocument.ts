import type Company from "../Company.js";
import type Employee from "../Employee.js";
import type { PayrollItem, PayrollResult } from "./Payroll.js";

export interface PayslipDocumentData {
  company: Company;
  employee: Employee;
  payroll: PayrollResult;
  items: PayrollItem[];
  currency: string;
}

export function payslipPeriod(month: number, year: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const name = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date(year, month - 1, 1));
  return `1 au ${lastDay} ${name} ${year}`;
}

export function payslipMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount).replace(/[\u00a0\u202f]/g, " ");
}

export function payslipDate(date?: string) {
  return date ? new Date(date).toLocaleDateString("fr-FR") : "—";
}

export function payslipRows(data: PayslipDocumentData) {
  return [
    { label: "Salaire de base", earning: data.payroll.baseSalary, deduction: null },
    ...data.items.filter((item) => item.type === "EARNING").map((item) => ({
      label: item.displayName || item.name, earning: item.amount, deduction: null,
    })),
    ...data.items.filter((item) => item.type === "DEDUCTION").map((item) => ({
      label: item.displayName || item.name, earning: null, deduction: item.amount,
    })),
  ];
}
