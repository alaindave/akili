import { InventoryBase } from "./InventoryBase.js";

export type InventoryCountStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "POSTED"
  | "CANCELLED";

export interface InventoryCount extends InventoryBase {
  countNumber: string;
  warehouseId: string;
  locationId?: string;
  status: InventoryCountStatus;
  countDate: string;
  startedAt?: string;
  completedAt?: string;
  postedAt?: string;
  postedBy?: string;
  notes?: string;
}

export interface InventoryCountLine extends InventoryBase {
  countId: string;
  itemId: string;
  locationId?: string;
  lotId?: string;
  serialNumber?: string;
  expectedQuantity: number;
  countedQuantity?: number;
  variance?: number;
  unitId: string;
}
