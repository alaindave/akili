import { all, allDirect, getDirect, runDirect, transaction } from "../../../db.js";
import { INVENTORY_SYNC_TABLES, type InventorySyncEntity } from "../../../../../common/types/inventory/InventorySync.js";

type InventoryRow = Record<string, unknown>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return JSON.stringify(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return JSON.stringify(value ?? null);
}

// Repair legacy lost acknowledgements only when the server still contains a
// snapshot this device previously uploaded successfully. A real remote edit
// must remain a conflict, even when it has a newer revision.
export async function recoverInventoryAcknowledgement(companyId: string, entity: InventorySyncEntity, snapshot: InventoryRow, remote: InventoryRow) {
  if (!remote || remote._id !== snapshot._id || remote.companyId !== companyId ||
      typeof remote.serverVersion !== "number" || !Number.isSafeInteger(remote.serverVersion) || remote.serverVersion <= Number(snapshot.serverVersion ?? 0)) return;
  const table = INVENTORY_SYNC_TABLES[entity];
  const key = entity === "inventory_sku_settings" ? "companyId" : "_id";
  await transaction(async () => {
    const accepted = await allDirect<{ payload: string }>(`SELECT payload FROM sync_queue
      WHERE companyId = ? AND entity = ? AND entityId = ? AND synced = 1
        AND COALESCE(json_extract(payload, '$.serverVersion'), 0) = ?`,
      [companyId, entity, snapshot._id, Number(snapshot.serverVersion ?? 0)]);
    const matches = accepted.some(({ payload }) => {
      const previous = JSON.parse(payload) as InventoryRow;
      return Object.keys(previous).filter(field => !["synced", "serverVersion", "createdAt", "updatedAt"].includes(field)).every(field => {
        const normalize = (value: unknown) => field === "customFields" && typeof value === "string" ? JSON.parse(value) :
          ["isActive", "isDeleted", "isBaseUnit"].includes(field) && typeof value === "boolean" ? Number(value) : value;
        return canonical(normalize(previous[field])) === canonical(normalize(remote[field]));
      });
    });
    if (!matches) return;
    const base = Number(snapshot.serverVersion ?? 0);
    await runDirect(`UPDATE sync_queue SET payload = json_set(payload, '$.serverVersion', ?)
      WHERE companyId = ? AND entity = ? AND entityId = ? AND synced = 0
        AND COALESCE(json_extract(payload, '$.serverVersion'), 0) = ?`,
      [remote.serverVersion, companyId, entity, snapshot._id, base]);
    await runDirect(`UPDATE ${table} SET serverVersion = ? WHERE companyId = ? AND ${key} = ? AND serverVersion = ?`,
      [remote.serverVersion, companyId, snapshot._id, base]);
  });
}

export async function acknowledgeInventorySnapshot(companyId: string, entity: InventorySyncEntity, snapshot: InventoryRow, queueId: string, serverVersion: number) {
  if (!Number.isSafeInteger(serverVersion) || serverVersion < Number(snapshot.serverVersion ?? 0)) {
    throw new Error("Invalid inventory acknowledgement version");
  }
  const table = INVENTORY_SYNC_TABLES[entity];
  const key = entity === "inventory_sku_settings" ? "companyId" : "_id";
  await transaction(async () => {
    const row = await getDirect<InventoryRow>(`SELECT * FROM ${table} WHERE companyId = ? AND ${key} = ?`, [companyId, snapshot._id]);
    const queued = await getDirect<{ payload: string; synced: number }>(
      "SELECT payload, synced FROM sync_queue WHERE companyId = ? AND entity = ? AND entityId = ? AND _id = ?",
      [companyId, entity, snapshot._id, queueId]
    );
    if (!queued || canonical(JSON.parse(queued.payload)) !== canonical(snapshot)) {
      throw new Error("Inventory acknowledgement does not match the queued snapshot");
    }
    if (queued.synced) return;
    const baseVersion = Number(snapshot.serverVersion ?? 0);
    // Only advance descendants of this accepted local revision. Other bases
    // still go through server conflict detection.
    await runDirect(`UPDATE sync_queue SET payload = json_set(payload, '$.serverVersion', ?)
      WHERE companyId = ? AND entity = ? AND entityId = ? AND synced = 0 AND _id != ?
        AND COALESCE(json_extract(payload, '$.serverVersion'), 0) = ?`,
      [serverVersion, companyId, entity, snapshot._id, queueId, baseVersion]);
    if (row && Number(row.serverVersion ?? 0) === baseVersion) {
      const unchanged = !Object.keys(row).some(field => !["synced", "serverVersion"].includes(field) && row[field] !== snapshot[field]);
      await runDirect(`UPDATE ${table} SET serverVersion = ?, synced = ? WHERE companyId = ? AND ${key} = ?`,
        [serverVersion, unchanged ? 1 : 0, companyId, snapshot._id]);
    }
    await runDirect("UPDATE sync_queue SET synced = 1 WHERE companyId = ? AND _id = ?", [companyId, queueId]);
  });
}

export async function applyInventoryBatch(companyId: string, entity: InventorySyncEntity, items: InventoryRow[]): Promise<boolean> {
  const table = INVENTORY_SYNC_TABLES[entity];
  const key = entity === "inventory_sku_settings" ? "companyId" : "_id";
  const columns = (await all<{ name: string }>(`PRAGMA table_info(${table})`)).map(column => column.name);
  return transaction(async () => {
    // Recheck inside the transaction: edits may have arrived since the HTTP response.
    for (const item of items) {
      if (await getDirect("SELECT 1 FROM sync_queue WHERE companyId = ? AND entity = ? AND entityId = ? AND synced = 0 LIMIT 1", [companyId, entity, item._id])) return false;
      if (item.companyId !== companyId || typeof item._id !== "string" || typeof item.serverVersion !== "number" || !Number.isSafeInteger(item.serverVersion) || item.serverVersion < 0) {
        throw new Error("Invalid inventory pull record");
      }
      let existing = await getDirect<InventoryRow>(`SELECT * FROM ${table} WHERE ${key} = ?`, [item[key]]);
      if (existing && existing.companyId !== companyId) throw new Error("Inventory ID belongs to another company");
      if (entity === "inventory_balance") {
        // Stock posting assigns canonical server IDs. Reuse a clean local
        // bucket instead of keeping a second balance for the same stock.
        if (await getDirect("SELECT 1 FROM sync_queue WHERE companyId = ? AND entity = 'inventory_transaction' AND synced = 0 LIMIT 1", [companyId])) return false;
        const matches = await allDirect<InventoryRow>(`SELECT * FROM inventory_balances WHERE companyId = ? AND itemId = ? AND warehouseId = ?
          AND COALESCE(locationId, '') = ? AND COALESCE(lotId, '') = ? AND COALESCE(serialNumber, '') = ? AND isDeleted = 0`,
          [companyId, item.itemId, item.warehouseId, item.locationId ?? "", item.lotId ?? "", item.serialNumber ?? ""]);
        if (matches.length > 1) throw new Error("Duplicate local stock balances require reconciliation");
        const local = matches[0];
        if (local && local._id !== item._id) {
          if (existing || local.synced === 0 || await getDirect("SELECT 1 FROM sync_queue WHERE companyId = ? AND entity = 'inventory_balance' AND entityId = ? AND synced = 0 LIMIT 1", [companyId, local._id])) {
            throw new Error("Inventory pull would overwrite an unreconciled stock balance");
          }
          await runDirect("UPDATE inventory_balances SET _id = ? WHERE companyId = ? AND _id = ? AND synced = 1", [item._id, companyId, local._id]);
          existing = { ...local, _id: item._id };
        }
      }
      if (existing?.synced === 0) throw new Error("Inventory pull would overwrite a local edit");
      if (existing && Number(existing.serverVersion) >= item.serverVersion) continue;
      if (entity === "inventory_custom_field" && existing &&
          (item.key !== existing.key || item.entity !== existing.entity)) {
        throw new Error("La clé et l’entité d’un champ personnalisé existant ne peuvent pas être modifiées.");
      }
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
