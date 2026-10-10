import mongoose, { Schema, Model } from "mongoose";

export interface InventoryItemDocument {
  companyId: string;
  _id: string;
  sku: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  itemType: string;
  baseUnitId: string;
  trackingMethod: string;
  costingMethod?: string | null;
  reorderPoint?: number | null;
  reorderQuantity?: number | null;
  customFields?: Record<string, unknown> | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: number;
  isDeleted: number;
}

const schema = new Schema<InventoryItemDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    categoryId: { type: String },
    itemType: { type: String, required: true },
    baseUnitId: { type: String, required: true },
    trackingMethod: { type: String, required: true },
    costingMethod: { type: String },
    reorderPoint: { type: Number, min: 0 },
    reorderQuantity: {
      type: Number,
      validate: {
        validator: (value: number | null) => value == null || value > 0,
        message: "reorderQuantity must be greater than zero",
      },
    },
    customFields: { type: Schema.Types.Mixed },
    isActive: { type: Number, required: true, default: 1, enum: [0, 1] },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverVersion: { type: Number, required: true, default: 0, min: 0 },
    isDeleted: { type: Number, required: true, default: 0, enum: [0, 1] },
  },
  { versionKey: false }
);

schema.index({ companyId: 1, sku: 1 }, { unique: true });
schema.index({ companyId: 1 });
schema.index({ companyId: 1, isActive: 1 });
schema.index({ companyId: 1, isDeleted: 1 });
schema.index({ companyId: 1, categoryId: 1 });
schema.index({ companyId: 1, itemType: 1 });
schema.index({ companyId: 1, baseUnitId: 1 });
schema.index({ companyId: 1, trackingMethod: 1 });
schema.index({ companyId: 1, updatedAt: 1 });
schema.index({ companyId: 1, serverVersion: 1 });

const InventoryItem: Model<InventoryItemDocument> =
  mongoose.models.InventoryItem ||
  mongoose.model<InventoryItemDocument>(
    "InventoryItem",
    schema,
    "inventory_items"
  );

export default InventoryItem;
