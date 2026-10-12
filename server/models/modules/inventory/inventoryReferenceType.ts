// Keep aligned with client/src/common/types/inventory/InventoryDocument.ts.
// The server and Electron client have separate TypeScript build roots.
export const INVENTORY_REFERENCE_TYPES = [
  "PURCHASE_ORDER", "SUPPLIER_DELIVERY", "SALES_ORDER", "SALES_RETURN",
  "PRODUCTION_ORDER", "STOCK_COUNT", "INVENTORY_ADJUSTMENT",
  "STOCK_TRANSFER_REQUEST", "OPENING_STOCK", "MANUAL",
] as const;

export type InventoryReferenceType = typeof INVENTORY_REFERENCE_TYPES[number];
