import { Schema, model } from "mongoose";

export interface PayrollEmployeeProfileDocument {
  companyId: string;
  _id: string;
  employeeId: string;
  accountNumber?: string;
  componentId: string;
  name: string;
  displayName: string;
  displayOrder: number;
  type: "EARNING" | "DEDUCTION";
  calculationType:
    | "FIXE"
    | "MANUEL"
    | "POURCENTAGE_BASE"
    | "POURCENTAGE_BRUT"
    | "POURCENTAGE_IMPOSABLE"
    | "FORMULE"
    | "FORMULE_IPR"
    | "FORMULE_ABSENCE"
    | "FORMULE_RETARD";
  calculationBase?:
    | "BASE_SALARY"
    | "GROSS_SALARY"
    | "TAXABLE_SALARY"
    | "TOTAL_EARNINGS"
    | "TOTAL_DEDUCTIONS"
    | "NET_SALARY";
  value: number;
  taxable: number;
  requiresHRApproval: number;
  enabled: number;
  isOverridden: number;
  serverVersion: number;
  createdAt: Date;
  updatedAt: Date;
  synced: number;
  isDeleted: number;
}

const PayrollEmployeeProfileSchema = new Schema<PayrollEmployeeProfileDocument>(
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
      index: true,
    },

    accountNumber: {
      type: String,
      default: "cash",
      set: (value: string | null | undefined) => value?.trim() || "cash",
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
      required: true,
      trim: true,
    },

    displayOrder: {
      type: Number,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["EARNING", "DEDUCTION"],
      required: true,
    },

    calculationType: {
      type: String,
      enum: [
        "FIXE",
        "MANUEL",
        "POURCENTAGE_BASE",
        "POURCENTAGE_BRUT",
        "POURCENTAGE_IMPOSABLE",
        "FORMULE_IPR",
        "FORMULE_ABSENCE",
        "FORMULE_RETARD",
      ],
      required: true,
    },

    calculationBase: {
      type: String,
      enum: [
        "BASE_SALARY",
        "GROSS_SALARY",
        "TAXABLE_SALARY",
        "TOTAL_EARNINGS",
        "TOTAL_DEDUCTIONS",
        "NET_SALARY",
      ],
    },

    value: {
      type: Number,
      default: 0,
    },

    taxable: {
      type: Number,
    },

    requiresHRApproval: {
      type: Number,
      default: 0,
    },

    enabled: {
      type: Number,
      default: 1,
    },

    isOverridden: {
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

    synced: {
      type: Number,
      default: 1,
    },

    isDeleted: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

// One payroll profile per employee/component pair
PayrollEmployeeProfileSchema.index(
  { employeeId: 1, componentId: 1 },
  { unique: true }
);

// Useful for payroll generation
PayrollEmployeeProfileSchema.index({
  employeeId: 1,
  enabled: 1,
});

// Useful during synchronization
PayrollEmployeeProfileSchema.index({
  synced: 1,
  isDeleted: 1,
});

const PayrollEmployeeProfile = model<PayrollEmployeeProfileDocument>(
  "PayrollEmployeeProfiles",
  PayrollEmployeeProfileSchema
);

export default PayrollEmployeeProfile;
