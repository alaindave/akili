import { run } from "../db.js";

export async function createEmployeesDocumentsTable() {
  await run(`
    CREATE TABLE IF NOT EXISTS employees_documents (
      companyId TEXT NOT NULL,
      _id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      uploadedBy TEXT,
      documentType TEXT NOT NULL,
      originalName TEXT NOT NULL,
      fileName TEXT NOT NULL,
      localPath TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      hash TEXT NOT NULL,
      serverVersion INTEGER NOT NULL DEFAULT 1,
      needsUpload INTEGER NOT NULL DEFAULT 1,
      isDeleted INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastSyncedAt DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (employeeId)
        REFERENCES employees(_id)
        ON DELETE CASCADE,

      FOREIGN KEY (uploadedBy)
        REFERENCES admin_users(_id)
        ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_employees_documents_companyId
    ON employees_documents(companyId)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_employees_documents_company_employee
    ON employees_documents(companyId, employeeId)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_employees_documents_needs_upload
    ON employees_documents(companyId, needsUpload)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_employees_documents_server_version
    ON employees_documents(companyId, serverVersion)
  `);

  console.log("EMPLOYEE DOCUMENTS TABLE INITIALIZED");
}
