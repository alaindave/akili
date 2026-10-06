import type { InventoryLocation } from "../../../../../common/types/inventory/InventoryWarehouse.js";
import { all, get } from "../../../db.js";

export interface InventoryLocationListOptions {
  warehouseId?: string;
  parentId?: string | null;
  locationType?: InventoryLocation["locationType"];
  search?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

type LocationRow = Omit<InventoryLocation, "isActive" | "synced" | "isDeleted" | "parentId"> & {
  isActive: number;
  synced: number;
  isDeleted: number;
  parentId: string | null;
};

function mapRow(row: LocationRow): InventoryLocation {
  return {
    _id: row._id,
    companyId: row.companyId,
    warehouseId: row.warehouseId,
    parentId: row.parentId ?? undefined,
    code: row.code,
    name: row.name,
    locationType: row.locationType,
    isActive: row.isActive === 1,
    synced: row.synced === 1,
    isDeleted: row.isDeleted === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    serverVersion: row.serverVersion,
  };
}

function filters(companyId: string, options: InventoryLocationListOptions) {
  const conditions = ["companyId = ?"];
  const params: unknown[] = [companyId];
  if (options.warehouseId !== undefined) {
    conditions.push("warehouseId = ?");
    params.push(options.warehouseId);
  }
  if (options.parentId === null) {
    conditions.push("parentId IS NULL");
  } else if (options.parentId !== undefined) {
    conditions.push("parentId = ?");
    params.push(options.parentId);
  }
  if (options.locationType !== undefined) {
    conditions.push("locationType = ?");
    params.push(options.locationType);
  }
  if (!options.includeDeleted) conditions.push("isDeleted = 0");
  if (options.isActive !== undefined) {
    conditions.push("isActive = ?");
    params.push(options.isActive ? 1 : 0);
  }
  if (options.search?.trim()) {
    conditions.push("(code LIKE ? OR name LIKE ?)");
    const search = `%${options.search.trim()}%`;
    params.push(search, search);
  }
  return { where: conditions.join(" AND "), params };
}

export class InventoryLocationRepository {
  async getById(companyId: string, id: string): Promise<InventoryLocation | null> {
    const row = await get<LocationRow>(
      "SELECT * FROM inventory_locations WHERE companyId = ? AND _id = ? AND isDeleted = 0 LIMIT 1",
      [companyId, id]
    );
    return row ? mapRow(row) : null;
  }

  async getByCode(companyId: string, warehouseId: string, code: string): Promise<InventoryLocation | null> {
    const row = await get<LocationRow>(
      "SELECT * FROM inventory_locations WHERE companyId = ? AND warehouseId = ? AND code = ? AND isDeleted = 0 LIMIT 1",
      [companyId, warehouseId, code]
    );
    return row ? mapRow(row) : null;
  }

  // Deleted locations still reserve their code within a warehouse.
  async codeExists(companyId: string, warehouseId: string, code: string, excludeId?: string): Promise<boolean> {
    const row = await get<{ found: number }>(
      `SELECT 1 AS found FROM inventory_locations
       WHERE companyId = ? AND warehouseId = ? AND code = ? ${excludeId ? "AND _id != ?" : ""} LIMIT 1`,
      excludeId ? [companyId, warehouseId, code, excludeId] : [companyId, warehouseId, code]
    );
    return row != null;
  }

  async list(companyId: string, options: InventoryLocationListOptions = {}): Promise<InventoryLocation[]> {
    const { where, params } = filters(companyId, options);
    const rows = await all<LocationRow>(
      `SELECT * FROM inventory_locations WHERE ${where}
       ORDER BY name COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
      [...params, options.limit ?? 100, options.offset ?? 0]
    );
    return rows.map(mapRow);
  }

  async count(companyId: string, options: Omit<InventoryLocationListOptions, "limit" | "offset"> = {}): Promise<number> {
    const { where, params } = filters(companyId, options);
    const row = await get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM inventory_locations WHERE ${where}`, params
    );
    return row?.count ?? 0;
  }

  async getActive(companyId: string, warehouseId: string): Promise<InventoryLocation[]> {
    const rows = await all<LocationRow>(
      `SELECT * FROM inventory_locations
       WHERE companyId = ? AND warehouseId = ? AND isActive = 1 AND isDeleted = 0
       ORDER BY name COLLATE NOCASE ASC`, [companyId, warehouseId]
    );
    return rows.map(mapRow);
  }
  async getByWarehouse(companyId: string, warehouseId: string): Promise<InventoryLocation[]> {
    const rows = await all<LocationRow>(
      `SELECT * FROM inventory_locations
       WHERE companyId = ? AND warehouseId = ? AND isDeleted = 0
       ORDER BY name COLLATE NOCASE ASC`, [companyId, warehouseId]
    );
    return rows.map(mapRow);
  }

  async getByParent(companyId: string, warehouseId: string, parentId: string | null): Promise<InventoryLocation[]> {
    const rows = await all<LocationRow>(
      `SELECT * FROM inventory_locations
       WHERE companyId = ? AND warehouseId = ? AND parentId IS ? AND isDeleted = 0
       ORDER BY name COLLATE NOCASE ASC`, [companyId, warehouseId, parentId]
    );
    return rows.map(mapRow);
  }

}
