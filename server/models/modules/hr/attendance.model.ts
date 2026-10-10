import { Schema, model } from "mongoose";

export interface AttendanceDocument {
  companyId: string;
  _id: string;
  employeeId: string;
  date: string;
  source: "MANUAL" | "AUTO_CLIENT" | "AUTO_SERVER";
  clockIn?: Date;
  clockOut?: Date;
  status: "PONCTUEL" | "RETARD" | "ABSENT" | "CONGÉ";
  lateMinutes?: number;
  notes?: string;
  serverVersion: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number;
}

const attendanceSchema = new Schema<AttendanceDocument>(
  {
    companyId: {
      type: String,
      required: true,
      trim: true,
    },
    _id: {
      type: String,
      required: true,
    },

    employeeId: {
      type: String,
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    source: {
      type: String,
      default: "MANUAL",
      enum: ["MANUAL", "AUTO_CLIENT", "AUTO_SERVER"],
      required: true,
    },

    clockIn: {
      type: Date,
    },

    clockOut: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["PONCTUEL", "RETARD", "ABSENT", "CONGÉ"],
      required: true,
    },

    lateMinutes: {
      type: Number,
    },

    notes: {
      type: String,
    },

    serverVersion: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },

    createdAt: {
      type: Date,
      required: true,
    },

    updatedAt: {
      type: Date,
      required: true,
    },
    isDeleted: {
      type: Number,
      required: true,
      default: 0,
      enum: [0, 1],
    },
  },
  {
    versionKey: false,
  }
);

attendanceSchema.index(
  {
    companyId: 1,
    employeeId: 1,
    date: 1,
  },
  {
    unique: true,
    partialFilterExpression: { isDeleted: 0 },
  }
);

const Attendance = model<AttendanceDocument>("Attendances", attendanceSchema);

export default Attendance;
