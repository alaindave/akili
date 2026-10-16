import { allDirect, getDirect, runDirect, transaction } from "../../../db.js";
import type { InventoryItem, InventoryBalance } from "../../../../../common/types/inventory/InventoryItem.js";
import type { InventoryUnit } from "../../../../../common/types/inventory/InventoryUnit.js";
import type { InventoryWarehouse, InventoryLocation } from "../../../../../common/types/inventory/InventoryWarehouse.js";
import type { InventoryDocument, InventoryDocumentLine } from "../../../../../common/types/inventory/InventoryDocument.js";
import type { InventoryMovement } from "../../../../../common/types/inventory/InventoryMovement.js";
import { queuePostedDocument } from "./inventoryPostingSync.repository.js";

export interface BalanceBucket {
  companyId: string;
  itemId: string;
  warehouseId: string;
  locationId: string;
  lotId: string;
  serialNumber: string;
}

// These operations use direct helpers only while withTransaction owns the DB queue.
export class InventoryTransactionRepository {
  queuePostedDocument(companyId: string, documentId: string) { return queuePostedDocument(companyId, documentId); }
  withTransaction<T>(callback: () => Promise<T>) { return transaction(callback); }

  getDocument(companyId: string, id: string) {
    return getDirect<InventoryDocument>("SELECT * FROM inventory_documents WHERE companyId = ? AND _id = ?", [companyId, id]);
  }

  getDocumentNumbers(companyId: string, prefix: string) {
    return allDirect<Pick<InventoryDocument, "documentNumber">>(
      "SELECT documentNumber FROM inventory_documents WHERE companyId = ? AND documentNumber LIKE ?",
      [companyId, `${prefix}%`]);
  }

  getItem(companyId: string, id: string) {
    return getDirect<InventoryItem>("SELECT * FROM inventory_items WHERE companyId = ? AND _id = ? AND isDeleted = 0 AND isActive = 1", [companyId, id]);
  }

  getStockAlertRecipient(companyId: string) {
    return getDirect<{ email: string | null }>(
      "SELECT email FROM companies WHERE companyId = ? AND isDeleted = 0",
      [companyId]);
  }

  async getAvailableQuantity(companyId: string, itemId: string): Promise<number> {
    const row = await getDirect<{ quantity: number }>(
      `SELECT COALESCE(SUM(quantityAvailable), 0) AS quantity FROM inventory_balances
       WHERE companyId = ? AND itemId = ? AND isDeleted = 0`,
      [companyId, itemId]);
    return row?.quantity ?? 0;
  }

  getUnit(companyId: string, id: string) {
    return getDirect<InventoryUnit>("SELECT * FROM inventory_units WHERE companyId = ? AND _id = ? AND isDeleted = 0", [companyId, id]);
  }

  getWarehouse(companyId: string, id: string) {
    return getDirect<InventoryWarehouse>("SELECT * FROM inventory_warehouses WHERE companyId = ? AND _id = ? AND isDeleted = 0 AND isActive = 1", [companyId, id]);
  }

  getLocation(companyId: string, warehouseId: string, id: string) {
    return getDirect<InventoryLocation>("SELECT * FROM inventory_locations WHERE companyId = ? AND warehouseId = ? AND _id = ? AND isDeleted = 0 AND isActive = 1", [companyId, warehouseId, id]);
  }

  getBalances(bucket: BalanceBucket) {
    return allDirect<InventoryBalance>(`SELECT * FROM inventory_balances WHERE companyId = ? AND itemId = ? AND warehouseId = ?
      AND COALESCE(locationId, '') = ? AND COALESCE(lotId, '') = ? AND COALESCE(serialNumber, '') = ?`,
    [bucket.companyId, bucket.itemId, bucket.warehouseId, bucket.locationId, bucket.lotId, bucket.serialNumber]);
  }

  hasSerial(companyId: string, itemId: string, serial: string) {
    return getDirect<{ _id: string }>(`SELECT _id FROM inventory_balances WHERE companyId = ? AND itemId = ?
      AND serialNumber = ? AND quantityOnHand > 0 AND isDeleted = 0 LIMIT 1`, [companyId, itemId, serial]);
  }

  private async insert(table: "inventory_documents" | "inventory_document_lines" | "inventory_movements" | "inventory_balances",
    record: InventoryDocument | InventoryDocumentLine | InventoryMovement | InventoryBalance) {
    const entries = Object.entries(record).filter(([, value]) => value !== undefined);
    await runDirect(`INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
      entries.map(([, value]) => typeof value === "boolean" ? Number(value) : typeof value === "object" && value !== null ? JSON.stringify(value) : value));
  }

  createDocument(document: InventoryDocument) { return this.insert("inventory_documents", document); }
  createLine(line: InventoryDocumentLine) { return this.insert("inventory_document_lines", line); }
  createMovement(movement: InventoryMovement) { return this.insert("inventory_movements", movement); }

  async saveBalance(balance: InventoryBalance, exists: boolean) {
    if (!exists) return this.insert("inventory_balances", balance);
    await runDirect(`UPDATE inventory_balances SET quantityOnHand = ?, quantityReserved = ?, quantityAvailable = ?,
      averageCost = ?, totalValue = ?, updatedAt = ?, synced = 0, isDeleted = 0 WHERE companyId = ? AND _id = ?`,
    [balance.quantityOnHand, balance.quantityReserved, balance.quantityAvailable, balance.averageCost ?? null,
      balance.totalValue ?? null, balance.updatedAt, balance.companyId, balance._id]);
  }
}
