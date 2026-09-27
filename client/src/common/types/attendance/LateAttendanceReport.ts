export interface LateAttendanceRecord {
  _id: string;
  employeeId: string;
  date: string;
  firstName: string;
  lastName: string;
  matricule: string;
  department: string;
  clockIn: string | null;
  lateMinutes: number | null;
}

export function lateReportDate(date: string): string {
  return date.split("-").reverse().join("-");
}

export function lateReportTime(value: string | null): string {
  if (!value) return "—";
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value.slice(0, 5);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function topLateEmployees(records: LateAttendanceRecord[]) {
  const employees = new Map<string, {
    employeeId: string;
    firstName: string;
    lastName: string;
    matricule: string;
    lateCount: number;
    totalLateMinutes: number;
  }>();

  for (const record of records) {
    const employee = employees.get(record.employeeId) ?? {
      employeeId: record.employeeId,
      firstName: record.firstName,
      lastName: record.lastName,
      matricule: record.matricule,
      lateCount: 0,
      totalLateMinutes: 0,
    };
    employee.lateCount += 1;
    employee.totalLateMinutes += record.lateMinutes ?? 0;
    employees.set(record.employeeId, employee);
  }

  return [...employees.values()]
    .sort((a, b) =>
      b.lateCount - a.lateCount ||
      b.totalLateMinutes - a.totalLateMinutes ||
      a.lastName.localeCompare(b.lastName, "fr") ||
      a.firstName.localeCompare(b.firstName, "fr") ||
      a.employeeId.localeCompare(b.employeeId)
    )
    .slice(0, 3);
}
