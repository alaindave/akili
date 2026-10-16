export type InventoryTransactionType = "RECEIPT" | "ISSUE" | "TRANSFER" | "ADJUSTMENT";

export interface InventoryTransactionInput {
  customFields?: Record<string, string>;
  requestId: string;
  type: InventoryTransactionType;
  date: string;
  reference: string;
  reason: string;
  warehouseId: string;
  locationId?: string;
  destinationWarehouseId?: string;
  destinationLocationId?: string;
  adjustmentDirection?: "IN" | "OUT";
  lines: {
    customFields?: Record<string, string>;
    itemId: string;
    quantity: number;
    unitCost?: number;
    lotId?: string;
    serialNumber?: string;
  }[];
}

export interface InventoryTransactionResult {
  documentId: string;
  documentNumber: string;
}
