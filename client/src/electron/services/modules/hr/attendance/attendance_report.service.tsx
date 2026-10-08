import { dialog } from "electron";
import { formatReportDate } from "../../../../../common/utils/reportDate.js";
import fs from "fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import { AttendanceReportDocument } from "../../../../reports/attendance/attendance-report.js";
import { DailyAttendanceReport } from "../../../../../common/types/hr/attendance/AttendanceReport.js";
import { getCompanyById } from "../../../../database/repositories/shared/companies.repository.js";
import { getDailyAttendanceReport } from "../../../../database/repositories/modules/hr/attendances.repository.js";

export interface GeneratedAttendanceReport {
  filename: string;
  pdfBuffer: Buffer;
}

/** Shared data for the on-screen report and PDF export. */
export async function getAttendanceReportData(
  companyId: string,
  date: string
): Promise<DailyAttendanceReport> {
  /*
   * ------------------------------------------------------------
   * LOAD ATTENDANCE
   * ------------------------------------------------------------
   */

  const rows = await getDailyAttendanceReport(companyId, date);

  const employees = rows.map((row) => ({
    employeeId: row.employeeId,
    matricule: row.matricule ?? "--",
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    department: row.department ?? null,
    role: row.role ?? null,
    clockIn: row.clockIn ?? null,
    clockOut: row.clockOut ?? null,
    status: row.status ?? "ABSENT",
  }));

  /*
   * ------------------------------------------------------------
   * LOAD COMPANY FROM LOCAL SQLITE
   * ------------------------------------------------------------
   */

  const company = await getCompanyById(companyId);

  if (!company) {
    throw new Error(`Entreprise introuvable dans SQLite: ${companyId}`);
  }

  /*
   * ------------------------------------------------------------
   * BUILD REPORT
   * ------------------------------------------------------------
   */

  const report: DailyAttendanceReport = {
    date,
    employees,

    company: {
      name: company.name ?? "",
      address: company.address ?? "",
      city: company.city ?? "",
      country: company.country ?? "",
      phone: company.phone ?? "",
      email: company.email ?? "",
    },
  };

  return report;
}

/** Generates the daily attendance PDF without opening a save dialog. */
export async function generateAttendanceReport(
  companyId: string,
  date: string
): Promise<GeneratedAttendanceReport> {
  const report = await getAttendanceReportData(companyId, date);

  const pdfBuffer = await renderToBuffer(
    <AttendanceReportDocument report={report} />
  );

  return {
    filename: `rapport-presences-${formatReportDate(date)}.pdf`,

    pdfBuffer: Buffer.from(pdfBuffer),
  };
}

export async function saveAttendanceReport(companyId: string, date: string) {
  /*
   * Ask where to save the PDF.
   */
  const result = await dialog.showSaveDialog({
    title: "Enregistrer le rapport de présence",

    defaultPath: `rapport-presences-${formatReportDate(date)}.pdf`,

    filters: [
      {
        name: "PDF",
        extensions: ["pdf"],
      },
    ],
  });

  if (result.canceled || !result.filePath) {
    return {
      canceled: true,
    };
  }

  const { pdfBuffer } = await generateAttendanceReport(companyId, date);

  /*
   * Save PDF.
   */
  await fs.writeFile(result.filePath, pdfBuffer);

  return {
    canceled: false,
    filePath: result.filePath,
  };
}
