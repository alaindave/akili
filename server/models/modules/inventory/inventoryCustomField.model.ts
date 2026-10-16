import mongoose, { Schema } from "mongoose";

const schema = new Schema({
  _id: { type: String, required: true },
  companyId: { type: String, required: true },
  entity: { type: String, required: true, enum: ["ITEM", "CATEGORY", "WAREHOUSE", "LOCATION", "DOCUMENT", "DOCUMENT_LINE"] },
  key: { type: String, required: true, maxlength: 64, match: /^[a-z][a-z0-9_]*$/,
    validate: (key: string) => !["constructor", "prototype", "__proto__"].includes(key) },
  label: { type: String, required: true, trim: true, maxlength: 100 },
  type: { type: String, default: "TEXT", enum: ["TEXT"] },
  required: { type: Number, default: 0, enum: [0] },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Number, default: 1, enum: [0, 1] },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
  serverVersion: { type: Number, default: 0, min: 0 },
  isDeleted: { type: Number, default: 0, enum: [0, 1] },
}, { versionKey: false });
schema.index({ companyId: 1, entity: 1, key: 1 }, { unique: true });
schema.index({ companyId: 1, serverVersion: 1 });
export default mongoose.models.InventoryCustomField || mongoose.model("InventoryCustomField", schema, "inventory_custom_fields");
