import { all } from "../../../db.js";
import { LateAttendanceRecord } from "../../../../../common/types/attendance/LateAttendanceReport.js";
import { attendanceWeekDates } from "../../../../../common/types/attendance/WeeklyAttendanceReport.js";

export async function getLateAttendanceReport(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<LateAttendanceRecord[]> {
  if (typeof companyId !== "string" || !companyId.trim())
    throw new Error("Entreprise requise.");
  attendanceWeekDates(startDate);
  attendanceWeekDates(endDate);
  if (startDate > endDate) throw new Error("Période invalide.");
  return all<LateAttendanceRecord>(
    `
    SELECT a._id, a.date, e.firstName, e.lastName, e.matricule, e.department, a.clockIn, a.lateMinutes
    FROM attendances a JOIN employees e ON e._id = a.employeeId AND e.companyId = a.companyId
    WHERE a.companyId = ? AND a.date BETWEEN ? AND ? AND a.status = 'RETARD'
      AND COALESCE(a.isDeleted, 0) = 0 AND COALESCE(e.isDeleted, 0) = 0
    ORDER BY a.date, e.lastName, e.firstName, a._id
  `,
    [companyId, startDate, endDate]
  );
}
