export interface WeeklyAttendanceReport {
  weekStart: string;
  dates: string[];
  employees: {
    employeeId: string;
    matricule: string;
    firstName: string;
    lastName: string;
    department: string;
    days: string[];
  }[];
}

export function formatAttendanceReportDate(date: string): string {
  return date.split("-").reverse().join("-");
}

export function attendanceWeekDates(date: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date invalide.");
  const day = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== date) {
    throw new Error("Date invalide.");
  }
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return Array.from({ length: 5 }, (_, index) => {
    const current = new Date(day);
    current.setUTCDate(day.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}

export function attendanceDayLabel(day: {
  clockIn?: string | null;
  status?: string | null;
  onLeave?: number;
}): string {
  if (day.clockIn) {
    // Also support older records stored as a time without a date.
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(day.clockIn)) return day.clockIn.slice(0, 5);
    const time = new Date(day.clockIn);
    if (!Number.isNaN(time.getTime())) {
      return time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }
  }
  if (day.status === "CONGÉ" || day.onLeave) return "Congé";
  if (day.status === "ABSENT") return "Absent";
  if (day.status === "PONCTUEL" || day.status === "RETARD") return "Présent";
  return "—";
}
