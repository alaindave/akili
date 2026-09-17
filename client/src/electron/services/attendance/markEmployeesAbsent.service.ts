import { markEmployeesAbsentOnline } from "./markEmployeesAbsentOnline.service.js";
import { markEmployeesAbsentLocally } from "./markEmployeesAbsentLocal.service.js";
import { markEmployeesOnLeave } from "./markEmployeesOnLeave.service.js";
import { NetworkService } from "../sync/network.service.js";
import {
  completeMarkAbsent,
  getAttendanceDailyCheckByDate,
} from "../../database/repositories/attendanceDailyCheck.repository.js";

export async function markEmployeesAbsent(
  companyId: string,
  date: string
): Promise<{
  companyId: string;
  absentAttendance: any;
  source: "AUTO_SERVER" | "LOCAL" | "SKIPPED";
  completed: boolean;
  timestamp: string;
}> {
  const now = new Date().toISOString();
  /*
   * ---------------------------------------------------------
   * 1. Make sure employees on leave have been processed first
   * ---------------------------------------------------------
   */

  let dailyCheck = await getAttendanceDailyCheckByDate(companyId, date);

  if (!dailyCheck?.markLeaveCompleted) {
    console.log(
      `MARK EMPLOYEES ON LEAVE HAS NOT RUN FOR ${date}. RUNNING IT NOW...`
    );

    try {
      await markEmployeesOnLeave(companyId, date);
      console.log(`MARK EMPLOYEES ON LEAVE COMPLETED FOR ${date}`);
    } catch (error) {
      console.error(`FAILED TO MARK EMPLOYEES ON LEAVE FOR ${date}`, error);
      throw error;
    }
  } else {
    console.log(`MARK EMPLOYEES ON LEAVE ALREADY COMPLETED FOR ${date}`);
  }

  /*
   * ---------------------------------------------------------
   * 2. Mark remaining employees as absent
   * ---------------------------------------------------------
   */

  const backendAvailable = await NetworkService.canReachBackend();

  if (backendAvailable) {
    try {
      await completeMarkAbsent(companyId, now, date);
      const absentAttendance = await markEmployeesAbsentOnline(companyId, date);
      console.log("ONLINE ABSENT ATTENDANCE", absentAttendance);

      return {
        companyId,
        absentAttendance,
        source: "AUTO_SERVER" as const,
        completed: true,
        timestamp: now,
      };
    } catch (error) {
      console.warn(
        "BACKEND REQUEST FAILED, FALLING BACK TO LOCAL ATTENDANCE",
        error
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * 3. Offline/local fallback
   * ---------------------------------------------------------
   */

  await completeMarkAbsent(companyId, now, date);
  const absentAttendance = await markEmployeesAbsentLocally(companyId, date);
  console.log("OFFLINE ABSENT ATTENDANCE", absentAttendance);

  return {
    companyId,
    absentAttendance,
    source: "LOCAL" as const,
    completed: true,
    timestamp: now,
  };
}
