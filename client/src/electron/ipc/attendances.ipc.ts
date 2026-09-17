import { ipcMain } from "electron";

import {
  createAttendance,
  getAttendanceById,
  getAllAttendance,
  getAttendanceByEmployee,
  getAttendanceByDate,
  updateAttendance,
  deleteAttendance,
  getAttendanceRecord,
  createAbsenceLeaveAttendance,
  getEmployeesWithoutAttendance,
} from "../database/repositories/attendances.repository.js";
import { AttendanceWithEmployee } from "../../common/types/attendance/Attendance.js";
import { markEmployeesAbsent } from "../services/attendance/markEmployeesAbsent.service.js";
import { CreateAttendanceDto } from "../../common/types/attendance/Attendance.js";

export function registerAttendanceIPC() {
  console.log("REGISTERING ATTENDANCES IPC");

  ipcMain.handle(
    "attendance:create",
    async (_, companyId: string, input: CreateAttendanceDto) => {
      return createAttendance(companyId, input);
    }
  );

  ipcMain.handle(
    "attendance:createAbsenceLeave",
    async (
      _,
      companyId: string,
      employeeId: string,
      status: "CONGÉ" | "ABSENT",
      date: string
    ) => {
      return createAbsenceLeaveAttendance(companyId, employeeId, status, date);
    }
  );

  ipcMain.handle("attendance:getAll", async (_, companyId: string) => {
    return getAllAttendance(companyId);
  });

  ipcMain.handle(
    "attendance:getById",
    async (_, companyId: string, _id: string) => {
      return getAttendanceById(companyId, _id);
    }
  );

  ipcMain.handle(
    "attendance:getByEmployee",
    async (_, companyId: string, employeeId: string) => {
      return getAttendanceByEmployee(companyId, employeeId);
    }
  );

  ipcMain.handle(
    "attendance:getEmployeesWithoutAttendance",
    async (_, companyId: string, date: string) => {
      return getEmployeesWithoutAttendance(companyId, date);
    }
  );

  ipcMain.handle(
    "attendance:getByDate",
    async (_, companyId: string, date: string) => {
      return getAttendanceByDate(companyId, date);
    }
  );

  ipcMain.handle(
    "attendance:getAttendanceRecord",
    async (_, companyId: string, employeeId: string, date: string) => {
      return getAttendanceRecord(companyId, employeeId, date);
    }
  );

  ipcMain.handle(
    "attendance:update",
    async (
      _,
      companyId: string,
      _id: string,
      date: string,
      updates: Partial<AttendanceWithEmployee>
    ) => {
      return updateAttendance(companyId, _id, date, updates);
    }
  );

  ipcMain.handle(
    "attendance:mark-absent",
    async (_, companyId: string, date: string) => {
      return markEmployeesAbsent(companyId, date);
    }
  );

  ipcMain.handle(
    "attendance:delete",
    async (_, companyId: string, _id: string) => {
      return deleteAttendance(companyId, _id);
    }
  );
}
