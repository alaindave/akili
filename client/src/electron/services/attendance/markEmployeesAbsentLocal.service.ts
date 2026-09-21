import { randomUUID } from "crypto";
import { getEmployeesWhoDidNotClockIn } from "../../database/repositories/attendances.repository.js";
import { createAbsentAttendance } from "../../database/repositories/attendances.repository.js";
import Employee from "../../../common/types/Employee.js";

export async function markEmployeesAbsentLocally(
  companyId: string,
  date: string
) {
  const now = new Date().toISOString();

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
