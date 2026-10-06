type Repository = import("../../database/repositories/modules/inventory/inventoryBalance.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryBalanceRepository;
type InventoryBalanceListOptions = import("../../database/repositories/modules/inventory/inventoryBalance.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryBalanceListOptions;

import { invoke } from "../../ipc/ipc.cjs";

export const inventoryBalanceApi = {
  getById: (
    companyId: string,
    id: string
  ): ReturnType<Repository["getById"]> =>
    invoke("inventory:balance:getById", companyId, id),

  getBalance: (
    companyId: string,
    itemId: string,
    warehouseId: string,
    locationId?: string,
    lotId?: string,
    serialNumber?: string
  ): ReturnType<Repository["getBalance"]> =>
    invoke("inventory:balance:getBalance", companyId, itemId, warehouseId, locationId, lotId, serialNumber),

  list: (
    companyId: string,
    options?: InventoryBalanceListOptions
  ): ReturnType<Repository["list"]> =>
    invoke("inventory:balance:list", companyId, options),

  count: (
    companyId: string,
    options?: Omit<InventoryBalanceListOptions, "limit" | "offset">
  ): ReturnType<Repository["count"]> =>
    invoke("inventory:balance:count", companyId, options),

  getByItem: (
    companyId: string,
    itemId: string
  ): ReturnType<Repository["getByItem"]> =>
    invoke("inventory:balance:getByItem", companyId, itemId),

  getByWarehouse: (
    companyId: string,
    warehouseId: string
  ): ReturnType<Repository["getByWarehouse"]> =>
    invoke("inventory:balance:getByWarehouse", companyId, warehouseId),

  getByLocation: (
    companyId: string,
    warehouseId: string,
    locationId: string
  ): ReturnType<Repository["getByLocation"]> =>
    invoke("inventory:balance:getByLocation", companyId, warehouseId, locationId),
};
