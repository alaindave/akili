import mongoose, { Document, Schema } from "mongoose";

export type AttendanceDailyCheckStatus =
  | "PREPARING"
  | "OPEN"
  | "VERIFIED"
  | "MANAGER_NOTIFIED"
  | "LOCKED";

export interface AttendanceDailyCheck extends Document {
  companyId: string;
  _id: string;
  date: string;
  status: AttendanceDailyCheckStatus;
  markAbsentCompleted: number;
  markAbsentCompletedAt?: Date | null;
  markLeaveCompleted: number;
  markLeaveCompletedAt?: Date | null;
  totalEmployees: number;
  verifiedEmployees: number;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
  managerId?: string | null;
  managerNotifiedAt?: Date | null;
  managerNotifiedTo?: string | null;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  serverVersion: number;
  createdAt: Date;
  updatedAt: Date;
  synced: number;
  isDeleted: number;
}

const attendanceDailyCheckSchema = new Schema<AttendanceDailyCheck>({
  companyId: {
    type: String,
    required: true,
    trim: true,
  },

  _id: {
    type: String,
    required: true,
  },

  date: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  status: {
    type: String,
    enum: ["PREPARING", "OPEN", "VERIFIED", "MANAGER_NOTIFIED", "LOCKED"],
    default: "PREPARING",
    required: true,
  },

  markAbsentCompleted: {
    type: Number,
    default: 0,
    required: true,
  },

  markAbsentCompletedAt: {
    type: Date,
    default: null,
  },

  markLeaveCompleted: {
    type: Number,
    default: 0,
    required: true,
  },

  markLeaveCompletedAt: {
    type: Date,
    default: null,
  },

  totalEmployees: {
    type: Number,
    default: 0,
    required: true,
  },

  verifiedEmployees: {
    type: Number,
    default: 0,
    required: true,
  },

  verifiedAt: {
    type: Date,
    default: null,
  },

  verifiedBy: {
    type: String,
    default: null,
  },

  managerId: {
    type: String,
    default: null,
  },

  managerNotifiedAt: {
    type: Date,
    default: null,
  },

  managerNotifiedTo: {
    type: String,
    default: null,
  },

  lockedAt: {
    type: Date,
    default: null,
  },

  lockedBy: {
    type: String,
    default: null,
  },

  serverVersion: {
    type: Number,
    required: true,
    default: 0,
    index: true,
  },

  synced: {
    type: Number,
    default: 0,
    required: true,
  },

  isDeleted: {
    type: Number,
    default: 0,
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
  },

  updatedAt: {
    type: Date,
    required: true,
  },
});

attendanceDailyCheckSchema.index(
  { date: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: 0 },
  }
);

const AttendanceDailyCheck = mongoose.model<AttendanceDailyCheck>(
  "AttendanceDailyCheck",
  attendanceDailyCheckSchema
);

export default AttendanceDailyCheck;
