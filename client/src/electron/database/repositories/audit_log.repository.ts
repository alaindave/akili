import { randomUUID } from "crypto";
import { all, run } from "../db.js";
import type {
  AuditLog,
  CreateAuditLogInput,
} from "../../../common/types/AuditLog.js";

/**
 * Persist an immutable audit entry. `changes` is serialized so callers can
 * record any set of fields while the database schema remains reusable.
 */
export async function createAuditLog(
  input: CreateAuditLogInput
): Promise<AuditLog> {
  const requiredFields = [
    "companyId",
    "userId",
    "userName",
    "action",
    "entity",
    "entityId",
    "description",
  ] as const;

  for (const field of requiredFields) {
    if (!input[field]?.trim()) {
      throw new Error(`Audit log ${field} is required.`);
    }
  }

  const auditLog: AuditLog = {
    _id: randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
  };

  await run(
    `
      INSERT INTO audit_logs (
        _id, companyId, userId, userName, action, entity, entityId,
        description, changes, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      auditLog._id,
      auditLog.companyId,
      auditLog.userId,
      auditLog.userName,
      auditLog.action,
      auditLog.entity,
      auditLog.entityId,
      auditLog.description,
      auditLog.changes ? JSON.stringify(auditLog.changes) : null,
      auditLog.createdAt,
    ]
  );

  return auditLog;
}

/** Returns an entity's newest audit entries first. */
export async function getAuditLogs(
  companyId: string,
  entity: string,
  entityId: string
): Promise<AuditLog[]> {
  const rows = await all<Omit<AuditLog, "changes"> & { changes: string | null }>(
    `
      SELECT _id, companyId, userId, userName, action, entity, entityId,
             description, changes, createdAt
      FROM audit_logs
      WHERE companyId = ? AND entity = ? AND entityId = ?
      ORDER BY createdAt DESC
    `,
    [companyId, entity, entityId]
  );

  return rows.map((row) => ({
    ...row,
    changes: row.changes ? JSON.parse(row.changes) : undefined,
  }));
}
