import { all, getDirect, runDirect, transaction } from "../../../db.js";
import { INVENTORY_SYNC_TABLES, type InventorySyncEntity } from "../../../../../common/types/inventory/InventorySync.js";

type InventoryRow = Record<string, any>;

export async function acknowledgeInventorySnapshot(companyId: string, entity: InventorySyncEntity, snapshot: InventoryRow) {
  const table = INVENTORY_SYNC_TABLES[entity];
  const key = entity === "inventory_sku_settings" ? "companyId" : "_id";
  await transaction(async () => {
    const row = await getDirect<InventoryRow>(`SELECT * FROM ${table} WHERE companyId = ? AND ${key} = ?`, [companyId, snapshot._id]);
    if (!row) return;
    // Do not mark a newer local edit as synchronized by an older acknowledgement.
    if (Object.keys(row).some(field => field !== "synced" && row[field] !== snapshot[field])) return;
    await runDirect(`UPDATE ${table} SET synced = 1 WHERE companyId = ? AND ${key} = ?`, [companyId, snapshot._id]);
  });
}

export async function applyInventoryBatch(companyId: string, entity: InventorySyncEntity, items: InventoryRow[]): Promise<boolean> {
  const table = INVENTORY_SYNC_TABLES[entity];
  const key = entity === "inventory_sku_settings" ? "companyId" : "_id";
  const columns = (await all<{ name: string }>(`PRAGMA table_info(${table})`)).map(column => column.name);
  return transaction(async () => {
    // Recheck inside the transaction: edits may have arrived since the HTTP response.
    if (await getDirect("SELECT 1 FROM sync_queue WHERE companyId = ? AND entity = ? AND synced = 0 LIMIT 1", [companyId, entity])) return false;
    for (const item of items) {
      if (item.companyId !== companyId || typeof item._id !== "string" || !Number.isSafeInteger(item.serverVersion) || item.serverVersion < 0) {
        throw new Error("Invalid inventory pull record");
      }
      const existing = await getDirect<InventoryRow>(`SELECT * FROM ${table} WHERE ${key} = ?`, [item[key]]);
      if (existing && existing.companyId !== companyId) throw new Error("Inventory ID belongs to another company");
      if (existing?.synced === 0) throw new Error("Inventory pull would overwrite a local edit");
      if (existing && existing.serverVersion >= item.serverVersion) continue;
      const values = columns.map(column => {
        if (column === "synced") return 1;
        const value = item[column];
        if (column === "customFields" && value != null && typeof value !== "string") return JSON.stringify(value);
        if (typeof value === "boolean") return Number(value);
        return value ?? null;
      });
      await runDirect(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})
        ON CONFLICT(${key}) DO UPDATE SET ${columns.filter(column => column !== key).map(column => `${column} = excluded.${column}`).join(", ")}
        WHERE ${table}.companyId = excluded.companyId`, values);
    }
    return true;
  });
}
