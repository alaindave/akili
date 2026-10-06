type Repository = import("../../database/repositories/modules/inventory/inventoryMovement.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryMovementRepository;
type InventoryMovementListOptions = import("../../database/repositories/modules/inventory/inventoryMovement.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryMovementListOptions;

import { invoke } from "../../ipc/ipc.cjs";

export const inventoryMovementApi = {
  getById: (
    companyId: string,
    id: string
  ): ReturnType<Repository["getById"]> =>
    invoke("inventory:movement:getById", companyId, id),

  getByMovementId: (
    companyId: string,
    movementId: string
  ): ReturnType<Repository["getByMovementId"]> =>
    invoke("inventory:movement:getByMovementId", companyId, movementId),

  getByDocument: (
    companyId: string,
    documentId: string
  ): ReturnType<Repository["getByDocument"]> =>
    invoke("inventory:movement:getByDocument", companyId, documentId),

  getByDocumentLine: (
    companyId: string,
    documentLineId: string
  ): ReturnType<Repository["getByDocumentLine"]> =>
    invoke("inventory:movement:getByDocumentLine", companyId, documentLineId),

  getItemHistory: (
    companyId: string,
    itemId: string,
    limit?: number,
    offset?: number
  ): ReturnType<Repository["getItemHistory"]> =>
    invoke("inventory:movement:getItemHistory", companyId, itemId, limit, offset),

  getWarehouseHistory: (
    companyId: string,
    warehouseId: string,
    limit?: number,
    offset?: number
  ): ReturnType<Repository["getWarehouseHistory"]> =>
    invoke("inventory:movement:getWarehouseHistory", companyId, warehouseId, limit, offset),

  getLotHistory: (
    companyId: string,
    itemId: string,
    lotId: string,
    limit?: number,
    offset?: number
  ): ReturnType<Repository["getLotHistory"]> =>
    invoke("inventory:movement:getLotHistory", companyId, itemId, lotId, limit, offset),

  getSerialHistory: (
    companyId: string,
    itemId: string,
    serialNumber: string
  ): ReturnType<Repository["getSerialHistory"]> =>
    invoke("inventory:movement:getSerialHistory", companyId, itemId, serialNumber),

  list: (
    companyId: string,
    options?: InventoryMovementListOptions
  ): ReturnType<Repository["list"]> =>
    invoke("inventory:movement:list", companyId, options),

  count: (
    companyId: string,
    options?: Omit<InventoryMovementListOptions, "limit" | "offset">
  ): ReturnType<Repository["count"]> =>
    invoke("inventory:movement:count", companyId, options),
};
