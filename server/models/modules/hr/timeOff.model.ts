import { Schema, model } from "mongoose";
import { PayrollTreatment, TimeOffCategory, TimeOffStatus, type TimeOffRecord, type TimeOffMotifSnapshot } from "../../../types/timeOff.js";
const snapshot = new Schema<TimeOffMotifSnapshot>({
  code: { type: String, required: true }, label: { type: String, required: true },
  category: { type: String, required: true, enum: Object.values(TimeOffCategory) },
  payrollTreatment: { type: String, required: true, enum: Object.values(PayrollTreatment) },
  deductFromLeaveBalance: { type: Boolean, required: true },
}, { _id: false, strict: "throw" });
const schema = new Schema<TimeOffRecord>({
  // Mixed preserves migrated ObjectId identifiers; the service generates strings
  // for new records and resolves legacy ObjectIds without rewriting them.
  _id: { type: Schema.Types.Mixed, required: true },
  companyId: { type: String, required: true }, employeeId: { type: String, required: true },
  motifId: { type: String, default: null }, motifSnapshot: snapshot,
  startDate: { type: String, required: true }, endDate: { type: String, required: true },
  isPartialDay: Boolean, startTime: String, endTime: String,
  notes: String, additionalNotes: String,
  submittedAt: { type: Date, required: true },
  submittedMonth: { type: String, required: true },
  status: { type: String, required: true, enum: Object.values(TimeOffStatus) },
  approvedBy: String, approvedAt: Date, rejectionReason: String,
  serverVersion: { type: Number, required: true, min: 0 },
  createdAt: Date, updatedAt: Date, lastSyncedAt: Date,
  synced: { type: Number, enum: [0, 1], default: 1 }, isDeleted: { type: Number, enum: [0, 1], default: 0 },
  migrationVersion: String,
  supportingDocumentIds: { type: [String], default: undefined },
  balanceDaysDeducted: { type: Number, min: 0 },
}, { collection: "time_off", versionKey: false, strict: "throw", autoCreate: false, autoIndex: false });
schema.index({ companyId: 1, serverVersion: 1 }, { name: "time_off_company_version" });
schema.index({ companyId: 1, employeeId: 1, startDate: 1, endDate: 1 }, { name: "time_off_employee_dates" });
schema.index({ companyId: 1, motifId: 1 }, { name: "time_off_company_motif" });
export default model<TimeOffRecord>("TimeOff", schema);
