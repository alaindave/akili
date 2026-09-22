import { invoke } from "../../ipc/ipc.cjs";

type AttendanceWithEmployee = import("../../../common/types/attendance/Attendance", {
  with: { "resolution-mode": "require" },
}).AttendanceWithEmployee;
type CreateAttendanceDto = import("../../../common/types/attendance/Attendance", {
  with: { "resolution-mode": "require" },
}).CreateAttendanceDto;


type TransportAllowanceWeeklyReport = import( "../../../common/types/TransportAllowance", { with: { "resolution-mode": "require" }, } ).TransportAllowanceWeeklyReport;

export const attendanceApi = {
  create: (companyId: string, input: CreateAttendanceDto) =>
    invoke("attendance:create", companyId, input),

  createAbsenceLeave: (
    companyId: string,
    employeeId: string,
    status: "CONGÉ" | "ABSENT",
    date: string
  ) =>
    invoke(
      "attendance:createAbsenceLeave",
      companyId,
      employeeId,
      status,
      date
    ),

  getAll: (companyId: string) => invoke("attendance:getAll", companyId),

  getById: (companyId: string, _id: string) =>
    invoke("attendance:getById", companyId, _id),

  getByEmployee: (companyId: string, employeeId: string) =>
    invoke("attendance:getByEmployee", companyId, employeeId),

  getEmployeesWithoutAttendance: (companyId: string, date: string) =>
    invoke("attendance:getEmployeesWithoutAttendance", companyId, date),

  getByDate: (companyId: string, date: string) =>
    invoke("attendance:getByDate", companyId, date),

  getAttendanceRecord: (companyId: string, employeeId: string, date: string) =>
    invoke("attendance:getAttendanceRecord", companyId, employeeId, date),

  update: (
    companyId: string,
    _id: string,
    date: string,
    updates: Partial<AttendanceWithEmployee>
  ) => invoke("attendance:update", companyId, _id, date, updates),

  markAbsent: (
    companyId: string,
    date: string
  ): Promise<{
    companyId: string;
    absentAttendance: any;
    source: "AUTO_SERVER" | "LOCAL" | "SKIPPED";
    completed: boolean;
    timestamp: string;
  }> => invoke("attendance:mark-absent", companyId, date),

  delete: (companyId: string, _id: string) =>
    invoke("attendance:delete", companyId, _id),

  attendanceReports: {
    savePdf: (companyId: string, date: string) =>
      invoke("attendance-report:save-pdf", companyId, date),
  },

  transportAllowance: {
    createWeeklyReport: (
      companyId: string,
      weekStart: string
    ): Promise<TransportAllowanceWeeklyReport> =>
      invoke("transportAllowance:createWeeklyReport", companyId, weekStart),
  },
};
