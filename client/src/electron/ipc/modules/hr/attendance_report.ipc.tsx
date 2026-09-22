import { ipcMain } from "electron";
import { saveAttendanceReport } from "../../../services/modules/hr/attendance/attendance_report.service.js";

export function registerAttendanceReportIPC() {
  ipcMain.handle(
    "attendance-report:save-pdf",
    async (_, companyId: string, date: string) => {
      try {
        return await saveAttendanceReport(companyId, date);
      } catch (error) {
        console.error("FAILED TO SAVE ATTENDANCE REPORT:", error);
        throw error;
      }
    }
  );
}
