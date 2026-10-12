import { InventoryBase } from "./InventoryBase.js";
import type { InventoryReferenceType } from "./InventoryDocument.js";

export interface InventoryMovement extends InventoryBase {
  movementId: string;
  documentId: string;
  documentLineId: string;
  itemId: string;
  warehouseId: string;
  locationId?: string;
  lotId?: string;
  serialNumber?: string;
  quantity: number;
  unitId: string;
  direction: "IN" | "OUT";
  unitCost?: number;
  totalCost?: number;
  movementType:
    | "RECEIPT"
    | "ISSUE"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "ADJUSTMENT"
    | "RETURN_IN"
    | "RETURN_OUT"
    | "PRODUCTION_CONSUMPTION"
    | "PRODUCTION_OUTPUT";
  occurredAt: string;
  referenceType?: InventoryReferenceType;
  referenceId?: string;
}
