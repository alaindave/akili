import { Schema, model } from "mongoose";
import { PayrollItemDocument } from "./payrollItem.model.js";

export interface PayrollResultDocument {
  companyId: string;
  _id: string;
  payrollRunId: string;
  employeeId: string;
  month: number;
  year: number;
  firstName?: string;
  lastName?: string;
  department?: string;
  baseSalary: number;
  grossSalary: number;
  earnings: PayrollItemDocument[];
  deductions: PayrollItemDocument[];
  totalEarnings: number;
  totalDeductions: number;
  status: "BROUILLON" | "VERIFIÉ" | "APPROUVÉ" | "PAYÉ" | "ANNULÉ";
  notes?: string;
  netSalary: number;
  cancelledBy?: string;
  verifiedBy?: string;
  cancelledAt?: Date;
  verifiedAt?: Date;
  approvedBy?: string;
  paidBy?: string;
  approvedAt?: Date;
  paidAt?: Date;
  serverVersion: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number;
}

const PayrollResultSchema = new Schema<PayrollResultDocument>(
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
    payrollRunId: {
      type: String,
      required: true,
    },
    employeeId: {
      type: String,
      ref: "Employees",
      required: true,
      index: true,
    },

    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    year: {
      type: Number,
      required: true,
    },

    baseSalary: {
      type: Number,
      required: true,
      default: 0,
    },

    grossSalary: {
      type: Number,
      required: true,
      default: 0,
    },

    totalEarnings: {
      type: Number,
      required: true,
      default: 0,
    },

    totalDeductions: {
      type: Number,
      required: true,
      default: 0,
    },

    netSalary: {
      type: Number,
      required: true,
      default: 0,
    },

    notes: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["BROUILLON", "VERIFIÉ", "APPROUVÉ", "PAYÉ", "ANNULÉ"],
      default: "BROUILLON",
    },

    cancelledBy: { type: String },
    verifiedBy: { type: String },
    cancelledAt: {
      type: Date,
    },
    verifiedAt: {
      type: Date,
    },
    approvedBy: { type: String },
    paidBy: { type: String },
    approvedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
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
      default: 0,
    },
  },
  {
    versionKey: false,
  }
);

PayrollResultSchema.index({
  companyId: 1,
  payrollRunId: 1,
  employeeId: 1,
});

const PayrollResult = model<PayrollResultDocument>(
  "PayrollResults",
  PayrollResultSchema
);

export default PayrollResult;
