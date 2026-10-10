import mongoose, { Schema, Model } from "mongoose";

export interface PayrollItemDocument {
  companyId: string;
  _id: string;
  payrollResultId: string;
  employeeId: string;
  componentId: string;
  name: string;
  displayName?: string;
  type: "EARNING" | "DEDUCTION";
  amount: number;
  taxable?: number;
  serverVersion: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number;
}

const payrollItemSchema = new Schema<PayrollItemDocument>(
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

    payrollResultId: {
      type: String,
      required: true,
      ref: "PayrollResult",
      index: true,
    },

    employeeId: {
      type: String,
      required: true,
      index: true,
    },

    componentId: {
      type: String,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    displayName: {
      type: String,
      trim: true,
    },

    type: {
      type: String,
      enum: ["EARNING", "DEDUCTION"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    taxable: {
      type: Number,
      default: 0,
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

payrollItemSchema.index({
  payrollResultId: 1,
  componentId: 1,
});

const PayrollItem: Model<PayrollItemDocument> =
  mongoose.models.PayrollItem ||
  mongoose.model<PayrollItemDocument>(
    "PayrollItem",
    payrollItemSchema,
    "payroll_items"
  );

export default PayrollItem;
