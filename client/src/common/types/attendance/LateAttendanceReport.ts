export interface LateAttendanceRecord {
  _id: string;
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
