import { ipcMain } from "../../shared/companyIpc.js";
import {
  InventoryDocumentRepository,
  type InventoryDocumentListOptions,
} from "../../../database/repositories/modules/inventory/inventoryDocument.repository.js";
import { requireAuthenticatedCompanyId } from "./inventoryItem.ipc.js";
import {
  getStockMovementDocumentData,
  saveStockMovementReport,
} from "../../../services/modules/inventory/stockMovementReport.service.js";

const repository = new InventoryDocumentRepository();

function requireId(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

// Document posting and cancellation must coordinate movements and balances
// through a service. These channels expose the document query API.
export function registerInventoryDocumentIpc(): void {
  ipcMain.handle(
    "inventory:document:getById",
    async (_, companyId: string, id: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getById(
        authenticatedCompanyId,
        requireId(id, "Document ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:document:getByDocumentNumber",
    async (_, companyId: string, documentNumber: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByDocumentNumber(
        authenticatedCompanyId,
        requireId(documentNumber, "Document number")
      );
    }
  );

  ipcMain.handle(
    "inventory:document:documentNumberExists",
    async (
      _,
      companyId: string,
      documentNumber: string,
      excludeId?: string
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.documentNumberExists(
        authenticatedCompanyId,
        requireId(documentNumber, "Document number"),
        excludeId === undefined
          ? undefined
          : requireId(excludeId, "Document ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:document:list",
    async (
      _,
      companyId: string,
      options: InventoryDocumentListOptions = {}
    ) => {
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
    "inventory:document:count",
    async (
      _,
      companyId: string,
      options?: Omit<InventoryDocumentListOptions, "limit" | "offset">
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.count(authenticatedCompanyId, options);
    }
  );

  // Receipt and issue PDF generation delegates to a service that
  // reads local SQLite data and renders the document with @react-pdf/renderer.
  ipcMain.handle(
    "inventory:document:getStockMovementDocument",
    async (_, companyId: string, id: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return getStockMovementDocumentData(
        authenticatedCompanyId,
        requireId(id, "Document ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:document:saveStockMovementReport",
    async (_, companyId: string, id: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return saveStockMovementReport(
        authenticatedCompanyId,
        requireId(id, "Document ID")
      );
    }
  );
}
