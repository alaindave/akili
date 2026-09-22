import { randomInt } from "node:crypto";

// Use the local date/time at submission, independently of when the incident occurred.
export function generateIncidentNumber(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${pad(date.getDate())}${pad(date.getMonth() + 1)}${pad(date.getFullYear() % 100)}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `INC-${day}-${time}-${randomInt(1, 1001)}`;
}
