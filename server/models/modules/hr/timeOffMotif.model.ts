import { Schema, model } from "mongoose";
import { PayrollTreatment, TimeOffCategory, type TimeOffMotifRecord } from "../../../types/timeOff.js";

const schema = new Schema<TimeOffMotifRecord & { usageRevision?: number }>({
  _id: { type: String, required: true },
  companyId: { type: String, required: true },
  code: { type: String, required: true, match: /^[A-Z0-9][A-Z0-9_-]{0,63}$/ },
  label: { type: String, required: true, trim: true, maxlength: 200 },
  category: { type: String, enum: Object.values(TimeOffCategory), required: true },
  payrollTreatment: { type: String, enum: Object.values(PayrollTreatment), required: true },
  deductFromLeaveBalance: { type: Boolean, required: true },
  requiresApproval: { type: Boolean, required: true },
  requiresJustification: { type: Boolean, required: true },
  requiresSupportingDocument: { type: Boolean, required: true },
  isSystemDefault: { type: Boolean, default: false, required: true },
  isActive: { type: Boolean, required: true },
  serverVersion: { type: Number, required: true, min: 0 },
  usageRevision: { type: Number, default: 0 },
  createdAt: Date, updatedAt: Date, lastSyncedAt: Date,
  synced: { type: Number, enum: [0, 1], default: 1 },
  isDeleted: { type: Number, enum: [0, 1], default: 0 },
}, { collection: "time_off_motifs", versionKey: false, strict: "throw", autoCreate: false, autoIndex: false });
schema.index({ companyId: 1, code: 1 }, { unique: true, name: "time_off_motif_company_code" });
schema.index({ companyId: 1, serverVersion: 1 }, { name: "time_off_motif_company_version" });
export default model<TimeOffMotifRecord>("TimeOffMotif", schema);
