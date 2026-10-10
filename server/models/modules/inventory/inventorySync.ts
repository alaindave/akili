import InventoryCategory from "./inventoryCategory.model.js";
import InventoryUnit from "./inventoryUnit.model.js";
import InventoryItem from "./inventoryItem.model.js";
import InventoryWarehouse from "./inventoryWarehouse.model.js";
import InventoryLocation from "./inventoryLocation.model.js";
import InventoryDocument from "./inventoryDocument.model.js";
import InventoryDocumentLine from "./inventoryDocumentLine.model.js";
import InventoryMovement from "./inventoryMovement.model.js";
import InventoryBalance from "./inventoryBalance.model.js";
import InventorySkuSettings from "./inventorySkuSettings.model.js";

export const inventorySyncModels = {
  inventory_category: InventoryCategory,
  inventory_unit: InventoryUnit,
  inventory_item: InventoryItem,
  inventory_warehouse: InventoryWarehouse,
  inventory_location: InventoryLocation,
  inventory_document: InventoryDocument,
  inventory_document_line: InventoryDocumentLine,
  inventory_movement: InventoryMovement,
  inventory_balance: InventoryBalance,
  inventory_sku_settings: InventorySkuSettings,
} as const;

export type InventorySyncEntity = keyof typeof inventorySyncModels;

export function isInventorySyncEntity(entity: string): entity is InventorySyncEntity {
  return Object.prototype.hasOwnProperty.call(inventorySyncModels, entity);
}

