import { dialog } from "electron";
import fs from "fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import type { PayslipDocumentData } from "../../../../../common/types/hr/payroll/PayslipDocument.js";
import { getCompanyById } from "../../../../database/repositories/shared/companies.repository.js";
import { getEmployeeById } from "../../../../database/repositories/modules/hr/employees.repository.js";
import {
  getEmployeePayrollResults,
  getPayrollItems,
} from "../../../../database/repositories/modules/hr/payrollRun.repository.js";
import { getPayrollSettings } from "../../../../database/repositories/modules/hr/payrollSettings.repository.js";
import PayslipReportDocument from "../../../../reports/payroll/payslip-report.js";

export async function getPayslipDocumentData(
  companyId: string,
  employeeId: string,
  payrollRunId: string
): Promise<PayslipDocumentData> {
  if (
    [companyId, employeeId, payrollRunId].some(
      (value) => typeof value !== "string" || !value.trim()
    )
  ) {
    throw new Error("Paramètres du bulletin de paie invalides.");
  }
  const [company, employee, payroll, settings] = await Promise.all([
    getCompanyById(companyId),
    getEmployeeById(companyId, employeeId),
    getEmployeePayrollResults(companyId, employeeId, payrollRunId),
    getPayrollSettings(companyId),
  ]);
  if (
    !company ||
    !employee ||
    !payroll ||
    Array.isArray(payroll) ||
    !payroll._id
  ) {
    throw new Error("Entreprise, employé ou bulletin de paie introuvable.");
  }
  const items = await getPayrollItems(companyId, payroll._id, employeeId);
  return {
    company,
    employee,
    payroll,
    items,
    currency: settings?.currency ?? "BIF",
  };
}

export async function savePayslipReport(
  companyId: string,
  employeeId: string,
  payrollRunId: string
) {
  const data = await getPayslipDocumentData(
    companyId,
    employeeId,
    payrollRunId
  );
  const reference = (
    data.employee.matricule ||
    `${data.employee.firstName}-${data.employee.lastName}`
  )
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .slice(0, 80);
  const destination = await dialog.showSaveDialog({
    title: "Enregistrer le bulletin de paie",
    defaultPath: `bulletin-paie-${reference}-${data.payroll.year}-${String(
      data.payroll.month
    ).padStart(2, "0")}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (destination.canceled || !destination.filePath) return { canceled: true };
  const buffer = await renderToBuffer(<PayslipReportDocument data={data} />);
  await fs.writeFile(destination.filePath, buffer);
  return { canceled: false, filePath: destination.filePath };
}
