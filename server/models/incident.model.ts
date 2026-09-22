import { Schema, model } from "mongoose";

export interface Incident {
  _id: string;
  companyId: string;
  incidentNumber: string;
  reporterName: string;
  reporterContact: string;
  occurredAt: Date;
  location: string;
  notes: string;
  preventiveActions: string;
  remedialActions: string;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: number;
  isDeleted: number;
}

const incidentSchema = new Schema<Incident>(
  {
    _id: {
      type: String,
      required: true,
      match: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    },
    companyId: { type: String, required: true, trim: true, maxlength: 200 },
    incidentNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    reporterName: { type: String, required: true, trim: true, maxlength: 200 },
    reporterContact: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    occurredAt: { type: Date, required: true },
    location: { type: String, required: true, trim: true, maxlength: 300 },
    notes: { type: String, required: true, trim: true, maxlength: 10000 },
    preventiveActions: {
      type: String,
      trim: true,
      default: "",
      maxlength: 10000,
    },
    remedialActions: {
      type: String,
      trim: true,
      default: "",
      maxlength: 10000,
    },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverVersion: { type: Number, required: true, default: 0, min: 0 },
    isDeleted: { type: Number, required: true, default: 0, enum: [0, 1] },
  },
  { versionKey: false }
);

incidentSchema.index({ companyId: 1, serverVersion: 1 });
incidentSchema.index({ companyId: 1, occurredAt: -1 });
incidentSchema.index({ companyId: 1, incidentNumber: 1 });

export default model<Incident>("Incidents", incidentSchema);
