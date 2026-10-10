import mongoose, { Schema, Model } from "mongoose";

export interface InventoryCategoryDocument {
  _id: string;
  companyId: string;
  name: string;
  parentId?: string | null;
  isActive: number;
  customFields?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: number;
  isDeleted: number;
}

const schema = new Schema<InventoryCategoryDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true },
    name: { type: String, required: true },
    parentId: { type: String },
    isActive: { type: Number, required: true, default: 1, enum: [0, 1] },
    customFields: { type: Schema.Types.Mixed },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverVersion: { type: Number, required: true, default: 0, min: 0 },
    isDeleted: { type: Number, required: true, default: 0, enum: [0, 1] },
  },
  { versionKey: false }
);

schema.index(
  { companyId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: "string" } } }
);
schema.index({ companyId: 1 });
schema.index({ companyId: 1, isActive: 1 });
schema.index({ companyId: 1, isDeleted: 1 });
schema.index({ companyId: 1, parentId: 1 });
schema.index({ companyId: 1, serverVersion: 1 });

const InventoryCategory: Model<InventoryCategoryDocument> =
  mongoose.models.InventoryCategory ||
  mongoose.model<InventoryCategoryDocument>(
    "InventoryCategory",
    schema,
    "inventory_categories"
  );

export default InventoryCategory;
