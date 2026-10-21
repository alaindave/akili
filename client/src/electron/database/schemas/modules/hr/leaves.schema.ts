import { all, get, run } from "../../../db.js";
import { TIME_OFF_MIGRATION } from "../../../../../common/migrations/timeOffLegacy.js";

export async function createLeavesTable() {
  const migrationTable = await get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
  );
  if (migrationTable) {
    const marker = await get<{ name: string }>("SELECT name FROM migrations WHERE name=?", [TIME_OFF_MIGRATION]);
    if (marker) {
      const canonical = await all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('time_off','time_off_motifs')");
      if (canonical.length !== 2) throw new Error("TimeOff migration marker exists but canonical tables are missing");
      // Never recreate a `leaves` table beside the migrated archive. The legacy
      // IPC is retired for this database; the TimeOff bridge owns local writes.
      console.log("LEGACY LEAVE TABLE SKIPPED: canonical TimeOff migration is active");
      return;
    }
  }
  await run(`
    CREATE TABLE IF NOT EXISTS leaves (
      companyId TEXT NOT NULL,
      _id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      submittedAt TEXT NOT NULL,
      submittedMonth TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      motif TEXT NOT NULL,
      notes TEXT NOT NULL,
      additionalNotes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ATTENTE_APPROBATION'
        CHECK(status IN ('APPROUVÉ', 'REFUSÉ', 'ATTENTE_APPROBATION','ANNULÉ')),
      serverVersion INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastSyncedAt DATETIME,
      synced INTEGER DEFAULT 0,
      isDeleted INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (employeeId)
        REFERENCES employees(_id)
    )
  `);

  const columns = await all<{ name: string }>("PRAGMA table_info(leaves)");
  if (columns.some((column) => column.name === "subject") &&
      !columns.some((column) => column.name === "motif")) {
    await run("ALTER TABLE leaves RENAME COLUMN subject TO motif");
  }
  if (!columns.some((column) => column.name === "additionalNotes")) {
    await run(
      "ALTER TABLE leaves ADD COLUMN additionalNotes TEXT NOT NULL DEFAULT ''"
    );
  }

  console.log("LEAVES TABLE INITIALIZED");
}
