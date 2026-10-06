import { getLateAttendanceReport } from "../../../database/repositories/modules/hr/lateAttendanceReport.repository.js";
import { saveLateAttendanceReport } from "../../../services/modules/hr/attendance/lateAttendanceReport.service.js";
import { getWeeklyAttendanceReport } from "../../../database/repositories/modules/hr/weeklyAttendanceReport.repository.js";
import { saveWeeklyAttendanceReport } from "../../../services/modules/hr/attendance/weeklyAttendanceReport.service.js";
import { ipcMain } from "electron";
import { saveAttendanceReport } from "../../../services/modules/hr/attendance/attendance_report.service.js";

export function registerAttendanceReportIPC() {
  ipcMain.handle("attendance-report:late", (_, companyId: string, startDate: string, endDate: string) =>
    getLateAttendanceReport(companyId, startDate, endDate));
  ipcMain.handle("attendance-report:save-late-pdf", (_, companyId: string, startDate: string, endDate: string) =>
    saveLateAttendanceReport(companyId, startDate, endDate));
  ipcMain.handle("attendance-report:weekly", (_, companyId: string, date: string) =>
    getWeeklyAttendanceReport(companyId, date)
  );
  ipcMain.handle("attendance-report:save-weekly-pdf", (_, companyId: string, date: string, department?: string) =>
    saveWeeklyAttendanceReport(companyId, date, department)
  );
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
