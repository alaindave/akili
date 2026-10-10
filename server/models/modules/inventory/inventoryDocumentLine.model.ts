import mongoose, { Schema, Model } from "mongoose";

export interface InventoryDocumentLineDocument {
  _id: string;
  companyId: string;
  documentId: string;
  lineNumber: number;
  itemId: string;
  quantity: number;
  unitId: string;
  unitCost?: number | null;
  warehouseId?: string | null;
  locationId?: string | null;
  lotId?: string | null;
  serialNumber?: string | null;
  description?: string | null;
  customFields?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: number;
  isDeleted: number;
}

const schema = new Schema<InventoryDocumentLineDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true },
    documentId: { type: String, required: true },
    lineNumber: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "lineNumber must be an integer" } },
    itemId: { type: String, required: true },
    quantity: { type: Number, required: true, validate: { validator: (value: number | null) => value == null || value > 0, message: "quantity must be greater than zero" } },
    unitId: { type: String, required: true },
    unitCost: { type: Number, min: 0 },
    warehouseId: { type: String },
    locationId: { type: String },
    lotId: { type: String },
    serialNumber: { type: String },
    description: { type: String },
    customFields: { type: Schema.Types.Mixed },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverVersion: { type: Number, required: true, default: 0, min: 0 },
    isDeleted: { type: Number, required: true, default: 0, enum: [0, 1] },
  },
  { versionKey: false }
);

schema.index({ companyId: 1, documentId: 1, lineNumber: 1 }, { unique: true });
schema.index({ companyId: 1 });
schema.index({ companyId: 1, documentId: 1 });
schema.index({ companyId: 1, itemId: 1 });
schema.index({ companyId: 1, itemId: 1, documentId: 1 });
schema.index({ companyId: 1, warehouseId: 1, itemId: 1 });
schema.index({ companyId: 1, warehouseId: 1, locationId: 1, itemId: 1 });
schema.index({ companyId: 1, itemId: 1, lotId: 1 });
schema.index({ companyId: 1, itemId: 1, serialNumber: 1 });
schema.index({ companyId: 1, serverVersion: 1 });

const InventoryDocumentLine: Model<InventoryDocumentLineDocument> =
  mongoose.models.InventoryDocumentLine ||
  mongoose.model<InventoryDocumentLineDocument>("InventoryDocumentLine", schema, "inventory_document_lines");

export default InventoryDocumentLine;

