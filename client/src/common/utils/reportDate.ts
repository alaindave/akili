/** Calendar dates keep their day; timestamps use the application's local time. */
export function formatReportDate(value?: string | Date | null): string {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.split("-").reverse().join("-");
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getFullYear()).padStart(4, "0")}`;
}

export function reportMonthPeriod(month: number, year: number): string {
  return `${formatReportDate(new Date(year, month - 1, 1))} au ${formatReportDate(new Date(year, month, 0))}`;
}
