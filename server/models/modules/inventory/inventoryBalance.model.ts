import mongoose, { Schema, Model } from "mongoose";

export interface InventoryBalanceDocument {
  _id: string;
  companyId: string;
  itemId: string;
  warehouseId: string;
  locationId: string;
  lotId: string;
  serialNumber: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  averageCost?: number | null;
  totalValue?: number | null;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: number;
  isDeleted: number;
}

const schema = new Schema<InventoryBalanceDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true },
    itemId: { type: String, required: true },
    warehouseId: { type: String, required: true },
    locationId: {
      type: String,
      default: "",
      set: (value: string | null | undefined) => value ?? "",
    },
    lotId: {
      type: String,
      default: "",
      set: (value: string | null | undefined) => value ?? "",
    },
    serialNumber: {
      type: String,
      default: "",
      set: (value: string | null | undefined) => value ?? "",
    },
    quantityOnHand: { type: Number, required: true, default: 0, min: 0 },
    quantityReserved: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: function (this: InventoryBalanceDocument, value: number) {
          return value <= this.quantityOnHand;
        },
        message: "Reserved quantity cannot exceed quantity on hand",
      },
    },
    quantityAvailable: { type: Number, required: true, default: 0, min: 0 },
    averageCost: { type: Number, min: 0 },
    totalValue: { type: Number, min: 0 },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverVersion: { type: Number, required: true, default: 0, min: 0 },
    isDeleted: { type: Number, required: true, default: 0, enum: [0, 1] },
  },
  { versionKey: false }
);

schema.index(
  {
    companyId: 1,
    itemId: 1,
    warehouseId: 1,
    locationId: 1,
    lotId: 1,
    serialNumber: 1,
  },
  { unique: true }
);
schema.index({ companyId: 1 });
schema.index({ companyId: 1, itemId: 1 });
schema.index({ companyId: 1, itemId: 1, warehouseId: 1 });
schema.index({ companyId: 1, warehouseId: 1, itemId: 1 });
schema.index({ companyId: 1, warehouseId: 1, locationId: 1, itemId: 1 });
schema.index({ companyId: 1, itemId: 1, lotId: 1 });
schema.index({ companyId: 1, itemId: 1, serialNumber: 1 });
schema.index({ companyId: 1, serverVersion: 1 });

const InventoryBalance: Model<InventoryBalanceDocument> =
  mongoose.models.InventoryBalance ||
  mongoose.model<InventoryBalanceDocument>(
    "InventoryBalance",
    schema,
    "inventory_balances"
  );

export default InventoryBalance;
