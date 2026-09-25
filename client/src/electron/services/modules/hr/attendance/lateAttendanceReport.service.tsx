import { dialog } from "electron";
import fs from "fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import { getLateAttendanceReport } from "../../../../database/repositories/modules/hr/lateAttendanceReport.repository.js";
import { getCompanyById } from "../../../../database/repositories/shared/companies.repository.js";
import { LateAttendanceReportDocument } from "../../../../reports/attendance/late-attendance-report.js";
import { lateReportDate } from "../../../../../common/types/attendance/LateAttendanceReport.js";

export async function saveLateAttendanceReport(
  companyId: string,
  startDate: string,
  endDate: string
) {
  const records = await getLateAttendanceReport(companyId, startDate, endDate);
  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Entreprise introuvable.");
  const destination = await dialog.showSaveDialog({
    title: "Enregistrer le rapport des retards",
    defaultPath: `retards-${lateReportDate(startDate)}-${lateReportDate(
      endDate
    )}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (destination.canceled || !destination.filePath) return { canceled: true };
  const buffer = await renderToBuffer(
    <LateAttendanceReportDocument
      records={records}
      companyName={company.name}
      startDate={startDate}
      endDate={endDate}
    />
  );
  await fs.writeFile(destination.filePath, buffer);
  return { canceled: false, filePath: destination.filePath };
}
