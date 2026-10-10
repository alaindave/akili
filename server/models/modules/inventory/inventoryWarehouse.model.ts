import mongoose, { Schema, Model } from "mongoose";

export interface InventoryWarehouseDocument {
  _id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string | null;
  address?: string | null;
  type?: string | null;
  isActive: number;
  customFields?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: number;
  isDeleted: number;
}

const schema = new Schema<InventoryWarehouseDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    address: { type: String },
    type: { type: String },
    isActive: { type: Number, required: true, default: 1, enum: [0, 1] },
    customFields: { type: Schema.Types.Mixed },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverVersion: { type: Number, required: true, default: 0, min: 0 },
    isDeleted: { type: Number, required: true, default: 0, enum: [0, 1] },
  },
  { versionKey: false }
);

schema.index({ companyId: 1, code: 1 }, { unique: true });
schema.index({ companyId: 1 });
schema.index({ companyId: 1, isActive: 1 });
schema.index({ companyId: 1, isDeleted: 1 });
schema.index({ companyId: 1, serverVersion: 1 });

const InventoryWarehouse: Model<InventoryWarehouseDocument> =
  mongoose.models.InventoryWarehouse ||
  mongoose.model<InventoryWarehouseDocument>("InventoryWarehouse", schema, "inventory_warehouses");

export default InventoryWarehouse;

