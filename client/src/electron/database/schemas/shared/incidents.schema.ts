import { all, run } from "../../db.js";

export async function createIncidentsTable() {
  await run(`CREATE TABLE IF NOT EXISTS incidents (
    _id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    incidentNumber TEXT NOT NULL,
    reporterName TEXT NOT NULL CHECK(length(trim(reporterName)) > 0),
    reporterContact TEXT NOT NULL CHECK(length(trim(reporterContact)) > 0),
    occurredAt TEXT NOT NULL,
    location TEXT NOT NULL CHECK(length(trim(location)) > 0),
    notes TEXT NOT NULL CHECK(length(trim(notes)) > 0),
    preventiveActions TEXT NOT NULL DEFAULT '',
    remedialActions TEXT NOT NULL DEFAULT '',
    updatedAt TEXT NOT NULL,
    serverVersion INTEGER NOT NULL DEFAULT 0,
    synced INTEGER NOT NULL DEFAULT 0,
    lastSyncedAt TEXT,
    isDeleted INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  )`);
  const columns = await all<{ name: string }>("PRAGMA table_info(incidents)");
  const additions = {
    updatedAt: "TEXT",
    serverVersion: "INTEGER NOT NULL DEFAULT 0",
    synced: "INTEGER NOT NULL DEFAULT 0",
    lastSyncedAt: "TEXT",
    isDeleted: "INTEGER NOT NULL DEFAULT 0",
  };
  for (const [name, definition] of Object.entries(additions)) {
    if (!columns.some((column) => column.name === name)) {
      await run(`ALTER TABLE incidents ADD COLUMN ${name} ${definition}`);
    }
  }
  await run("UPDATE incidents SET updatedAt = createdAt WHERE updatedAt IS NULL");
  await run(`CREATE INDEX IF NOT EXISTS idx_incidents_company_date
    ON incidents(companyId, occurredAt DESC)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_incidents_company_location
    ON incidents(companyId, location)`);
}
