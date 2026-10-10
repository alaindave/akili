import { InventoryBase } from "./InventoryBase.js";

export interface InventoryItem {
  _id: string;
  companyId: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  itemType: InventoryItemType;
  baseUnitId: string;
  trackingMethod: InventoryTrackingMethod;
  costingMethod?: InventoryCostingMethod;
  isActive: boolean;
  reorderPoint?: number;
  reorderQuantity?: number;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  serverVersion: number;
  synced: boolean;
  isDeleted: boolean;
}

export type InventoryItemType =
  | "RAW_MATERIAL"
  | "COMPONENT"
  | "CONSUMABLE"
  | "SEMI_FINISHED"
  | "FINISHED_GOOD";

export type InventoryTrackingMethod = "NONE" | "LOT" | "SERIAL";

export type InventoryCostingMethod = "AVERAGE" | "FIFO" | "STANDARD";

export interface InventoryBalance extends InventoryBase {
  itemId: string;
  warehouseId: string;
  locationId?: string;
  lotId?: string;
  serialNumber?: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  averageCost?: number;
  totalValue?: number;
}
