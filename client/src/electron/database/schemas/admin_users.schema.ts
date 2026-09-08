import { run } from "../db.js";

export async function createAdminUsersTable() {
  await run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      companyId TEXT NOT NULL,
      _id TEXT PRIMARY KEY,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ADMIN'
        CHECK (role IN ('MANAGER', 'ADMIN','VIEWER')),
      serverVersion INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastSyncedAt DATETIME,
      synced INTEGER DEFAULT 0,
      isDeleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_admin_users_company_email
    ON admin_users(companyId, email);
  `);

  console.log("ADMIN USERS TABLE INITIALIZED");
}
