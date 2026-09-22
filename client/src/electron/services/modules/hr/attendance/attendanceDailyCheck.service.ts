import { Attendance } from "../../../../../common/types/attendance/Attendance.js";
import {
  VerifyAttendanceDailyCheckInput,
  VerifyDailyAttendanceResult,
} from "../../../../../common/types/attendance/AttendanceDailyCheck.js";
import {
  getAttendanceDailyCheckByDate,
  verifyAttendanceDailyCheck,
} from "../../../../database/repositories/modules/hr/attendanceDailyCheck.repository.js";
import { getAttendanceByDate } from "../../../../database/repositories/modules/hr/attendances.repository.js";
import { getAllEmployees } from "../../../../database/repositories/modules/hr/employees.repository.js";

export async function verifyDailyAttendance(
  input: VerifyAttendanceDailyCheckInput
): Promise<VerifyDailyAttendanceResult> {
  console.log("VERIFY INPUT", input);
  /*
   * 1. Get the daily check.
   */
  const check = await getAttendanceDailyCheckByDate(
    input.companyId,
    input.date
  );

  if (!check) {
    throw new Error(
      `Impossible de verifier la presence du  ${new Date(
        input.date
      ).toLocaleDateString("fr-FR")} `
    );
  }

  /*
   * 2. Make sure automatic attendance preparation is complete.
   *
   * markEmployeesOnLeave() runs first.
   * markEmployeesAbsent() runs after 09:00.
   */
  if (!check.markLeaveCompleted) {
    throw new Error(
      `Impossible de verifier la presence du  ${new Date(
        input.date
      ).toLocaleDateString(
        "fr-FR"
      )}.Les employes en conge n'ont pas ete enregistres.`
    );
  }

  if (!check.markAbsentCompleted) {
    throw new Error(
      `Impossible de verifier la presence du  ${new Date(
        input.date
      ).toLocaleDateString(
        "fr-FR"
      )}. Les employes absent n'ont pas encore ete enregistres. `
    );
  }

  /*
   * 3. Prevent verification of locked attendance.
   */
  if (check.status === "LOCKED") {
    throw new Error(`LA PRESENCE DU ${input.date} EST DEJA VERROUILLE.`);
  }

  /*
   * 4. Prevent duplicate verification.
   */
  if (check.status === "VERIFIED") {
    throw new Error(`LA PRESENCE DU ${input.date} A DEJA ETE VERIFIER.`);
  }

  /*
   * 5. Get all active employees.
   */
  const employees = await getAllEmployees(input.companyId);

  const activeEmployees = employees.filter(
    (employee) => employee.status === "ACTIF" && employee.isDeleted === 0
  );

  /*
   * 6. Get all attendance records for the date.
   */
  const attendances: Attendance[] = await getAttendanceByDate(
    input.companyId,
    input.date
  );

  /*
   * 7. Build a set of employees who have attendance records.
   */
  const attendanceEmployeeIds = new Set(
    attendances
      .filter((attendance) => attendance.isDeleted === 0)
      .map((attendance) => attendance.employeeId)
  );

  console.log(`ATTENDANCE RECORDS FOR ${input.date}`, attendances);

  console.log(
    `SET OF EMPLOYEES WITH ATTENDANCE RECORDS FOR ${input.date}`,
    attendanceEmployeeIds
  );

  /*
   * 8. Find active employees without attendance.
   */
  const missingEmployeeIds = activeEmployees
    .filter((employee) => !attendanceEmployeeIds.has(employee._id))
    .map((employee) => employee._id);

  console.log(
    ` EMPLOYEES WITH MISSING ATTENDANCE RECORDS FOR ${input.date}`,
    missingEmployeeIds
  );

  /*
   * 9. Do not allow verification while attendance
   *    records are missing.
   */
  if (missingEmployeeIds.length > 0) {
    throw new Error(
      `Impossible de vérifier la présence pour la date du ${new Date(
        input.date
      ).toLocaleDateString("fr-FR")}. ` +
        `${missingEmployeeIds.length} employé(s) ` +
        `manquent a l'appel.`
    );
  }

  //  10. Make sure every employee who worked
  //      has clocked out.

  const employeesWithoutClockOut = attendances.filter(
    (attendance) =>
      attendance.isDeleted === 0 &&
      attendance.status !== "ABSENT" &&
      attendance.status !== "CONGÉ" &&
      !attendance.clockOut
  );

  console.log(
    `EMPLOYEES WITHOUT CLOCK OUT FOR ${input.date}`,
    employeesWithoutClockOut
  );

  if (employeesWithoutClockOut.length > 0) {
    throw new Error(
      `Impossible de vérifier la présence pour la date du ${new Date(
        input.date
      ).toLocaleDateString("fr-FR")}. ` +
        `${employeesWithoutClockOut.length} employé(s) ` +
        `n'ont pas encore enregistré leur heure de sortie.`
    );
  }

  /*
   * 11. All validation passed.
   *
   * The repository now performs the actual state
   * transition from OPEN → VERIFIED.
   */
  const verified = await verifyAttendanceDailyCheck({
    companyId: input.companyId,
    date: input.date,
    verifiedBy: input.verifiedBy,
  });

  /*
   * 11. Return verification information to the caller.
   */
  return {
    companyId: input.companyId,
    success: true,
    date: input.date,
    checkId: verified._id,
    verifiedBy: input.verifiedBy,
    employeeCount: activeEmployees.length,
    attendanceCount: attendances.filter(
      (attendance) => attendance.isDeleted === 0
    ).length,
    missingEmployeeIds: [],
  };
}
