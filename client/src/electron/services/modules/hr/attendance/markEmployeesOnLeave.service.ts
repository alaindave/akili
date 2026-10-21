import { getOngoingApprovedLeaveTimeOff } from "../../../../database/repositories/modules/hr/timeOff.repository.js";

import {
  createAbsenceLeaveAttendance,
  getAttendanceRecord,
} from "../../../../database/repositories/modules/hr/attendances.repository.js";
import { createAttendanceDailyCheck } from "../../../../database/repositories/modules/hr/attendanceDailyCheck.repository.js";

export async function markEmployeesOnLeave(
  companyId: string,
  date: string = new Date().toISOString().split("T")[0]
) {
  console.log("markEmployeesOnLeave SERVICE INITIATED... ");
  const leaves = await getOngoingApprovedLeaveTimeOff(companyId, date);
  const now = new Date().toISOString();
  console.log("ONGOING LEAVES:", leaves);
  console.log("Date:", date);

  for (const leave of leaves) {
    const existingAttendance = await getAttendanceRecord(
      companyId,
      leave.employeeId,
      date
    );

    if (existingAttendance) {
      continue;
    }
    await createAbsenceLeaveAttendance(
      companyId,
      leave.employeeId,
      "CONGÉ",
      date
    );
  }

  console.log("markEmployeesOnLeave COMPLETED");

  await createAttendanceDailyCheck({
    companyId,
    markAbsentCompleted: {
      completed: false,
      completedAt: null,
    },
    markLeaveCompleted: {
      completed: true,
      completedAt: now,
    },
    date,
  });

  return {
    completed: true,
    completedAt: now,
  };
}
