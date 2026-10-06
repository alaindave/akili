type Repository = import("../../database/repositories/modules/inventory/inventoryLocation.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryLocationRepository;
type InventoryLocationListOptions = import("../../database/repositories/modules/inventory/inventoryLocation.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryLocationListOptions;

import { invoke } from "../../ipc/ipc.cjs";

export const inventoryLocationApi = {
  getById: (
    companyId: string,
    id: string
  ): ReturnType<Repository["getById"]> =>
    invoke("inventory:location:getById", companyId, id),

  getByCode: (
    companyId: string,
    warehouseId: string,
    code: string
  ): ReturnType<Repository["getByCode"]> =>
    invoke("inventory:location:getByCode", companyId, warehouseId, code),

  codeExists: (
    companyId: string,
    warehouseId: string,
    code: string,
    excludeId?: string
  ): ReturnType<Repository["codeExists"]> =>
    invoke("inventory:location:codeExists", companyId, warehouseId, code, excludeId),

  list: (
    companyId: string,
    options?: InventoryLocationListOptions
  ): ReturnType<Repository["list"]> =>
    invoke("inventory:location:list", companyId, options),

  count: (
    companyId: string,
    options?: Omit<InventoryLocationListOptions, "limit" | "offset">
  ): ReturnType<Repository["count"]> =>
    invoke("inventory:location:count", companyId, options),

  getActive: (
    companyId: string,
    warehouseId: string
  ): ReturnType<Repository["getActive"]> =>
    invoke("inventory:location:getActive", companyId, warehouseId),

  getByWarehouse: (
    companyId: string,
    warehouseId: string
  ): ReturnType<Repository["getByWarehouse"]> =>
    invoke("inventory:location:getByWarehouse", companyId, warehouseId),

  getByParent: (
    companyId: string,
    warehouseId: string,
    parentId: string | null
  ): ReturnType<Repository["getByParent"]> =>
    invoke("inventory:location:getByParent", companyId, warehouseId, parentId),
};
