type Repository = import("../../database/repositories/modules/inventory/inventoryDocumentLines.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryDocumentLineRepository;
type InventoryDocumentLineListOptions = import("../../database/repositories/modules/inventory/inventoryDocumentLines.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryDocumentLineListOptions;

import { invoke } from "../../ipc/ipc.cjs";

export const inventoryDocumentLinesApi = {
  getById: (
    companyId: string,
    id: string
  ): ReturnType<Repository["getById"]> =>
    invoke("inventory:documentLine:getById", companyId, id),

  getByDocument: (
    companyId: string,
    documentId: string,
    includeDeleted?: boolean
  ): ReturnType<Repository["getByDocument"]> =>
    invoke("inventory:documentLine:getByDocument", companyId, documentId, includeDeleted),

  getByItem: (
    companyId: string,
    itemId: string,
    includeDeleted?: boolean
  ): ReturnType<Repository["getByItem"]> =>
    invoke("inventory:documentLine:getByItem", companyId, itemId, includeDeleted),

  getByWarehouse: (
    companyId: string,
    warehouseId: string,
    includeDeleted?: boolean
  ): ReturnType<Repository["getByWarehouse"]> =>
    invoke("inventory:documentLine:getByWarehouse", companyId, warehouseId, includeDeleted),

  getByLot: (
    companyId: string,
    lotId: string,
    includeDeleted?: boolean
  ): ReturnType<Repository["getByLot"]> =>
    invoke("inventory:documentLine:getByLot", companyId, lotId, includeDeleted),

  getBySerialNumber: (
    companyId: string,
    serialNumber: string,
    includeDeleted?: boolean
  ): ReturnType<Repository["getBySerialNumber"]> =>
    invoke("inventory:documentLine:getBySerialNumber", companyId, serialNumber, includeDeleted),

  getTotalQuantityForItem: (
    companyId: string,
    itemId: string
  ): ReturnType<Repository["getTotalQuantityForItem"]> =>
    invoke("inventory:documentLine:getTotalQuantityForItem", companyId, itemId),

  getNextLineNumber: (
    companyId: string,
    documentId: string
  ): ReturnType<Repository["getNextLineNumber"]> =>
    invoke("inventory:documentLine:getNextLineNumber", companyId, documentId),

  getNextLineNumberIncludingDeleted: (
    companyId: string,
    documentId: string
  ): ReturnType<Repository["getNextLineNumberIncludingDeleted"]> =>
    invoke("inventory:documentLine:getNextLineNumberIncludingDeleted", companyId, documentId),

  getByDocumentAndLineNumber: (
    companyId: string,
    documentId: string,
    lineNumber: number
  ): ReturnType<Repository["getByDocumentAndLineNumber"]> =>
    invoke("inventory:documentLine:getByDocumentAndLineNumber", companyId, documentId, lineNumber),

  lineNumberExists: (
    companyId: string,
    documentId: string,
    lineNumber: number,
    excludeId?: string
  ): ReturnType<Repository["lineNumberExists"]> =>
    invoke("inventory:documentLine:lineNumberExists", companyId, documentId, lineNumber, excludeId),

  list: (
    companyId: string,
    options?: InventoryDocumentLineListOptions
  ): ReturnType<Repository["list"]> =>
    invoke("inventory:documentLine:list", companyId, options),

  count: (
    companyId: string,
    options?: Omit<InventoryDocumentLineListOptions, "limit" | "offset">
  ): ReturnType<Repository["count"]> =>
    invoke("inventory:documentLine:count", companyId, options),
};
