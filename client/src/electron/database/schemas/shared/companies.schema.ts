import { all, run } from "../../db.js";

export async function createCompanyTable() {
  await run(`
CREATE TABLE IF NOT EXISTS companies (
  _id TEXT PRIMARY KEY,
  companyId TEXT NOT NULL,
  name TEXT NOT NULL,
  legalName TEXT ,
  logoPath TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  attendanceClockIn TEXT NOT NULL DEFAULT '08:00',
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  serverVersion INTEGER NOT NULL DEFAULT 0,
  lastSyncedAt DATETIME,
  synced INTEGER NOT NULL DEFAULT 0,
  isDeleted INTEGER NOT NULL DEFAULT 0
);
  `);

  const columns = await all<{ name: string }>("PRAGMA table_info(companies)");
  for (const [name, definition] of Object.entries({
    inventoryInitialized: "INTEGER NOT NULL DEFAULT 0 CHECK (inventoryInitialized IN (0, 1))",
    inventoryInitializedAt: "TEXT",
    inventoryInitializationDocumentId: "TEXT",
    inventoryInitializationDocumentNumber: "TEXT",
  })) {
    if (!columns.some((column) => column.name === name)) {
      await run(`ALTER TABLE companies ADD COLUMN ${name} ${definition}`);
    }
  }
  // Local drafts have no stock effect; only the server can post an opening document.
  await run(`CREATE TABLE IF NOT EXISTS inventory_opening_drafts (
    companyId TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`);
  if (!columns.some((column) => column.name === "attendanceClockIn")) {
    await run(
      "ALTER TABLE companies ADD COLUMN attendanceClockIn TEXT NOT NULL DEFAULT '08:00'"
    );
  }

  console.log("COMPANY TABLE INITIALIZED");
}
