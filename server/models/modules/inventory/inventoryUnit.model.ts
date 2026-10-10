import mongoose, { Schema, Model } from "mongoose";

export interface InventoryUnitDocument {
  _id: string;
  companyId: string;
  code: string;
  name: string;
  category: string;
  decimalPlaces: number;
  isBaseUnit: number;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: number;
  isDeleted: number;
}

const schema = new Schema<InventoryUnitDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    decimalPlaces: { type: Number, required: true, default: 0, min: 0, max: 10, validate: { validator: Number.isInteger, message: "decimalPlaces must be an integer" } },
    isBaseUnit: { type: Number, required: true, default: 0, enum: [0, 1] },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverVersion: { type: Number, required: true, default: 0, min: 0 },
    isDeleted: { type: Number, required: true, default: 0, enum: [0, 1] },
  },
  { versionKey: false }
);

schema.index({ companyId: 1, code: 1 }, { unique: true });
schema.index({ companyId: 1 });
schema.index({ companyId: 1, category: 1 });
schema.index({ companyId: 1, isBaseUnit: 1 });
schema.index({ companyId: 1, isDeleted: 1 });
schema.index({ companyId: 1, serverVersion: 1 });

const InventoryUnit: Model<InventoryUnitDocument> =
  mongoose.models.InventoryUnit ||
  mongoose.model<InventoryUnitDocument>("InventoryUnit", schema, "inventory_units");

export default InventoryUnit;

