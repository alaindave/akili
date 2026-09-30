import { Schema, model } from "mongoose";

export interface LeaveDocument {
  companyId: string;
  _id: string;
  employeeId: string;
  submittedAt: Date;
  submittedMonth: string;
  startDate: string;
  endDate: string;
  subject: string;
  notes: string;
  additionalNotes?: string;
  status: "ATTENTE_APPROBATION" | "APPROUVÉ" | "REFUSÉ" | "ANNULÉ";
  serverVersion: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number;
}

const leaveSchema = new Schema<LeaveDocument>(
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

    submittedAt: {
      type: Date,
      required: true,
    },

    submittedMonth: {
      type: String,
      required: true,
    },

    startDate: {
      type: String,
      required: true,
    },

    endDate: {
      type: String,
      required: true,
    },

    subject: {
      type: String,
      required: true,
    },

    notes: {
      type: String,
      required: true,
    },

    additionalNotes: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["ATTENTE_APPROBATION", "APPROUVÉ", "REFUSÉ", "ANNULÉ"],
      default: "ATTENTE_APPROBATION",
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

const Leave = model<LeaveDocument>("Leaves", leaveSchema);

export default Leave;
