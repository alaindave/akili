import { get, run, transaction } from "../../db.js";

export async function createOfflineUsersTable() {
  const existing = await get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'offline_users'");
  // Rebuild the legacy email-unique table transactionally, preserving every row.
  if (existing && /email\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(existing.sql)) {
    await transaction(async () => {
      await run("ALTER TABLE offline_users RENAME TO offline_users_legacy");
      await createOfflineUsersTable();
      await run(`INSERT INTO offline_users SELECT * FROM offline_users_legacy`);
      await run("DROP TABLE offline_users_legacy");
    });
    return;
  }
  await run(`
  CREATE TABLE IF NOT EXISTS offline_users (
   companyId TEXT NOT NULL,
    _id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    notes TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lastVerifiedAt DATETIME,
    UNIQUE(companyId, email)
    
  );
  `);

  console.log("OFFLINE USERS TABLE INITIALIZED");
}
