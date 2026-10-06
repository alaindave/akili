import { ipcMain } from "electron";
import {
  InventoryDocumentLineRepository,
  type InventoryDocumentLineListOptions,
} from "../../../database/repositories/modules/inventory/inventoryDocumentLines.repository.js";
import { requireAuthenticatedCompanyId } from "./inventoryItem.ipc.js";

const repository = new InventoryDocumentLineRepository();

function requireId(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function requireLineNumber(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Line number must be a positive integer.");
  }
  return value;
}

// Line mutations must validate the parent document's status in a service.
export function registerInventoryDocumentLinesIpc(): void {
  ipcMain.handle(
    "inventory:documentLine:getById",
    async (_, companyId: string, id: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getById(
        authenticatedCompanyId,
        requireId(id, "Document line ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:documentLine:getByDocument",
    async (_, companyId: string, documentId: string, includeDeleted?: boolean) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByDocument(
        authenticatedCompanyId,
        requireId(documentId, "Document ID"),
        includeDeleted
      );
    }
  );

  ipcMain.handle(
    "inventory:documentLine:getByItem",
    async (_, companyId: string, itemId: string, includeDeleted?: boolean) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByItem(
        authenticatedCompanyId,
        requireId(itemId, "Item ID"),
        includeDeleted
      );
    }
  );

  ipcMain.handle(
    "inventory:documentLine:getByWarehouse",
    async (_, companyId: string, warehouseId: string, includeDeleted?: boolean) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByWarehouse(
        authenticatedCompanyId,
        requireId(warehouseId, "Warehouse ID"),
        includeDeleted
      );
    }
  );

  ipcMain.handle(
    "inventory:documentLine:getByLot",
    async (_, companyId: string, lotId: string, includeDeleted?: boolean) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByLot(
        authenticatedCompanyId,
        requireId(lotId, "Lot ID"),
        includeDeleted
      );
    }
  );

  ipcMain.handle(
    "inventory:documentLine:getBySerialNumber",
    async (_, companyId: string, serialNumber: string, includeDeleted?: boolean) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getBySerialNumber(
        authenticatedCompanyId,
        requireId(serialNumber, "Serial number"),
        includeDeleted
      );
    }
  );

  ipcMain.handle(
    "inventory:documentLine:getTotalQuantityForItem",
    async (_, companyId: string, itemId: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getTotalQuantityForItem(
        authenticatedCompanyId,
        requireId(itemId, "Item ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:documentLine:getNextLineNumber",
    async (_, companyId: string, documentId: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getNextLineNumber(
        authenticatedCompanyId,
        requireId(documentId, "Document ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:documentLine:getNextLineNumberIncludingDeleted",
    async (_, companyId: string, documentId: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getNextLineNumberIncludingDeleted(
        authenticatedCompanyId,
        requireId(documentId, "Document ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:documentLine:getByDocumentAndLineNumber",
    async (
      _,
      companyId: string,
      documentId: string,
      lineNumber: number
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByDocumentAndLineNumber(
        authenticatedCompanyId,
        requireId(documentId, "Document ID"),
        requireLineNumber(lineNumber)
      );
    }
  );

  ipcMain.handle(
    "inventory:documentLine:lineNumberExists",
    async (
      _,
      companyId: string,
      documentId: string,
      lineNumber: number,
      excludeId?: string
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.lineNumberExists(
        authenticatedCompanyId,
        requireId(documentId, "Document ID"),
        requireLineNumber(lineNumber),
        excludeId === undefined ? undefined : requireId(excludeId, "Document line ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:documentLine:list",
    async (_, companyId: string, options: InventoryDocumentLineListOptions = {}) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      const { limit = 100, offset = 0 } = options;
      if (!Number.isSafeInteger(limit) || limit < 1) {
        throw new Error("Limit must be a positive integer.");
      }
      if (!Number.isSafeInteger(offset) || offset < 0) {
        throw new Error("Offset must be a non-negative integer.");
      }
      return repository.list(authenticatedCompanyId, {
        ...options,
        limit: Math.min(limit, 500),
        offset,
      });
    }
  );

  ipcMain.handle(
    "inventory:documentLine:count",
    async (
      _,
      companyId: string,
      options?: Omit<InventoryDocumentLineListOptions, "limit" | "offset">
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.count(authenticatedCompanyId, options);
    }
  );
}
