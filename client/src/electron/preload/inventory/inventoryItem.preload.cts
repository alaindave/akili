type CreateInventoryUnitInput = import("../../../common/types/inventory/InventoryUnit.js", {
  with: { "resolution-mode": "require" },
}).CreateInventoryUnitInput;
type Repository = import("../../services/modules/inventory/inventoryItem.service.js", {
  with: { "resolution-mode": "require" },
}).InventoryItemService;
type ListInventoryItemsRequest = import("../../database/repositories/modules/inventory/inventoryItem.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryItemListOptions;
type CreateInventoryItemRequest = import("../../services/modules/inventory/inventoryItem.service.js", {
  with: { "resolution-mode": "require" },
}).CreateInventoryItemInput;
type UpdateInventoryItemRequest = import("../../services/modules/inventory/inventoryItem.service.js", {
  with: { "resolution-mode": "require" },
}).UpdateInventoryItemInput;

import { invoke } from "../../ipc/ipc.cjs";

export const inventoryItemApi = {
  getCatalogOptions: (companyId: string): ReturnType<Repository["getCatalogOptions"]> =>
    invoke("inventory:item:getCatalogOptions", companyId),
  createUnit: (companyId: string, input: CreateInventoryUnitInput): ReturnType<Repository["createUnit"]> =>
    invoke("inventory:item:createUnit", companyId, input),
  getById: (
    companyId: string,
    id: string
  ): ReturnType<Repository["getById"]> =>
    invoke("inventory:item:getById", companyId, id),

  getBySku: (
    companyId: string,
    sku: string
  ): ReturnType<Repository["getBySku"]> =>
    invoke("inventory:item:getBySku", companyId, sku),

  skuExists: (
    companyId: string,
    sku: string,
    excludeId?: string
  ): ReturnType<Repository["skuExists"]> =>
    invoke("inventory:item:skuExists", companyId, sku, excludeId),

  list: (
    companyId: string,
    options?: ListInventoryItemsRequest
  ): ReturnType<Repository["list"]> =>
    invoke("inventory:item:list", companyId, options),

  count: (
    companyId: string,
    options?: ListInventoryItemsRequest
  ): ReturnType<Repository["count"]> =>
    invoke("inventory:item:count", companyId, options),

  create: (
    companyId: string,
    data: CreateInventoryItemRequest
  ): ReturnType<Repository["create"]> =>
    invoke("inventory:item:create", companyId, data),

  update: (
    companyId: string,
    data: UpdateInventoryItemRequest
  ): ReturnType<Repository["update"]> =>
    invoke("inventory:item:update", companyId, data),

  delete: (
    companyId: string,
    id: string,
    updatedAt: string
  ): ReturnType<Repository["softDelete"]> =>
    invoke("inventory:item:delete", companyId, id, updatedAt),

  restore: (
    companyId: string,
    id: string,
    updatedAt: string
  ): ReturnType<Repository["restore"]> =>
    invoke("inventory:item:restore", companyId, id, updatedAt),

  activate: (
    companyId: string,
    id: string,
    updatedAt: string
  ): ReturnType<Repository["activate"]> =>
    invoke("inventory:item:activate", companyId, id, updatedAt),

  deactivate: (
    companyId: string,
    id: string,
    updatedAt: string
  ): ReturnType<Repository["deactivate"]> =>
    invoke("inventory:item:deactivate", companyId, id, updatedAt),

  getByCategory: (
    companyId: string,
    categoryId: string,
    includeInactive?: boolean
  ): ReturnType<Repository["getByCategory"]> =>
    invoke("inventory:item:getByCategory", companyId, categoryId, includeInactive),

  getActive: (
    companyId: string
  ): ReturnType<Repository["getActive"]> =>
    invoke("inventory:item:getActive", companyId),

  getReorderItems: (
    companyId: string
  ): ReturnType<Repository["getItemsWithReorderPoint"]> =>
    invoke("inventory:item:getReorderItems", companyId),
};
