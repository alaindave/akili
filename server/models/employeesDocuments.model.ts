import { Schema, model } from "mongoose";

export interface EmployeeDocumentRecord {
  companyId: string;
  _id: string;
  employeeId: string;
  uploadedBy: string | null;
  documentType: "EMPLOYMENT_CONTRACT" | "NATIONAL_ID";
  originalName: string;
  fileName: string;
  storagePath: string | null;
  mimeType: string;
  fileSize: number;
  hash: string;
  serverVersion: number;
  isDeleted: number;
  createdAt: Date;
  updatedAt: Date;
}

const employeeDocumentSchema = new Schema<EmployeeDocumentRecord>({
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
    ref: "Employees",
    required: true,
    index: true,
  },

  uploadedBy: {
    type: String,
    ref: "AdminUsers",
    default: null,
  },

  documentType: {
    type: String,
    enum: ["EMPLOYMENT_CONTRACT", "NATIONAL_ID"],
    required: true,
  },

  originalName: {
    type: String,
    required: true,
    trim: true,
  },

  fileName: {
    type: String,
    required: true,
    trim: true,
  },

  storagePath: {
    type: String,
    default: null,
  },

  mimeType: {
    type: String,
    required: true,
  },

  fileSize: {
    type: Number,
    required: true,
  },

  hash: {
    type: String,
    required: true,
  },

  serverVersion: {
    type: Number,
    default: 0,
    required: true,
  },

  isDeleted: {
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
});

// Indexes
employeeDocumentSchema.index({ employeeId: 1 });
employeeDocumentSchema.index({ documentType: 1 });
employeeDocumentSchema.index({ needsUpload: 1 });
employeeDocumentSchema.index({ serverVersion: 1 });

const EmployeesDocuments = model<EmployeeDocumentRecord>(
  "EmployeesDocuments",
  employeeDocumentSchema
);

export default EmployeesDocuments;
