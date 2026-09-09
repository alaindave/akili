import { ipcMain } from "electron";

import {
  createAttendanceDailyCheck,
  getAttendanceDailyCheckById,
  getAttendanceDailyCheckByDate,
  getAllAttendanceDailyChecks,
  completeMarkAbsent,
  lockAttendanceDailyCheck,
  markAttendanceManagerNotified,
} from "../database/repositories/attendanceDailyCheck.repository.js";
import type { AttendanceDailyCheckPreparationInput } from "../../common/types/AttendanceDailyCheck.js";
import {
  LockAttendanceDailyCheckInput,
  MarkManagerNotifiedInput,
  VerifyAttendanceDailyCheckInput,
} from "../../common/types/AttendanceDailyCheck.js";
import { verifyDailyAttendance } from "../services/attendance/attendanceDailyCheck.service.js";

export function registerAttendanceDailyCheckIPC() {
  console.log("REGISTERING ABSENCE DAILY CHECK IPC...");
  ipcMain.handle(
    "attendanceDailyCheck:create",
    async (_, input: AttendanceDailyCheckPreparationInput) => {
      return createAttendanceDailyCheck(input);
    }
  );

  ipcMain.handle(
    "attendanceDailyCheck:getById",
    async (_, companyId: string, _id: string) => {
      return getAttendanceDailyCheckById(companyId, _id);
    }
  );

  ipcMain.handle(
    "attendanceDailyCheck:getByDate",
    async (_, companyId: string, date: string) => {
      return getAttendanceDailyCheckByDate(companyId, date);
    }
  );

  ipcMain.handle("attendanceDailyCheck:getAll", async () => {
    return getAllAttendanceDailyChecks();
  });

  ipcMain.handle(
    "attendanceDailyCheck:completeMarkAbsent",
    async (_, companyId: string, completedAt: string, date: string) => {
      return completeMarkAbsent(companyId, completedAt, date);
    }
  );

  ipcMain.handle(
    "attendanceDailyCheck:verify",
    async (_, input: VerifyAttendanceDailyCheckInput) => {
      return verifyDailyAttendance(input);
    }
  );

  ipcMain.handle(
    "attendanceDailyCheck:notifyManager",
    async (_, input: MarkManagerNotifiedInput) => {
      return markAttendanceManagerNotified(input);
    }
  );

  ipcMain.handle(
    "attendanceDailyCheck:lock",
    async (_, input: LockAttendanceDailyCheckInput) => {
      return lockAttendanceDailyCheck(input);
    }
  );
}
