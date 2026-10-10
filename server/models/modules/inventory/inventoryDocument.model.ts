import mongoose, { Schema, Model } from "mongoose";

export interface InventoryDocumentDocument {
  _id: string;
  companyId: string;
  documentNumber: string;
  type: string;
  status: string;
  warehouseId?: string | null;
  sourceWarehouseId?: string | null;
  destinationWarehouseId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  documentDate: Date;
  postedAt?: Date | null;
  postedBy?: string | null;
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
  notes?: string | null;
  customFields?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: number;
  isDeleted: number;
}

const schema = new Schema<InventoryDocumentDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true },
    documentNumber: { type: String, required: true },
    type: { type: String, required: true },
    status: { type: String, required: true },
    warehouseId: { type: String },
    sourceWarehouseId: { type: String },
    destinationWarehouseId: { type: String },
    referenceType: { type: String },
    referenceId: { type: String },
    reason: { type: String },
    documentDate: { type: Date, required: true },
    postedAt: { type: Date },
    postedBy: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: { type: String },
    notes: { type: String },
    customFields: { type: Schema.Types.Mixed },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverVersion: { type: Number, required: true, default: 0, min: 0 },
    isDeleted: { type: Number, required: true, default: 0, enum: [0, 1] },
  },
  { versionKey: false }
);

schema.index({ companyId: 1, documentNumber: 1 }, { unique: true });
schema.index({ companyId: 1 });
schema.index({ companyId: 1, type: 1, documentDate: 1 });
schema.index({ companyId: 1, status: 1, documentDate: 1 });
schema.index({ companyId: 1, warehouseId: 1, documentDate: 1 });
schema.index({ companyId: 1, sourceWarehouseId: 1, documentDate: 1 });
schema.index({ companyId: 1, destinationWarehouseId: 1, documentDate: 1 });
schema.index({ companyId: 1, referenceType: 1, referenceId: 1 });
schema.index({ companyId: 1, documentDate: 1 });
schema.index({ companyId: 1, serverVersion: 1 });

const InventoryDocument: Model<InventoryDocumentDocument> =
  mongoose.models.InventoryDocument ||
  mongoose.model<InventoryDocumentDocument>("InventoryDocument", schema, "inventory_documents");

export default InventoryDocument;

