import { InventoryBase } from "./InventoryBase.js";

export interface InventoryReservation extends InventoryBase {
  itemId: string;
  warehouseId: string;
  locationId?: string;
  lotId?: string;
  quantity: number;
  sourceType: "SALES_ORDER" | "PRODUCTION_ORDER" | "MANUAL";
  sourceId: string;
  status: "ACTIVE" | "RELEASED" | "CONSUMED";
  expiresAt?: string;
}
