import { all, run } from "../../../db.js";

export async function createLeavesTable() {
  await run(`
    CREATE TABLE IF NOT EXISTS leaves (
      companyId TEXT NOT NULL,
      _id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      submittedAt TEXT NOT NULL,
      submittedMonth TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      subject TEXT NOT NULL,
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
  if (!columns.some((column) => column.name === "additionalNotes")) {
    await run("ALTER TABLE leaves ADD COLUMN additionalNotes TEXT NOT NULL DEFAULT ''");
  }

  console.log("LEAVES TABLE INITIALIZED");
}
