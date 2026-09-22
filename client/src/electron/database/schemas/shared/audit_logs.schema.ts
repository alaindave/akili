import { run } from "../../db.js";

/** Creates the immutable, company-scoped audit trail table. */
export async function createAuditLogsTable() {
  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      _id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entityId TEXT NOT NULL,
      description TEXT NOT NULL,
      changes TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON audit_logs(companyId, entity, entityId, createdAt DESC);
  `);
}
