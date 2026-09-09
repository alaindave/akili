import { run, all } from "../db.js";

export async function createEmployeesTable() {
  /*
   * ============================================================
   * CREATE TABLE
   * ============================================================
   *
   *
   */
  await run(`
    CREATE TABLE IF NOT EXISTS employees (
      companyId TEXT NOT NULL,
      _id TEXT PRIMARY KEY,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      matricule TEXT NOT NULL,
      idNum TEXT NOT NULL,
      dateBirth TEXT NOT NULL,
      role TEXT NOT NULL,
      dateHired TEXT NOT NULL,
      department TEXT NOT NULL
        CHECK(department IN (
          'Administration',
          'Atelier',
          'Usine',
          'Magasin',
          'Sentinelle'
        )),
      telephone TEXT NOT NULL,
      address TEXT NOT NULL,
      emergencyContact TEXT NOT NULL,
      relationship TEXT NOT NULL,
      contactPhone TEXT NOT NULL,
      salary INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIF'
        CHECK (status IN ('ACTIF', 'INACTIF')),
      remainingLeave INTEGER NOT NULL DEFAULT 20,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      photo_filename TEXT,
      photo_path TEXT,
      photo_version INTEGER,
      photo_hash TEXT,
      photo_last_modified TEXT,
      photo_needs_upload INTEGER,
      photo_mime_type TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastSyncedAt DATETIME,
      synced INTEGER DEFAULT 0,
      isDeleted INTEGER NOT NULL DEFAULT 0
    )
  `);

  /*
   * ============================================================
   * CHECK EXISTING COLUMNS
   * ============================================================
   */

  const columns = await all<{ name: string }>(`PRAGMA table_info(employees)`);

  const hasCompanyId = columns.some((column) => column.name === "companyId");

  const hasServerVersion = columns.some(
    (column) => column.name === "serverVersion"
  );

  /*
   * ============================================================
   * EXISTING DATABASE MIGRATION
   * ============================================================
   *
   *
   */

  if (!hasCompanyId) {
    console.log("ADDING companyId COLUMN TO EMPLOYEES...");

    await run(`
      ALTER TABLE employees
      ADD COLUMN companyId TEXT NOT NULL DEFAULT ''
    `);

    console.log("companyId COLUMN ADDED SUCCESSFULLY.");
  }

  /*
   * ============================================================
   * serverVersion MIGRATION
   * ============================================================
   */

  if (!hasServerVersion) {
    console.log("ADDING serverVersion COLUMN TO EMPLOYEES...");

    await run(`
      ALTER TABLE employees
      ADD COLUMN serverVersion INTEGER NOT NULL DEFAULT 0
    `);

    console.log("serverVersion COLUMN ADDED SUCCESSFULLY.");
  }

  /*
   * ============================================================
   * MULTI-TENANT INDEX
   * ============================================================
   */

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_employees_company_matricule
    ON employees(companyId, matricule)
  `);

  /*
   * ============================================================
   * COMPANY INDEX
   * ============================================================
   *
   */

  await run(`
    CREATE INDEX IF NOT EXISTS
    idx_employees_company
    ON employees(companyId)
  `);

  console.log("EMPLOYEES TABLE INITIALIZED");
}
