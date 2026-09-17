import {
  getWeeklyTransportAllowanceData,
  TransportAllowanceEmployeeRow,
} from "../../database/repositories/transportAllowance.repository.js";

import {
  TransportAllowanceDay,
  TransportAllowanceDayStatus,
  TransportAllowanceEmployee,
  TransportAllowanceWeeklyReport,
} from "../../../common/types/TransportAllowance.js";

const NORMAL_RATE = 3300;

const ONE_LATE_RATE = 2500;

const ZERO_RATE = 0;

/**
 * Creates a weekly transport allowance report.
 *
 * Rules:
 *
 * 0 late days:
 *   3,300 FBU for every worked day.
 *
 * 1 late day:
 *   2,500 FBU for every worked day.
 *
 * 2+ late days:
 *   0 FBU for the entire week.
 *
 * Worked days:
 *   PONCTUEL
 *   RETARD
 *
 * Non-worked days:
 *   ABSENT
 *   CONGÉ
 *   missing attendance record
 */
export async function createWeeklyTransportAllowanceReport(
  companyId: string,
  weekStart: string
): Promise<TransportAllowanceWeeklyReport> {
  validateMonday(weekStart);

  const rows = await getWeeklyTransportAllowanceData(companyId, weekStart);

  const employees = rows.map((row) => calculateEmployeeAllowance(row));

  const totalAllowance = employees.reduce(
    (total, employee) => total + employee.weeklyAllowance,
    0
  );

  const weekEnd = addDays(weekStart, 4);

  return {
    companyId,
    weekStart,
    weekEnd,
    employees,
    totalAllowance,
    totalEmployees: employees.length,
    generatedAt: new Date().toISOString(),
  };
}

function calculateEmployeeAllowance(
  row: TransportAllowanceEmployeeRow
): TransportAllowanceEmployee {
  const monday = createDay(row.mondayDate, row.mondayStatus);

  const tuesday = createDay(row.tuesdayDate, row.tuesdayStatus);

  const wednesday = createDay(row.wednesdayDate, row.wednesdayStatus);

  const thursday = createDay(row.thursdayDate, row.thursdayStatus);

  const friday = createDay(row.fridayDate, row.fridayStatus);

  const days = [monday, tuesday, wednesday, thursday, friday];

  const lateDays = days.filter((day) => day.status === "LATE").length;

  const workedDays = days.filter(
    (day) => day.status === "WORKED" || day.status === "LATE"
  ).length;

  let ratePerDay: number;

  if (lateDays >= 2) {
    ratePerDay = ZERO_RATE;
  } else if (lateDays === 1) {
    ratePerDay = ONE_LATE_RATE;
  } else {
    ratePerDay = NORMAL_RATE;
  }

  const weeklyAllowance = workedDays * ratePerDay;

  return {
    companyId: row.companyId ?? "",
    employeeId: row.employeeId,
    firstName: row.firstName,
    lastName: row.lastName,
    matricule: row.matricule,
    department: row.department,
    role: row.role,
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    workedDays,
    lateDays,
    ratePerDay,
    weeklyAllowance,
  };
}

function createDay(
  date: string,
  attendanceStatus: string | null
): TransportAllowanceDay {
  let status: TransportAllowanceDayStatus;

  switch (attendanceStatus) {
    case "PONCTUEL":
      status = "WORKED";
      break;

    case "RETARD":
      status = "LATE";
      break;

    case "ABSENT":
      status = "ABSENT";
      break;

    case "CONGÉ":
      status = "LEAVE";
      break;

    default:
      status = "NO_RECORD";
      break;
  }

  return {
    date,
    status,
    amount: 0,
  };
}

function validateMonday(dateString: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(
      "La date de début de semaine doit être au format YYYY-MM-DD."
    );
  }

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("La date de début de semaine est invalide.");
  }

  if (date.getDay() !== 1) {
    throw new Error("La date de début de semaine doit être un lundi.");
  }
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
