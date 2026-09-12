import { randomUUID } from "crypto";

import Employee from "../models/employee.model.js";
import Attendance from "../models/attendance.model.js";
import { getNextSyncVersion } from "../utils/syncVersion.js";

export async function markAbsentEmployees(
  companyId?: string,
  date: string = new Date().toISOString().split("T")[0]
) {
  const now = new Date(date);

  const CURRENT_TIMESTAMP = new Date();

  const employees = await Employee.find({
    companyId,
    status: "ACTIF",
    isDeleted: 0,
  }).lean();

  console.log(`FETCHED ACTIVE EMPLOYEES for CID ${companyId}:${employees}`);

  if (employees.length === 0) {
    return {
      companyId,
      date,
      totalEmployees: 0,
      created: 0,
      alreadyExists: 0,
    };
  }

  const employeeIds = employees.map((employee) => employee._id);

  const existingAttendances = await Attendance.find({
    companyId,
    employeeId: { $in: employeeIds },
    date,
  })
    .select("employeeId")
    .lean();

  const existingEmployeeIds = new Set(
    existingAttendances.map((attendance) => attendance.employeeId.toString())
  );

  const employeesToMarkAbsent = employees.filter(
    (employee) => !existingEmployeeIds.has(employee._id.toString())
  );

  /*
   * Nothing to create.
   */
  if (employeesToMarkAbsent.length === 0) {
    return {
      companyId,
      date,
      totalEmployees: employees.length,
      created: 0,
      alreadyExists: employees.length,
    };
  }

  /*
   * Allocate a serverVersion for EVERY new attendance.
   *
   * Do not use the same version for every attendance.
   *
   * The attendance sync counter must advance through the same
   * sequence used by client-pushed attendance records.
   */
  const operations = [];

  for (const employee of employeesToMarkAbsent) {
    const serverVersion = await getNextSyncVersion("attendance");

    operations.push({
      updateOne: {
        filter: {
          companyId,
          employeeId: employee._id,
          date,
        },

        update: {
          $setOnInsert: {
            companyId,
            _id: randomUUID(),
            employeeId: employee._id,
            date,
            status: "ABSENT" as const,
            source: "AUTO_SERVER" as const,
            createdAt: CURRENT_TIMESTAMP,
            updatedAt: CURRENT_TIMESTAMP,
            serverVersion,
          },
        },
        upsert: true,
      },
    });
  }

  const result = await Attendance.bulkWrite(operations);

  const created = result.upsertedCount;
  const alreadyExists = employees.length - created;

  console.log("MARKED ABSENT EMPLOYEES:", {
    companyId,
    date,
    totalEmployees: employees.length,
    created,
    alreadyExists,
  });

  return {
    companyId,
    date,
    totalEmployees: employees.length,
    created,
    alreadyExists,
  };
}
