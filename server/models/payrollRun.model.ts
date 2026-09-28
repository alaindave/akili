import mongoose, { Model, Schema } from "mongoose";

export type PayrollStatus =
  | "BROUILLON"
  | "VERIFICATION"
  | "APPROUVÉ"
  | "PAYÉ"
  | "ANNULÉ";

export interface PayrollRunDocument {
  companyId: string;
  _id: string;
  month: number;
  year: number;
  employeeCount: number;
  totalBasicSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  totalNetSalary: number;
  generatedBy: string;
  submittedForVerificationAt?: Date;
  submittedForVerificationBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  paidAt?: Date;
  paidBy?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  deletedBy?: string;
  status: PayrollStatus;
  notes?: string;
  serverVersion: number;
  synced: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number;
}

const payrollRunSchema = new Schema<PayrollRunDocument>(
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

    employeeCount: {
      type: Number,
      required: true,
      min: 0,
    },

    totalBasicSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    totalEarnings: {
      type: Number,
      required: true,
      min: 0,
    },

    totalDeductions: {
      type: Number,
      required: true,
      min: 0,
    },

    totalNetSalary: {
      type: Number,
      required: true,
    },

    generatedBy: {
      type: String,
      required: true,
      ref: "AdminUser",
    },

    submittedForVerificationAt: {
      type: Date,
    },

    submittedForVerificationBy: {
      type: String,
      ref: "AdminUser",
    },

    approvedAt: {
      type: Date,
    },

    approvedBy: {
      type: String,
      ref: "AdminUser",
    },

    paidAt: {
      type: Date,
    },

    paidBy: {
      type: String,
      ref: "AdminUser",
    },

    cancelledAt: {
      type: Date,
    },

    cancelledBy: {
      type: String,
      ref: "AdminUser",
    },

    status: {
      type: String,
      enum: ["BROUILLON", "VERIFICATION", "APPROUVÉ", "PAYÉ", "ANNULÉ"],
      required: true,
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

    synced: {
      type: Number,
      default: 0,
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

    deletedBy: {
      type: String,
      ref: "AdminUser",
    },
  },
  {
    versionKey: false,
  }
);

// Prevent duplicate payroll runs for the same month/year.
payrollRunSchema.index(
  { companyId: 1, month: 1, year: 1 },
  {
    name: "payroll_company_period_active",
    unique: true,
    partialFilterExpression: {
      isDeleted: 0,
      status: { $in: ["BROUILLON", "VERIFICATION", "APPROUVÉ", "PAYÉ"] },
    },
  }
);
const PayrollRun: Model<PayrollRunDocument> =
  mongoose.models.PayrollRun ||
  mongoose.model<PayrollRunDocument>(
    "PayrollRun",
    payrollRunSchema,
    "payroll_runs"
  );

export default PayrollRun;
