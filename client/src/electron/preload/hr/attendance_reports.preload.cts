type LateAttendanceRecord = import("../../../common/types/attendance/LateAttendanceReport", { with: { "resolution-mode": "require" } }).LateAttendanceRecord;
type WeeklyAttendanceReport = import("../../../common/types/attendance/WeeklyAttendanceReport", { with: { "resolution-mode": "require" } }).WeeklyAttendanceReport;
import { invoke } from "../../ipc/ipc.cjs";

export const attendanceReportsApi = {
  getLate: (companyId: string, startDate: string, endDate: string) =>
    invoke<LateAttendanceRecord[]>("attendance-report:late", companyId, startDate, endDate),
  saveLatePdf: (companyId: string, startDate: string, endDate: string) =>
    invoke<{ canceled: boolean; filePath?: string }>("attendance-report:save-late-pdf", companyId, startDate, endDate),
  getWeekly: (companyId: string, date: string) =>
    invoke<WeeklyAttendanceReport>("attendance-report:weekly", companyId, date),
  saveWeeklyPdf: (companyId: string, date: string, department?: string) =>
    invoke<{ canceled: boolean; filePath?: string }>("attendance-report:save-weekly-pdf", companyId, date, department),
  savePdf: (companyId: string, date: string) =>
    invoke<{ canceled: boolean; filePath?: string }>("attendance-report:save-pdf", companyId, date),
};
