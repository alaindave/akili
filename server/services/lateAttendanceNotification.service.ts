import { Schema, model } from "mongoose";
import Employee from "../models/modules/hr/employee.model.js";
import type { AttendanceDocument } from "../models/modules/hr/attendance.model.js";
import { broadcastLateAttendance } from "./socket.service.js";

// The built-in unique _id index makes concurrent sync retries claim only one alert.
const Delivery = model(
  "LateAttendanceDelivery",
  new Schema(
    {
      _id: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
    { versionKey: false }
  )
);

export async function notifyLateAttendance(
  previous: Pick<AttendanceDocument, "status" | "isDeleted"> | null,
  attendance: AttendanceDocument | null
) {
  if (
    !attendance ||
    attendance.isDeleted ||
    attendance.status !== "RETARD" ||
    (previous?.status === "RETARD" && !previous.isDeleted)
  )
    return;

  try {
    const employee = await Employee.findOne({
      _id: attendance.employeeId,
      companyId: attendance.companyId,
      isDeleted: 0,
    }).lean();
    if (!employee) return;
    const _id = JSON.stringify([
      "attendance.late",
      attendance.companyId,
      attendance.employeeId,
      attendance.date,
    ]);
    await Delivery.create({ _id });
    broadcastLateAttendance({
      _id,
      companyId: attendance.companyId,
      attendanceId: String(attendance._id),
      employeeName: [employee.firstName, employee.lastName]
        .filter(Boolean)
        .join(" "),
      date: attendance.date,
      clockIn: attendance.clockIn?.toISOString(),
      lateMinutes: attendance.lateMinutes ?? 0,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) {
      // Notification failures must not turn a committed attendance into a failed sync.
      console.error("LATE ATTENDANCE NOTIFICATION FAILED:", error);
    }
  }
}
