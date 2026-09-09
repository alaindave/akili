import { randomUUID } from "crypto";
import { getEmployeesWhoDidNotClockIn } from "../../database/repositories/attendances.repository.js";
import { createAbsentAttendance } from "../../database/repositories/attendances.repository.js";
import Employee from "../../../common/types/Employee.js";

export async function markEmployeesAbsentLocally(
  companyId: string,
  date: string
) {
  const now = new Date().toISOString();
  const today = new Date(date);
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log("ABSENCE CHECK SKIPPED: WEEKEND");
    return;
  }

  const employees: Employee[] = await getEmployeesWhoDidNotClockIn(
    companyId,
    date
  );

  const createdAttendances = [];

  for (const employee of employees) {
    const absentAttendance = {
      companyId: employee.companyId,
      _id: randomUUID(),
      employeeId: employee?._id,
      date,
      status: "ABSENT" as const,
      source: "AUTO_CLIENT" as const,
      createdAt: now,
      updatedAt: now,
    };

    const savedAttendance = await createAbsentAttendance(absentAttendance);

    createdAttendances.push(savedAttendance);
  }

  return createdAttendances;
}
