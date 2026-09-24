import { Schema, model } from "mongoose";

export interface EmployeeDocument {
  companyId: string;
  _id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  idNum: string;
  dateBirth: Date;
  dateHired: Date;
  role: string;
  department: "Administation" | "Atelier" | "Usine" | "Magasin" | "Sentinelle";
  salary: number;
  accountNumber?: string;
  remainingLeave: number;
  status: "ACTIF" | "INACTIF";
  telephone: string;
  address: string;
  emergencyContact: string;
  relationship: string;
  contactPhone: string;
  photo_filename: string | null;
  photo_path: string | null;
  photo_version: number;
  photo_hash: string | null;
  photo_mime_type: "image/jpeg" | "image/png" | "image/webp" | null;
  photo_last_modified: Date | null;
  serverVersion: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number;
}

const employeeSchema = new Schema<EmployeeDocument>(
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

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    matricule: {
      type: String,
      required: true,
      trim: true,
    },

    idNum: {
      type: String,
      required: true,
      trim: true,
    },

    dateBirth: {
      type: Date,
      required: true,
    },

    dateHired: {
      type: Date,
      required: true,
    },

    role: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      enum: ["Administration", "Atelier", "Usine", "Magasin", "Sentinelle"],
      required: true,
    },

    salary: {
      type: Number,
      required: true,
      min: 0,
    },

    accountNumber: {
      type: String,
      default: "cash",
      set: (value: string | null | undefined) => value?.trim() || "cash",
    },

    remainingLeave: {
      type: Number,
      required: true,
      default: 20,
      min: 0,
    },

    status: {
      type: String,
      enum: ["ACTIF", "INACTIF"],
      required: true,
      default: "ACTIF",
    },

    telephone: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    emergencyContact: {
      type: String,
      required: true,
      trim: true,
    },

    relationship: {
      type: String,
      required: true,
      trim: true,
    },

    contactPhone: {
      type: String,
      required: true,
      trim: true,
    },

    photo_filename: {
      type: String,
      default: null,
    },

    photo_path: {
      type: String,
      default: null,
    },

    photo_version: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    photo_hash: {
      type: String,
      default: null,
    },

    photo_mime_type: {
      type: String,
      enum: ["image/jpeg", "image/png", "image/webp", null],
      default: null,
    },

    photo_last_modified: {
      type: Date,
      default: null,
    },

    serverVersion: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
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

/*
 * ============================
 * INDEXES
 * ============================
 */

/**
 * Employee matricule must be unique
 * within a company, not globally.
 */
employeeSchema.index({ companyId: 1, matricule: 1 }, { unique: true });

/**
 * National/ID number should also be unique
 * within a company.
 */
employeeSchema.index({ companyId: 1, idNum: 1 }, { unique: true });

/**
 * Useful for listing/searching employees
 * belonging to a company.
 */
employeeSchema.index({
  companyId: 1,
  lastName: 1,
  firstName: 1,
});

/**
 * Useful for filtering active/inactive employees
 * within a company.
 */
employeeSchema.index({
  companyId: 1,
  status: 1,
});

employeeSchema.index({
  companyId: 1,
  serverVersion: 1,
});

employeeSchema.index({
  companyId: 1,
  isDeleted: 1,
});

employeeSchema.index({
  companyId: 1,
  updatedAt: -1,
});

const Employee = model<EmployeeDocument>("Employees", employeeSchema);

export default Employee;
