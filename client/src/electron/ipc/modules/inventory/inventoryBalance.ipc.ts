import { ipcMain } from "electron";
import {
  InventoryBalanceRepository,
  type InventoryBalanceListOptions,
} from "../../../database/repositories/modules/inventory/inventoryBalance.repository.js";
import { requireAuthenticatedCompanyId } from "./inventoryItem.ipc.js";

const repository = new InventoryBalanceRepository();

function requireId(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

// Balance mutations belong to the stock service so quantities and movements
// remain consistent. These channels expose the balance query API.
export function registerInventoryBalanceIpc(): void {
  ipcMain.handle(
    "inventory:balance:getById",
    async (_, companyId: string, id: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getById(
        authenticatedCompanyId,
        requireId(id, "Balance ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:balance:getBalance",
    async (
      _,
      companyId: string,
      itemId: string,
      warehouseId: string,
      locationId?: string,
      lotId?: string,
      serialNumber?: string
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getBalance(
        authenticatedCompanyId,
        requireId(itemId, "Item ID"),
        requireId(warehouseId, "Warehouse ID"),
        locationId,
        lotId,
        serialNumber
      );
    }
  );

  ipcMain.handle(
    "inventory:balance:list",
    async (_, companyId: string, options?: InventoryBalanceListOptions) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.list(authenticatedCompanyId, options);
    }
  );

  ipcMain.handle(
    "inventory:balance:count",
    async (
      _,
      companyId: string,
      options?: Omit<InventoryBalanceListOptions, "limit" | "offset">
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.count(authenticatedCompanyId, options);
    }
  );

  ipcMain.handle(
    "inventory:balance:getByItem",
    async (_, companyId: string, itemId: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByItem(
        authenticatedCompanyId,
        requireId(itemId, "Item ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:balance:getByWarehouse",
    async (_, companyId: string, warehouseId: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByWarehouse(
        authenticatedCompanyId,
        requireId(warehouseId, "Warehouse ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:balance:getByLocation",
    async (_, companyId: string, warehouseId: string, locationId: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByLocation(
        authenticatedCompanyId,
        requireId(warehouseId, "Warehouse ID"),
        requireId(locationId, "Location ID")
      );
    }
  );
}
