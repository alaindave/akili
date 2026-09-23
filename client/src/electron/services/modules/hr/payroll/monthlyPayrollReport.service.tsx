import { dialog } from "electron";
import fs from "fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCompanyById } from "../../../../database/repositories/shared/companies.repository.js";
import { getPayrollRunById, getPayrollResults } from "../../../../database/repositories/modules/hr/payroll_run.repository.js";
import { getPayrollSettings } from "../../../../database/repositories/modules/hr/payroll_settings.repository.js";
import { MonthlyPayrollReportDocument } from "../../../../reports/payroll/monthly-payroll-report.js";

export async function saveMonthlyPayrollReport(companyId: string, runId: string, department: string | null) {
  if (typeof companyId !== "string" || !companyId || typeof runId !== "string" || !runId || (department !== null && typeof department !== "string")) {
    throw new Error("Paramètres du rapport de paie invalides.");
  }
  const [company, run, rows, settings] = await Promise.all([
    getCompanyById(companyId), getPayrollRunById(companyId, runId),
    getPayrollResults(companyId, runId), getPayrollSettings(companyId),
  ]);
  if (!company || !run) throw new Error("Entreprise ou fiche de paie introuvable.");
  const results = rows.filter((row) => department === null || (row.department?.trim() ?? "") === department);
  const departmentLabel = department === null ? "tous-departements" : department || "sans-departement";
  const safeDepartment = departmentLabel.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").slice(0, 80);
  const destination = await dialog.showSaveDialog({
    title: "Enregistrer le rapport mensuel de paie",
    defaultPath: `rapport-paie-${run.year}-${String(run.month).padStart(2, "0")}-${safeDepartment}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (destination.canceled || !destination.filePath) return { canceled: true };
  const buffer = await renderToBuffer(<MonthlyPayrollReportDocument company={company} run={run} results={results} department={department} currency={settings?.currency ?? "BIF"} />);
  await fs.writeFile(destination.filePath, buffer);
  return { canceled: false, filePath: destination.filePath };
}
