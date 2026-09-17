import { dialog } from "electron";
import fs from "fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDailyAttendanceReport } from "../../database/repositories/attendances.repository.js";
import { AttendanceReportDocument } from "../../reports/attendance/attendance-report.js";
import { DailyAttendanceReport } from "../../../common/types/attendance/AttendanceReport.js";

export interface GeneratedAttendanceReport {
  filename: string;
  pdfBuffer: Buffer;
}

/** Generates the daily attendance PDF without opening a save dialog. */
export async function generateAttendanceReport(
  companyId: string,
  date: string
): Promise<GeneratedAttendanceReport> {
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

  const report: DailyAttendanceReport = {
    date,
    employees,
    company: {
      name: "AFRITAN",
      address: "10 Boulevard Melchior Ndadaye",
      city: "Bujumbura,Burundi",
    },
  };

  const pdfBuffer = await renderToBuffer(
    <AttendanceReportDocument report={report} />
  );

  return {
    filename: `rapport-presences-${new Date(date).toLocaleDateString(
      "fr-FR"
    )}.pdf`,
    pdfBuffer: Buffer.from(pdfBuffer),
  };
}

export async function saveAttendanceReport(companyId: string, date: string) {
  /*
   * Ask where to save the PDF.
   */
  const result = await dialog.showSaveDialog({
    title: "Enregistrer le rapport de présence",
    defaultPath: `rapport-presences-${date}.pdf`,
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
