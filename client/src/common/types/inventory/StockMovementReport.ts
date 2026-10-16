import type { InventoryDocument, InventoryDocumentLine } from "./InventoryDocument.js";
import type { InventoryItem } from "./InventoryItem.js";
import type { InventoryWarehouse } from "./InventoryWarehouse.js";
import type { InventoryUnit } from "./InventoryUnit.js";
import type Company from "../shared/Company.js";

export interface StockMovementReportData {
  company: Company;
  document: InventoryDocument;
  lines: InventoryDocumentLine[];
  items: InventoryItem[];
  warehouses: InventoryWarehouse[];
  units: InventoryUnit[];
  responsible: string;
}
