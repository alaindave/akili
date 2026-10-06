import { ipcMain } from "electron";
import {
  InventoryMovementRepository,
  type InventoryMovementListOptions,
} from "../../../database/repositories/modules/inventory/inventoryMovement.repository.js";
import { requireAuthenticatedCompanyId } from "./inventoryItem.ipc.js";

const repository = new InventoryMovementRepository();

function requireId(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function pagination(limit = 100, offset = 0): [number, number] {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("Limit must be a positive integer.");
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Offset must be a non-negative integer.");
  }
  return [Math.min(limit, 500), offset];
}

// Movement writes belong to stock operations that also update balances.
export function registerInventoryMovementIpc(): void {
  ipcMain.handle(
    "inventory:movement:getById",
    async (
      _,
      companyId: string,
      id: string
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getById(
        authenticatedCompanyId,
        requireId(id, "Movement ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:movement:getByMovementId",
    async (
      _,
      companyId: string,
      movementId: string
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByMovementId(
        authenticatedCompanyId,
        requireId(movementId, "Movement ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:movement:getByDocument",
    async (
      _,
      companyId: string,
      documentId: string
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByDocument(
        authenticatedCompanyId,
        requireId(documentId, "Document ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:movement:getByDocumentLine",
    async (
      _,
      companyId: string,
      documentLineId: string
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByDocumentLine(
        authenticatedCompanyId,
        requireId(documentLineId, "Document line ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:movement:getItemHistory",
    async (
      _,
      companyId: string,
      itemId: string,
      limit?: number,
      offset?: number
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getItemHistory(
        authenticatedCompanyId,
        requireId(itemId, "Item ID"),
        ...pagination(limit, offset)
      );
    }
  );

  ipcMain.handle(
    "inventory:movement:getWarehouseHistory",
    async (
      _,
      companyId: string,
      warehouseId: string,
      limit?: number,
      offset?: number
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getWarehouseHistory(
        authenticatedCompanyId,
        requireId(warehouseId, "Warehouse ID"),
        ...pagination(limit, offset)
      );
    }
  );

  ipcMain.handle(
    "inventory:movement:getLotHistory",
    async (
      _,
      companyId: string,
      itemId: string,
      lotId: string,
      limit?: number,
      offset?: number
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getLotHistory(
        authenticatedCompanyId,
        requireId(itemId, "Item ID"),
        requireId(lotId, "Lot ID"),
        ...pagination(limit, offset)
      );
    }
  );

  ipcMain.handle(
    "inventory:movement:getSerialHistory",
    async (
      _,
      companyId: string,
      itemId: string,
      serialNumber: string
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getSerialHistory(
        authenticatedCompanyId,
        requireId(itemId, "Item ID"),
        requireId(serialNumber, "Serial number")
      );
    }
  );

  ipcMain.handle(
    "inventory:movement:list",
    async (_, companyId: string, options: InventoryMovementListOptions = {}) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      const [limit, offset] = pagination(options.limit, options.offset);
      return repository.list(authenticatedCompanyId, { ...options, limit, offset });
    }
  );

  ipcMain.handle(
    "inventory:movement:count",
    async (
      _,
      companyId: string,
      options?: Omit<InventoryMovementListOptions, "limit" | "offset">
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.count(authenticatedCompanyId, options);
    }
  );
}
