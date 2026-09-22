import { all } from "../../../db.js";

export interface TransportAllowanceEmployeeRow {
  companyId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  matricule: string;
  department: string;
  role: string;
  mondayDate: string;
  mondayStatus: string | null;
  tuesdayDate: string;
  tuesdayStatus: string | null;
  wednesdayDate: string;
  wednesdayStatus: string | null;
  thursdayDate: string;
  thursdayStatus: string | null;
  fridayDate: string;
  fridayStatus: string | null;
}

/**
 * Get all active employees and their attendance
 * from Monday through Friday for the requested week.
 *
 * weekStart must be a Monday in YYYY-MM-DD format.
 */
export async function getWeeklyTransportAllowanceData(
  companyId: string,
  weekStart: string
): Promise<TransportAllowanceEmployeeRow[]> {
  const mondayDate = weekStart;

  const tuesdayDate = addDays(weekStart, 1);

  const wednesdayDate = addDays(weekStart, 2);

  const thursdayDate = addDays(weekStart, 3);

  const fridayDate = addDays(weekStart, 4);

  const rows = await all<TransportAllowanceEmployeeRow>(
    `
      SELECT
        e.companyId AS companyId,
        e._id AS employeeId,
        e.firstName AS firstName,
        e.lastName AS lastName,
        e.matricule AS matricule,
        e.department AS department,
        e.role AS role,
        ? AS mondayDate,
        mon.status AS mondayStatus,
        ? AS tuesdayDate,
        tue.status AS tuesdayStatus,
        ? AS wednesdayDate,
        wed.status AS wednesdayStatus,
        ? AS thursdayDate,
        thu.status AS thursdayStatus,
        ? AS fridayDate,
        fri.status AS fridayStatus

      FROM employees e

      LEFT JOIN attendances mon
        ON mon.employeeId = e._id
        AND mon.companyId = ?
        AND mon.date = ?
        AND mon.isDeleted = 0

      LEFT JOIN attendances tue
        ON tue.employeeId = e._id
        AND tue.companyId = ?
        AND tue.date = ?
        AND tue.isDeleted = 0

      LEFT JOIN attendances wed
        ON wed.employeeId = e._id
        AND wed.companyId = ?
        AND wed.date = ?
        AND wed.isDeleted = 0

      LEFT JOIN attendances thu
        ON thu.employeeId = e._id
        AND thu.companyId = ?
        AND thu.date = ?
        AND thu.isDeleted = 0

      LEFT JOIN attendances fri
        ON fri.employeeId = e._id
        AND fri.companyId = ?
        AND fri.date = ?
        AND fri.isDeleted = 0

      WHERE e.companyId = ?

      AND (
        e.isDeleted = 0
        OR e.isDeleted IS NULL
      )

      ORDER BY
        e.lastName ASC,
        e.firstName ASC
    `,
    [
      mondayDate,
      tuesdayDate,
      wednesdayDate,
      thursdayDate,
      fridayDate,
      companyId,
      mondayDate,
      companyId,
      tuesdayDate,
      companyId,
      wednesdayDate,
      companyId,
      thursdayDate,
      companyId,
      fridayDate,
      companyId,
    ]
  );

  return rows;
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00`);

  date.setDate(date.getDate() + days);

  return formatDate(date);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
