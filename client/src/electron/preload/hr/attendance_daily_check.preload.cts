type AttendanceDailyCheckPreparationInput  = import(
  "../../../common/types/attendance/AttendanceDailyCheck",
  {
    with: { "resolution-mode": "require" },
  }
).AttendanceDailyCheckPreparationInput;
type VerifyAttendanceDailyCheckInput  = import(
  "../../../common/types/attendance/AttendanceDailyCheck",
  {
    with: { "resolution-mode": "require" },
  }
).VerifyAttendanceDailyCheckInput ;
type MarkManagerNotifiedInput  = import(
  "../../../common/types/attendance/AttendanceDailyCheck",
  {
    with: { "resolution-mode": "require" },
  }
).MarkManagerNotifiedInput ;
type LockAttendanceDailyCheckInput  = import(
  "../../../common/types/attendance/AttendanceDailyCheck",
  {
    with: { "resolution-mode": "require" },
  }
).LockAttendanceDailyCheckInput ;
import { invoke } from "../../ipc/ipc.cjs";

export const attendanceDailyCheckApi = {
  create: (input: AttendanceDailyCheckPreparationInput) =>
    invoke("attendanceDailyCheck:create", input),

  getById: (companyId: string, _id: string) =>
    invoke("attendanceDailyCheck:getById", companyId, _id),

  getByDate: (companyId: string, date: string) =>
    invoke("attendanceDailyCheck:getByDate", companyId, date),

  getAll: () =>
    invoke("attendanceDailyCheck:getAll"),

  verify: (input: VerifyAttendanceDailyCheckInput) =>
    invoke("attendanceDailyCheck:verify", input),

  notifyManager: (input: MarkManagerNotifiedInput) =>
    invoke("attendanceDailyCheck:notifyManager", input),

  lock: (input: LockAttendanceDailyCheckInput) =>
    invoke("attendanceDailyCheck:lock", input),
};
