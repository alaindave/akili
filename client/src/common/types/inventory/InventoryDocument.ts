import { InventoryBase } from "./InventoryBase.js";

export const INVENTORY_REFERENCE_TYPES = [
  "PURCHASE_ORDER", "SUPPLIER_DELIVERY", "SALES_ORDER", "SALES_RETURN",
  "PRODUCTION_ORDER", "STOCK_COUNT", "INVENTORY_ADJUSTMENT",
  "STOCK_TRANSFER_REQUEST", "OPENING_STOCK", "MANUAL",
] as const;

export type InventoryReferenceType = typeof INVENTORY_REFERENCE_TYPES[number];

export type InventoryDocumentType =
  | "RECEIPT"
  | "ISSUE"
  | "TRANSFER"
  | "ADJUSTMENT"
  | "RETURN"
  | "COUNT";

export type InventoryDocumentStatus = "DRAFT" | "POSTED" | "CANCELLED";

export interface InventoryDocument extends InventoryBase {
  documentNumber: string;
  type: InventoryDocumentType;
  status: InventoryDocumentStatus;
  warehouseId?: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  referenceType?: InventoryReferenceType;
  referenceId?: string;
  reason?: string;
  documentDate: string;
  postedAt?: string;
  postedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface InventoryDocumentLine extends InventoryBase {
  documentId: string;
  lineNumber: number;
  itemId: string;
  quantity: number;
  unitId: string;
  unitCost?: number;
  warehouseId?: string;
  locationId?: string;
  lotId?: string;
  serialNumber?: string;
  description?: string;
  customFields?: Record<string, unknown>;
}

export interface InventoryDocumentTypeConfig extends InventoryBase {
  code: string;
  name: string;
  stockEffect: "IN" | "OUT" | "TRANSFER" | "NONE";
  requiresApproval: boolean;
  requiresReason: boolean;
  requiresWarehouse: boolean;
  requiresLocation: boolean;
  numberPrefix: string;
  isActive: boolean;
}
