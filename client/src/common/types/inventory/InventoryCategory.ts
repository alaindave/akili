import { InventoryBase } from "./InventoryBase.js";

export interface InventoryCategory extends InventoryBase {
  name: string;
  parentId?: string;
  code?: string;
  isActive: boolean;
  customFields?: Record<string, unknown>;
}
