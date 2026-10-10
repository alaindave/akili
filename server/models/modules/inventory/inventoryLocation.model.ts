import mongoose, { Schema, Model } from "mongoose";

export interface InventoryLocationDocument {
  _id: string;
  companyId: string;
  warehouseId: string;
  parentId?: string | null;
  code: string;
  name: string;
  locationType: string;
  isActive: number;
  customFields?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: number;
  isDeleted: number;
}

const schema = new Schema<InventoryLocationDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true },
    warehouseId: { type: String, required: true },
    parentId: { type: String },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    locationType: { type: String, required: true, trim: true },
    isActive: { type: Number, required: true, default: 1, enum: [0, 1] },
    customFields: { type: Schema.Types.Mixed },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverVersion: { type: Number, required: true, default: 0, min: 0 },
    isDeleted: { type: Number, required: true, default: 0, enum: [0, 1] },
  },
  { versionKey: false }
);

schema.index({ companyId: 1, warehouseId: 1, code: 1 }, { unique: true });
schema.index({ companyId: 1 });
schema.index({ companyId: 1, warehouseId: 1 });
schema.index({ companyId: 1, warehouseId: 1, isActive: 1 });
schema.index({ companyId: 1, warehouseId: 1, parentId: 1 });
schema.index({ companyId: 1, warehouseId: 1, locationType: 1 });
schema.index({ companyId: 1, warehouseId: 1, isDeleted: 1 });
schema.index({ companyId: 1, serverVersion: 1 });

const InventoryLocation: Model<InventoryLocationDocument> =
  mongoose.models.InventoryLocation ||
  mongoose.model<InventoryLocationDocument>("InventoryLocation", schema, "inventory_locations");

export default InventoryLocation;

