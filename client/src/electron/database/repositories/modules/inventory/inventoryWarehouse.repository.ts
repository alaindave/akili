import type {
  CreateInventoryWarehouseInput,
  InventoryWarehouse,
} from "../../../../../common/types/inventory/InventoryWarehouse.js";
import { all, get, run } from "../../../db.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Le code est obligatoire.")
    .max(100)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(255),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(500).optional(),
  type: z.enum([
    "RAW_MATERIAL",
    "PRODUCTION",
    "FINISHED_GOODS",
    "GENERAL",
    "OTHER",
  ]),
  isActive: z.boolean(),
});

export interface InventoryWarehouseListOptions {
  search?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

type WarehouseRow = Omit<
  InventoryWarehouse,
  | "isActive"
  | "synced"
  | "isDeleted"
  | "customFields"
  | "description"
  | "address"
> & {
  isActive: number;
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
  private async nextCode(companyId: string): Promise<string> {
    // Include deleted warehouses because their codes remain reserved.
    const row = await get<{ lastNumber: number }>(
      `SELECT COALESCE(MAX(CAST(SUBSTR(code, 5) AS INTEGER)), 0) AS lastNumber
       FROM inventory_warehouses
       WHERE companyId = ? AND code GLOB 'ENT-[0-9][0-9][0-9]'`,
      [companyId]
    );
    const next = (row?.lastNumber ?? 0) + 1;
    if (next > 999) throw new Error("La limite des codes ENT-001 à ENT-999 est atteinte.");
    return `ENT-${String(next).padStart(3, "0")}`;
  }

  async create(
    companyId: string,
    input: CreateInventoryWarehouseInput
  ): Promise<InventoryWarehouse> {
    const data = createSchema.parse({
      ...input,
      code: input.code?.trim() || "ENT-001",
    });
    const now = new Date().toISOString();
    const warehouse: InventoryWarehouse = {
      ...data,
      _id: randomUUID(),
      companyId,
      createdAt: now,
      updatedAt: now,
      serverVersion: 0,
      synced: false,
      isDeleted: false,
    };
    const automaticCode = !input.code?.trim();
    for (let attempt = 0; attempt < 5; attempt++) {
      if (automaticCode) {
        data.code = await this.nextCode(companyId);
        warehouse.code = data.code;
      }
      try {
      await run(
        `INSERT INTO inventory_warehouses
        (_id, companyId, code, name, description, address, type, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          warehouse._id,
          companyId,
          data.code,
          data.name,
          data.description || null,
          data.address || null,
          data.type,
          data.isActive ? 1 : 0,
          now,
          now,
        ]
      );
    } catch (error) {
      if (
        (error as { code?: string }).code === "SQLITE_CONSTRAINT" &&
        (await this.codeExists(companyId, data.code))
      ) {
        // Another creation may have reserved this number while we were saving.
        if (automaticCode && attempt < 4) continue;
        throw new Error("Un entrepôt avec ce code existe déjà.");
      }
      throw error;
    }
    return warehouse;
    }
    throw new Error("Impossible de générer un code d’entrepôt disponible.");
  }

  async update(companyId: string, id: string, input: CreateInventoryWarehouseInput): Promise<InventoryWarehouse> {
    const data = createSchema.parse(input);
    if (!await this.getById(companyId, id)) throw new Error("Entrepôt introuvable.");
    if (await this.codeExists(companyId, data.code, id)) throw new Error("Un entrepôt avec ce code existe déjà.");
    await run(`UPDATE inventory_warehouses SET code = ?, name = ?, description = ?, address = ?, type = ?, isActive = ?, updatedAt = ?, synced = 0
      WHERE companyId = ? AND _id = ? AND isDeleted = 0`,
      [data.code, data.name, data.description || null, data.address || null, data.type, data.isActive ? 1 : 0, new Date().toISOString(), companyId, id]);
    return (await this.getById(companyId, id))!;
  }

  async getById(
    companyId: string,
    id: string
  ): Promise<InventoryWarehouse | null> {
    const row = await get<WarehouseRow>(
      "SELECT * FROM inventory_warehouses WHERE companyId = ? AND _id = ? AND isDeleted = 0 LIMIT 1",
      [companyId, id]
    );
    return row ? mapRow(row) : null;
  }

  async getByCode(
    companyId: string,
    code: string
  ): Promise<InventoryWarehouse | null> {
    const row = await get<WarehouseRow>(
      "SELECT * FROM inventory_warehouses WHERE companyId = ? AND code = ? AND isDeleted = 0 LIMIT 1",
      [companyId, code]
    );
    return row ? mapRow(row) : null;
  }

  // Deleted warehouses still reserve their code under UNIQUE(companyId, code).
  async codeExists(
    companyId: string,
    code: string,
    excludeId?: string
  ): Promise<boolean> {
    const row = await get<{ found: number }>(
      `SELECT 1 AS found FROM inventory_warehouses
       WHERE companyId = ? AND code = ? ${
         excludeId ? "AND _id != ?" : ""
       } LIMIT 1`,
      excludeId ? [companyId, code, excludeId] : [companyId, code]
    );
    return row != null;
  }

  async list(
    companyId: string,
    options: InventoryWarehouseListOptions = {}
  ): Promise<InventoryWarehouse[]> {
    const { where, params } = filters(companyId, options);
    const rows = await all<WarehouseRow>(
      `SELECT * FROM inventory_warehouses WHERE ${where}
       ORDER BY code COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
      [...params, options.limit ?? 100, options.offset ?? 0]
    );
    return rows.map(mapRow);
  }

  async count(
    companyId: string,
    options: Omit<InventoryWarehouseListOptions, "limit" | "offset"> = {}
  ): Promise<number> {
    const { where, params } = filters(companyId, options);
    const row = await get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM inventory_warehouses WHERE ${where}`,
      params
    );
    return row?.count ?? 0;
  }

  async getActive(companyId: string): Promise<InventoryWarehouse[]> {
    const rows = await all<WarehouseRow>(
      `SELECT * FROM inventory_warehouses
       WHERE companyId = ? AND isActive = 1 AND isDeleted = 0
       ORDER BY name COLLATE NOCASE ASC`,
      [companyId]
    );
    return rows.map(mapRow);
  }
}
