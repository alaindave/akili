import { all, run } from "../../../db.js";
import { INVENTORY_SYNC_TABLES } from "../../../../../common/types/inventory/InventorySync.js";

export async function initializeInventorySync() {
  const settingsColumns = await all<{ name: string }>("PRAGMA table_info(inventory_sku_settings)");
  for (const [name, definition] of Object.entries({
    createdAt: "TEXT NOT NULL DEFAULT ''",
    updatedAt: "TEXT NOT NULL DEFAULT ''",
    serverVersion: "INTEGER NOT NULL DEFAULT 0",
    synced: "INTEGER NOT NULL DEFAULT 0 CHECK (synced IN (0, 1))",
    isDeleted: "INTEGER NOT NULL DEFAULT 0 CHECK (isDeleted IN (0, 1))",
  })) {
    if (!settingsColumns.some(column => column.name === name)) {
      await run(`ALTER TABLE inventory_sku_settings ADD COLUMN ${name} ${definition}`);
    }
  }
  const now = new Date().toISOString();
  await run("UPDATE inventory_sku_settings SET createdAt = ?, updatedAt = ? WHERE updatedAt = ''", [now, now]);

  for (const [entity, table] of Object.entries(INVENTORY_SYNC_TABLES)) {
    const columns = (await all<{ name: string }>(`PRAGMA table_info(${table})`)).map(column => column.name);
    const key = entity === "inventory_sku_settings" ? "companyId" : "_id";
    const payload = (alias: string) => `json_object(${[
      ...(key === "companyId" ? [`'_id', ${alias}.companyId`] : []),
      ...columns.filter(column => column !== "synced").map(column => `'${column}', ${alias}.${column}`),
    ].join(", ")})`;
    for (const event of ["INSERT", "UPDATE"] as const) {
      await run(`CREATE TRIGGER IF NOT EXISTS ${table}_sync_${event.toLowerCase()}
        AFTER ${event} ON ${table} WHEN NEW.synced = 0
        BEGIN
          INSERT INTO sync_queue (companyId, entity, entityId, operation, payload)
          VALUES (NEW.companyId, '${entity}', NEW.${key}, 'create', ${payload("NEW")});
        END`);
    }
    await run(`CREATE TRIGGER IF NOT EXISTS ${table}_sync_delete
      AFTER DELETE ON ${table} WHEN NOT (OLD.synced = 1 AND OLD.isDeleted = 1)
      BEGIN
        INSERT INTO sync_queue (companyId, entity, entityId, operation, payload)
        VALUES (OLD.companyId, '${entity}', OLD.${key}, 'create',
          json_set(${payload("OLD")}, '$.isDeleted', 1, '$.updatedAt', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));
      END`);
    // Full snapshots use create/upsert semantics, including soft-deletion snapshots.
    // This also recovers inventory changes made before queue capture was installed.
    await run(`INSERT INTO sync_queue (companyId, entity, entityId, operation, payload)
      SELECT source.companyId, '${entity}', source.${key}, 'create', ${payload("source")}
      FROM ${table} source WHERE source.synced = 0 AND NOT EXISTS (
        SELECT 1 FROM sync_queue q WHERE q.companyId = source.companyId
          AND q.entity = '${entity}' AND q.entityId = source.${key} AND q.synced = 0
      )`);
  }
}
