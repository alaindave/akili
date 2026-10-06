import type { InventoryWarehouse } from "../../../../../common/types/inventory/InventoryWarehouse.js";
import { all, get } from "../../../db.js";

export interface InventoryWarehouseListOptions {
  search?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

type WarehouseRow = Omit<InventoryWarehouse,
  "isActive" | "allowNegativeStock" | "synced" | "isDeleted" |
  "customFields" | "description" | "address"
> & {
  isActive: number;
  allowNegativeStock: number;
  synced: number;
  isDeleted: number;
  customFields: string | null;
  description: string | null;
  address: string | null;
};

function mapRow(row: WarehouseRow): InventoryWarehouse {
  return {
    ...row,
    description: row.description ?? undefined,
    address: row.address ?? undefined,
    isActive: row.isActive === 1,
    allowNegativeStock: row.allowNegativeStock === 1,
    synced: row.synced === 1,
    isDeleted: row.isDeleted === 1,
    customFields: row.customFields ? JSON.parse(row.customFields) : undefined,
  };
}

function filters(companyId: string, options: InventoryWarehouseListOptions) {
  const conditions = ["companyId = ?"];
  const params: unknown[] = [companyId];
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

export class InventoryWarehouseRepository {
  async getById(companyId: string, id: string): Promise<InventoryWarehouse | null> {
    const row = await get<WarehouseRow>(
      "SELECT * FROM inventory_warehouses WHERE companyId = ? AND _id = ? AND isDeleted = 0 LIMIT 1",
      [companyId, id]
    );
    return row ? mapRow(row) : null;
  }

  async getByCode(companyId: string, code: string): Promise<InventoryWarehouse | null> {
    const row = await get<WarehouseRow>(
      "SELECT * FROM inventory_warehouses WHERE companyId = ? AND code = ? AND isDeleted = 0 LIMIT 1",
      [companyId, code]
    );
    return row ? mapRow(row) : null;
  }

  // Deleted warehouses still reserve their code under UNIQUE(companyId, code).
  async codeExists(companyId: string, code: string, excludeId?: string): Promise<boolean> {
    const row = await get<{ found: number }>(
      `SELECT 1 AS found FROM inventory_warehouses
       WHERE companyId = ? AND code = ? ${excludeId ? "AND _id != ?" : ""} LIMIT 1`,
      excludeId ? [companyId, code, excludeId] : [companyId, code]
    );
    return row != null;
  }

  async list(companyId: string, options: InventoryWarehouseListOptions = {}): Promise<InventoryWarehouse[]> {
    const { where, params } = filters(companyId, options);
    const rows = await all<WarehouseRow>(
      `SELECT * FROM inventory_warehouses WHERE ${where}
       ORDER BY name COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
      [...params, options.limit ?? 100, options.offset ?? 0]
    );
    return rows.map(mapRow);
  }

  async count(companyId: string, options: Omit<InventoryWarehouseListOptions, "limit" | "offset"> = {}): Promise<number> {
    const { where, params } = filters(companyId, options);
    const row = await get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM inventory_warehouses WHERE ${where}`, params
    );
    return row?.count ?? 0;
  }

  async getActive(companyId: string): Promise<InventoryWarehouse[]> {
    const rows = await all<WarehouseRow>(
      `SELECT * FROM inventory_warehouses
       WHERE companyId = ? AND isActive = 1 AND isDeleted = 0
       ORDER BY name COLLATE NOCASE ASC`, [companyId]
    );
    return rows.map(mapRow);
  }
}
