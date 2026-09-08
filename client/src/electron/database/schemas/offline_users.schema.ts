import { run } from "../db.js";

export async function createOfflineUsersTable() {
  await run(`
  CREATE TABLE IF NOT EXISTS offline_users (
   companyId TEXT NOT NULL,
    _id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    notes TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lastVerifiedAt DATETIME
    
  );
  `);

  console.log("OFFLINE USERS TABLE INITIALIZED");
}
