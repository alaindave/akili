import { InventoryBase } from "./InventoryBase.js";

type WarehouseType =
  | "RAW_MATERIAL"
  | "PRODUCTION"
  | "FINISHED_GOODS"
  | "GENERAL"
  | "OTHER";

export interface InventoryWarehouse extends InventoryBase {
  code: string;
  name: string;
  description?: string;
  address?: string;
  type: WarehouseType;
  isActive: boolean;
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

export interface CreateInventoryWarehouseInput {
  code?: string;
  name: string;
  description?: string;
  address?: string;
  type: WarehouseType;
  isActive?: boolean;
  customFields?: Record<string, unknown>;
}

export interface SaveInventoryLocationInput {
  warehouseId: string;
  parentId?: string | null;
  code: string;
  name: string;
  locationType: InventoryLocation["locationType"];
  isActive: boolean;
}
