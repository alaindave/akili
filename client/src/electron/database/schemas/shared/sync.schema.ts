import { run, all } from "../../db.js";

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

  const columns = await all<{ name: string }>("PRAGMA table_info(sync_queue)");
  if (!columns.some((column) => column.name === "blockedReason")) {
    await run("ALTER TABLE sync_queue ADD COLUMN blockedReason TEXT");
  }
  await run(`CREATE TABLE IF NOT EXISTS sync_deferred (
    companyId TEXT NOT NULL, entity TEXT NOT NULL, entityId TEXT NOT NULL,
    serverVersion INTEGER NOT NULL, payload TEXT NOT NULL,
    PRIMARY KEY (companyId, entity, entityId)
  )`);

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

  console.log("SYNC TABLE INITIALIZED");
}
