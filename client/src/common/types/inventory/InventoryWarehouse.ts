import { InventoryBase } from "./InventoryBase.js";

export interface InventoryWarehouse extends InventoryBase {
  code: string;
  name: string;
  description?: string;
  address?: string;
  isActive: boolean;
  allowNegativeStock: boolean;
  customFields?: Record<string, unknown>;
}

export interface InventoryLocation extends InventoryBase {
  warehouseId: string;
  parentId?: string;
  code: string;
  name: string;
  locationType: "ZONE" | "RACK" | "BIN" | "FLOOR" | "OTHER";
  isActive: boolean;
}
