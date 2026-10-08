import type { CreateInventoryUnitInput } from "../../../../common/types/inventory/InventoryUnit.js";
import { ipcMain } from "electron";
import { getToken } from "../../../auth.js";

import type {
  InventoryCostingMethod,
  InventoryItemType,
  InventoryTrackingMethod,
} from "../../../../common/types/inventory/InventoryItem.js";
import { inventoryItemService } from "../../../services/modules/inventory/inventoryItem.service.js";

interface CreateInventoryItemRequest {
  autoGenerateSku?: boolean;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  itemType: InventoryItemType;
  baseUnitId: string;
  trackingMethod: InventoryTrackingMethod;
  costingMethod?: InventoryCostingMethod;
  reorderPoint?: number;
  reorderQuantity?: number;
  customFields?: Record<string, unknown>;
  isActive?: boolean;
}

interface UpdateInventoryItemRequest {
  id: string;
  sku?: string;
  name?: string;
  description?: string;
  categoryId?: string | null;
  itemType?: InventoryItemType;
  baseUnitId?: string;
  trackingMethod?: InventoryTrackingMethod;
  costingMethod?: InventoryCostingMethod | null;
  reorderPoint?: number | null;
  reorderQuantity?: number | null;
  customFields?: Record<string, unknown> | null;
  isActive?: boolean;
}

interface ListInventoryItemsRequest {
  search?: string;
  categoryId?: string;
  itemType?: InventoryItemType;
  baseUnitId?: string;
  trackingMethod?: InventoryTrackingMethod;
  costingMethod?: InventoryCostingMethod;
  isActive?: boolean;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export async function requireAuthenticatedCompanyId(
  companyId: string
): Promise<string> {
  if (typeof companyId !== "string" || !companyId.trim()) {
    throw new Error("Company ID is required.");
  }

  const token = await getToken();
  if (!token) {
    throw new Error("Authentication required.");
  }

  let payload: { companyId?: unknown; exp?: unknown };
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some((part) => !part)) {
      throw new Error("Invalid token.");
    }
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid token payload.");
    }
  } catch {
    throw new Error("Invalid authentication token.");
  }

  if (typeof payload.companyId !== "string" || !payload.companyId.trim()) {
    throw new Error("Authenticated company is missing.");
  }
  if (
    payload.exp !== undefined &&
    (typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now() / 1000)
  ) {
    throw new Error("Authentication expired. Please sign in again.");
  }
  if (payload.companyId !== companyId.trim()) {
    throw new Error("Access denied for this company.");
  }

  return payload.companyId;
}

export function registerInventoryItemIpc(): void {
  ipcMain.handle("inventory:item:getCatalogOptions", async (_, companyId: string) => {
    return inventoryItemService.getCatalogOptions(await requireAuthenticatedCompanyId(companyId));
  });
  ipcMain.handle("inventory:item:createUnit", async (_, companyId: string, input: CreateInventoryUnitInput) => {
    return inventoryItemService.createUnit(await requireAuthenticatedCompanyId(companyId), input);
  });
  ipcMain.handle(
    "inventory:item:getById",
    async (_, companyId: string, id: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.getById(authenticatedCompanyId, id);
    }
  );

  ipcMain.handle(
    "inventory:item:getBySku",
    async (_, companyId: string, sku: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.getBySku(authenticatedCompanyId, sku);
    }
  );

  ipcMain.handle(
    "inventory:item:skuExists",
    async (_, companyId: string, sku: string, excludeId?: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.skuExists(
        authenticatedCompanyId,
        sku,
        excludeId
      );
    }
  );

  ipcMain.handle(
    "inventory:item:list",
    async (_, companyId: string, options?: ListInventoryItemsRequest) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.list(authenticatedCompanyId, options);
    }
  );

  ipcMain.handle(
    "inventory:item:count",
    async (_, companyId: string, options?: ListInventoryItemsRequest) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.count(authenticatedCompanyId, options);
    }
  );

  ipcMain.handle(
    "inventory:item:create",
    async (_, companyId: string, data: CreateInventoryItemRequest) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.create(authenticatedCompanyId, data);
    }
  );

  ipcMain.handle(
    "inventory:item:update",
    async (_, companyId: string, data: UpdateInventoryItemRequest) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.update(authenticatedCompanyId, data);
    }
  );

  ipcMain.handle(
    "inventory:item:delete",
    async (_, companyId: string, id: string, updatedAt: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.softDelete(
        authenticatedCompanyId,
        id,
        updatedAt
      );
    }
  );

  ipcMain.handle(
    "inventory:item:restore",
    async (_, companyId: string, id: string, updatedAt: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.restore(
        authenticatedCompanyId,
        id,
        updatedAt
      );
    }
  );

  ipcMain.handle(
    "inventory:item:activate",
    async (_, companyId: string, id: string, updatedAt: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.activate(
        authenticatedCompanyId,
        id,
        updatedAt
      );
    }
  );

  ipcMain.handle(
    "inventory:item:deactivate",
    async (_, companyId: string, id: string, updatedAt: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.deactivate(
        authenticatedCompanyId,
        id,
        updatedAt
      );
    }
  );

  ipcMain.handle(
    "inventory:item:getByCategory",
    async (
      _,
      companyId: string,
      categoryId: string,
      includeInactive?: boolean
    ) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.getByCategory(
        authenticatedCompanyId,
        categoryId,
        includeInactive
      );
    }
  );

  ipcMain.handle("inventory:item:getActive", async (_, companyId: string) => {
    const authenticatedCompanyId = await requireAuthenticatedCompanyId(
      companyId
    );

    return inventoryItemService.getActive(authenticatedCompanyId);
  });

  ipcMain.handle(
    "inventory:item:getReorderItems",
    async (_, companyId: string) => {
      const authenticatedCompanyId = await requireAuthenticatedCompanyId(
        companyId
      );

      return inventoryItemService.getItemsWithReorderPoint(
        authenticatedCompanyId
      );
    }
  );
}
