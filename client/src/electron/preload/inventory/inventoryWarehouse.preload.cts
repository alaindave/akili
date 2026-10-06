type Repository = import("../../database/repositories/modules/inventory/inventoryWarehouse.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryWarehouseRepository;
type InventoryWarehouseListOptions = import("../../database/repositories/modules/inventory/inventoryWarehouse.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryWarehouseListOptions;

import { invoke } from "../../ipc/ipc.cjs";

export const inventoryWarehouseApi = {
  getById: (
    companyId: string,
    id: string
  ): ReturnType<Repository["getById"]> =>
    invoke("inventory:warehouse:getById", companyId, id),

  getByCode: (
    companyId: string,
    code: string
  ): ReturnType<Repository["getByCode"]> =>
    invoke("inventory:warehouse:getByCode", companyId, code),

  codeExists: (
    companyId: string,
    code: string,
    excludeId?: string
  ): ReturnType<Repository["codeExists"]> =>
    invoke("inventory:warehouse:codeExists", companyId, code, excludeId),

  list: (
    companyId: string,
    options?: InventoryWarehouseListOptions
  ): ReturnType<Repository["list"]> =>
    invoke("inventory:warehouse:list", companyId, options),

  count: (
    companyId: string,
    options?: Omit<InventoryWarehouseListOptions, "limit" | "offset">
  ): ReturnType<Repository["count"]> =>
    invoke("inventory:warehouse:count", companyId, options),

  getActive: (
    companyId: string
  ): ReturnType<Repository["getActive"]> =>
    invoke("inventory:warehouse:getActive", companyId),
};
