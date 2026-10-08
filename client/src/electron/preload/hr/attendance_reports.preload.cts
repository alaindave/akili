type LateAttendanceRecord = import("../../../common/types/hr/attendance/LateAttendanceReport", { with: { "resolution-mode": "require" } }).LateAttendanceRecord;
type WeeklyAttendanceReport = import("../../../common/types/hr/attendance/WeeklyAttendanceReport", { with: { "resolution-mode": "require" } }).WeeklyAttendanceReport;
import { invoke } from "../../ipc/ipc.cjs";
type DailyAttendanceReport = import("../../../common/types/hr/attendance/AttendanceReport", { with: { "resolution-mode": "require" } }).DailyAttendanceReport;

export const attendanceReportsApi = {
  getDaily: (companyId: string, date: string) =>
    invoke<DailyAttendanceReport>("attendance-report:daily", companyId, date),
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
