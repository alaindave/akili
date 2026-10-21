import { run } from "../../db.js";

export async function createSyncTable() {
  /* =========================================================
     SYNC QUEUE
  ========================================================= */

  await run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      _id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId TEXT NOT NULL,
      entity TEXT NOT NULL,
      entityId TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /* =========================================================
     SYNC STATE
  ========================================================= */

  await run(`
    CREATE TABLE IF NOT EXISTS sync_state (
      companyId TEXT NOT NULL,
      entity TEXT NOT NULL,
      lastPulledVersion INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL,
      PRIMARY KEY (companyId, entity)
    );
  `);

  /* =========================================================
     INDEXES
  ========================================================= */

  await run(`
    CREATE INDEX IF NOT EXISTS idx_sync_queue_company
    ON sync_queue(companyId);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_sync_queue_company_synced
    ON sync_queue(companyId, synced);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_sync_queue_company_entity
    ON sync_queue(companyId, entity);
  `);

  // Upgrade both pending payloads and acknowledged history used for conflict recovery.
  await run(`
    UPDATE sync_queue
    SET payload = json_remove(
      json_set(payload, '$.motif', COALESCE(json_extract(payload, '$.motif'),
        json_extract(payload, '$.subject'))), '$.subject')
    WHERE entity = 'leave' AND json_valid(payload)
      AND json_type(payload, '$.subject') IS NOT NULL
  `);

  console.log("SYNC TABLE INITIALIZED");
}
