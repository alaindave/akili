import { getAttendanceClockIn, saveAttendanceClockIn } from "../../../database/repositories/modules/hr/attendanceSettings.repository.js";
import { ipcMain } from "electron";

import type { AttendanceDailyCheckPreparationInput } from "../../../../common/types/attendance/AttendanceDailyCheck.js";
import {
  LockAttendanceDailyCheckInput,
  MarkManagerNotifiedInput,
  VerifyAttendanceDailyCheckInput,
} from "../../../../common/types/attendance/AttendanceDailyCheck.js";
import { verifyDailyAttendance } from "../../../services/modules/hr/attendance/attendanceDailyCheck.service.js";
import {
  completeMarkAbsent,
  reopenAttendanceDailyCheck,
  createAttendanceDailyCheck,
  getAllAttendanceDailyChecks,
  getAttendanceDailyCheckByDate,
  getAttendanceDailyCheckById,
  lockAttendanceDailyCheck,
  markAttendanceManagerNotified,
} from "../../../database/repositories/modules/hr/attendanceDailyCheck.repository.js";

export function registerAttendanceDailyCheckIPC() {
  ipcMain.handle("attendanceDailyCheck:reopen", (_, companyId: string, date: string, userId: string) => reopenAttendanceDailyCheck(companyId, date, userId));
  ipcMain.handle("attendanceSettings:getClockIn", (_, companyId: string) => getAttendanceClockIn(companyId));
  ipcMain.handle("attendanceSettings:saveClockIn", (_, companyId: string, userId: string, time: string) => saveAttendanceClockIn(companyId, userId, time));
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
