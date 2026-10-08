import { ipcMain } from "electron";
import {
  InventoryWarehouseRepository,
  type InventoryWarehouseListOptions,
} from "../../../database/repositories/modules/inventory/inventoryWarehouse.repository.js";
import { requireAuthenticatedCompanyId } from "./inventoryItem.ipc.js";

const repository = new InventoryWarehouseRepository();

function requireId(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

export function registerInventoryWarehouseIpc(): void {
  ipcMain.handle("inventory:warehouse:create", async (_, companyId: string, input: Parameters<InventoryWarehouseRepository["create"]>[1]) => {
    return repository.create(await requireAuthenticatedCompanyId(companyId), input);
  });

  ipcMain.handle(
    "inventory:warehouse:getById",
    async (_, companyId: string, id: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getById(
        authenticatedCompanyId,
        requireId(id, "Warehouse ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:warehouse:getByCode",
    async (_, companyId: string, code: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByCode(
        authenticatedCompanyId,
        requireId(code, "Warehouse code")
      );
    }
  );

  ipcMain.handle(
    "inventory:warehouse:codeExists",
    async (_, companyId: string, code: string, excludeId?: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.codeExists(
        authenticatedCompanyId,
        requireId(code, "Warehouse code"),
        excludeId === undefined
          ? undefined
          : requireId(excludeId, "Warehouse ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:warehouse:list",
    async (
      _,
      companyId: string,
      options: InventoryWarehouseListOptions = {}
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
    "inventory:warehouse:count",
    async (
      _,
      companyId: string,
      options?: Omit<InventoryWarehouseListOptions, "limit" | "offset">
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.count(authenticatedCompanyId, options);
    }
  );

  ipcMain.handle(
    "inventory:warehouse:getActive",
    async (_, companyId: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getActive(authenticatedCompanyId);
    }
  );
}
