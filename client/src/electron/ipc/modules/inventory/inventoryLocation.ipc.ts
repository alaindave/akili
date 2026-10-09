import { ipcMain } from "electron";
import {
  InventoryLocationRepository,
  type InventoryLocationListOptions,
} from "../../../database/repositories/modules/inventory/inventoryLocation.repository.js";
import { requireAuthenticatedCompanyId } from "./inventoryItem.ipc.js";

const repository = new InventoryLocationRepository();

function requireId(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

export function registerInventoryLocationIpc(): void {
  ipcMain.handle("inventory:location:update", async (_, companyId: string, id: string, input: Parameters<InventoryLocationRepository["update"]>[2]) => {
    return repository.update(await requireAuthenticatedCompanyId(companyId), requireId(id, "Location ID"), input);
  });
  ipcMain.handle("inventory:location:create", async (_, companyId: string, input: Parameters<InventoryLocationRepository["create"]>[1]) => {
    return repository.create(await requireAuthenticatedCompanyId(companyId), input);
  });
  ipcMain.handle(
    "inventory:location:getById",
    async (_, companyId: string, id: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getById(
        authenticatedCompanyId,
        requireId(id, "Location ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:location:getByCode",
    async (_, companyId: string, warehouseId: string, code: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByCode(
        authenticatedCompanyId,
        requireId(warehouseId, "Warehouse ID"),
        requireId(code, "Location code")
      );
    }
  );

  ipcMain.handle(
    "inventory:location:codeExists",
    async (
      _,
      companyId: string,
      warehouseId: string,
      code: string,
      excludeId?: string
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.codeExists(
        authenticatedCompanyId,
        requireId(warehouseId, "Warehouse ID"),
        requireId(code, "Location code"),
        excludeId === undefined
          ? undefined
          : requireId(excludeId, "Location ID")
      );
    }
  );

  ipcMain.handle(
    "inventory:location:list",
    async (
      _,
      companyId: string,
      options: InventoryLocationListOptions = {}
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
    "inventory:location:count",
    async (
      _,
      companyId: string,
      options?: Omit<InventoryLocationListOptions, "limit" | "offset">
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.count(authenticatedCompanyId, options);
    }
  );

  ipcMain.handle(
    "inventory:location:getActive",
    async (_, companyId: string, warehouseId: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getActive(
        authenticatedCompanyId,
        requireId(warehouseId, "Warehouse ID")
      );
    }
  );
  ipcMain.handle(
    "inventory:location:getByWarehouse",
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
    "inventory:location:getByParent",
    async (
      _,
      companyId: string,
      warehouseId: string,
      parentId: string | null
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );
      return repository.getByParent(
        authenticatedCompanyId,
        requireId(warehouseId, "Warehouse ID"),
        parentId === null ? null : requireId(parentId, "Parent location ID")
      );
    }
  );
}
