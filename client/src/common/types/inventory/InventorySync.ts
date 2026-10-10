// Ordered so catalog and parent records are pulled before their dependents.
export const INVENTORY_SYNC_TABLES = {
  inventory_category: "inventory_categories",
  inventory_unit: "inventory_units",
  inventory_item: "inventory_items",
  inventory_warehouse: "inventory_warehouses",
  inventory_location: "inventory_locations",
  inventory_document: "inventory_documents",
  inventory_document_line: "inventory_document_lines",
  inventory_movement: "inventory_movements",
  inventory_balance: "inventory_balances",
  inventory_sku_settings: "inventory_sku_settings",
} as const;

export type InventorySyncEntity = keyof typeof INVENTORY_SYNC_TABLES;

export function isInventorySyncEntity(entity: string): entity is InventorySyncEntity {
  return Object.prototype.hasOwnProperty.call(INVENTORY_SYNC_TABLES, entity);
}
