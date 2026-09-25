import { all } from "../../../db.js";
import { attendanceDayLabel, attendanceWeekDates, WeeklyAttendanceReport } from "../../../../../common/types/attendance/WeeklyAttendanceReport.js";

export async function getWeeklyAttendanceReport(companyId: string, date: string): Promise<WeeklyAttendanceReport> {
  if (typeof companyId !== "string" || !companyId.trim()) throw new Error("Entreprise requise.");
  const dates = attendanceWeekDates(date);
  const employees = await all<{
    employeeId: string; matricule: string; firstName: string; lastName: string;
    department: string; dateHired: string;
  }>(`SELECT e._id AS employeeId, e.matricule, e.firstName, e.lastName, e.department, e.dateHired
      FROM employees e WHERE e.companyId = ? AND COALESCE(e.isDeleted, 0) = 0
      AND substr(e.dateHired, 1, 10) <= ?
      AND (e.status = 'ACTIF' OR EXISTS (
        SELECT 1 FROM attendances a WHERE a.companyId = e.companyId AND a.employeeId = e._id
        AND a.date BETWEEN ? AND ? AND COALESCE(a.isDeleted, 0) = 0
      )) ORDER BY e.lastName, e.firstName`, [companyId, dates[4], dates[0], dates[4]]);
  const records = await all<{
    employeeId: string; date: string; clockIn: string | null; status: string | null;
  }>(`SELECT employeeId, date, clockIn, status FROM attendances
      WHERE companyId = ? AND date BETWEEN ? AND ? AND COALESCE(isDeleted, 0) = 0
      ORDER BY updatedAt ASC, createdAt ASC, _id ASC`, [companyId, dates[0], dates[4]]);
  const leaves = await all<{ employeeId: string; startDate: string; endDate: string }>(
    `SELECT employeeId, startDate, endDate FROM leaves
     WHERE companyId = ? AND status = 'APPROUVÉ' AND COALESCE(isDeleted, 0) = 0
       AND substr(startDate, 1, 10) <= ? AND substr(endDate, 1, 10) >= ?`,
    [companyId, dates[4], dates[0]]
  );
  const byDay = new Map(records.map((record) => [`${record.employeeId}:${record.date}`, record]));
  return {
    weekStart: dates[0], dates,
    employees: employees.map((employee) => ({
      ...employee,
      days: dates.map((day) => {
        if (day < employee.dateHired.slice(0, 10)) return "—";
        const record = byDay.get(`${employee.employeeId}:${day}`);
        const onLeave = leaves.some((leave) => leave.employeeId === employee.employeeId
          && leave.startDate.slice(0, 10) <= day && leave.endDate.slice(0, 10) >= day);
        return attendanceDayLabel({ ...record, onLeave: onLeave ? 1 : 0 });
      }),
    })),
  };
}
