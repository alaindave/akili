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
  const today = new Date(date);

  const dayOfWeek = today.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log("ABSENCE CHECK SKIPPED: WEEKEND");
    return {
      companyId,
      absentAttendance: null,
      source: "SKIPPED" as const,
      completed: false,
      timestamp: now,
    };
  }

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
      const absentAttendance = await markEmployeesAbsentOnline(companyId, date);

      console.log("ONLINE ABSENT ATTENDANCE", absentAttendance);

      await completeMarkAbsent(companyId, now, date);

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

  const absentAttendance = await markEmployeesAbsentLocally(companyId, date);

  console.log("OFFLINE ABSENT ATTENDANCE", absentAttendance);

  await completeMarkAbsent(companyId, now, date);

  return {
    companyId,
    absentAttendance,
    source: "LOCAL" as const,
    completed: true,
    timestamp: now,
  };
}
