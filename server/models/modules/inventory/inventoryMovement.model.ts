import mongoose, { Schema, Model } from "mongoose";

export interface InventoryMovementDocument {
  _id: string;
  companyId: string;
  movementId: string;
  documentId: string;
  documentLineId: string;
  itemId: string;
  warehouseId: string;
  locationId?: string | null;
  lotId?: string | null;
  serialNumber?: string | null;
  quantity: number;
  unitId: string;
  direction: "IN" | "OUT";
  unitCost?: number | null;
  totalCost?: number | null;
  movementType: string;
  occurredAt: Date;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: number;
  isDeleted: number;
}

const schema = new Schema<InventoryMovementDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true },
    movementId: { type: String, required: true },
    documentId: { type: String, required: true },
    documentLineId: { type: String, required: true },
    itemId: { type: String, required: true },
    warehouseId: { type: String, required: true },
    locationId: { type: String },
    lotId: { type: String },
    serialNumber: { type: String },
    quantity: { type: Number, required: true, validate: { validator: (value: number | null) => value == null || value > 0, message: "quantity must be greater than zero" } },
    unitId: { type: String, required: true },
    direction: { type: String, required: true, enum: ["IN", "OUT"] },
    unitCost: { type: Number, min: 0 },
    totalCost: { type: Number, min: 0 },
    movementType: { type: String, required: true },
    occurredAt: { type: Date, required: true },
    referenceType: { type: String },
    referenceId: { type: String },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverVersion: { type: Number, required: true, default: 0, min: 0 },
    isDeleted: { type: Number, required: true, default: 0, enum: [0, 1] },
  },
  { versionKey: false }
);

schema.index({ companyId: 1, movementId: 1 }, { unique: true });
schema.index({ companyId: 1 });
schema.index({ companyId: 1, itemId: 1 });
schema.index({ companyId: 1, itemId: 1, occurredAt: 1 });
schema.index({ companyId: 1, warehouseId: 1, occurredAt: 1 });
schema.index({ companyId: 1, warehouseId: 1, locationId: 1, occurredAt: 1 });
schema.index({ companyId: 1, itemId: 1, lotId: 1, occurredAt: 1 });
schema.index({ companyId: 1, itemId: 1, serialNumber: 1, occurredAt: 1 });
schema.index({ companyId: 1, documentId: 1 });
schema.index({ companyId: 1, documentId: 1, documentLineId: 1 });
schema.index({ companyId: 1, movementType: 1, occurredAt: 1 });
schema.index({ companyId: 1, direction: 1, occurredAt: 1 });
schema.index({ companyId: 1, referenceType: 1, referenceId: 1 });
schema.index({ companyId: 1, serverVersion: 1 });

const InventoryMovement: Model<InventoryMovementDocument> =
  mongoose.models.InventoryMovement ||
  mongoose.model<InventoryMovementDocument>("InventoryMovement", schema, "inventory_movements");

export default InventoryMovement;

