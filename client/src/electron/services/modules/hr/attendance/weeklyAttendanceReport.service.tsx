import { formatAttendanceReportDate } from "../../../../../common/types/attendance/WeeklyAttendanceReport.js";
import { dialog } from "electron";
import fs from "fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import { getWeeklyAttendanceReport } from "../../../../database/repositories/modules/hr/weeklyAttendanceReport.repository.js";
import { getCompanyById } from "../../../../database/repositories/shared/companies.repository.js";
import { WeeklyAttendanceReportDocument } from "../../../../reports/attendance/weekly-attendance-report.js";

export async function saveWeeklyAttendanceReport(companyId: string, date: string, department?: string) {
  const report = await getWeeklyAttendanceReport(companyId, date);
  if (department) report.employees = report.employees.filter((employee) => employee.department === department);
  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Entreprise introuvable.");
  const destination = await dialog.showSaveDialog({
    title: "Enregistrer le rapport de présence hebdomadaire",
    defaultPath: `presences-semaine-${formatAttendanceReportDate(report.weekStart)}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (destination.canceled || !destination.filePath) return { canceled: true };
  const buffer = await renderToBuffer(<WeeklyAttendanceReportDocument report={report} companyName={company.name} />);
  await fs.writeFile(destination.filePath, buffer);
  return { canceled: false, filePath: destination.filePath };
}
