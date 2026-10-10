import mongoose, { Schema, Model } from "mongoose";

export interface InventorySkuSettingsDocument {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: number;
  isDeleted: number;
  companyId: string;
  enabled: number;
  prefix: string;
  digits: number;
  nextNumber: number;
}

const schema = new Schema<InventorySkuSettingsDocument>(
  {
    _id: { type: String, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverVersion: { type: Number, required: true, default: 0 },
    isDeleted: { type: Number, required: true, default: 0, enum: [0, 1] },
    companyId: { type: String, required: true, unique: true },
    enabled: { type: Number, required: true, default: 0, enum: [0, 1] },
    prefix: { type: String, default: "ART-" },
    digits: {
      type: Number, required: true, default: 5, min: 1, max: 12,
      validate: { validator: Number.isInteger, message: "digits must be an integer" },
    },
    nextNumber: {
      type: Number, required: true, default: 1, min: 1, max: 999999999999,
      validate: { validator: Number.isInteger, message: "nextNumber must be an integer" },
    },
  },
  { versionKey: false }
);

schema.index({ companyId: 1, serverVersion: 1 });

const InventorySkuSettings: Model<InventorySkuSettingsDocument> =
  mongoose.models.InventorySkuSettings ||
  mongoose.model<InventorySkuSettingsDocument>(
    "InventorySkuSettings", schema, "inventory_sku_settings"
  );

export default InventorySkuSettings;
