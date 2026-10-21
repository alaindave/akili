import { TIME_OFF_MIGRATION, legacyTimeOffStatus, validateLegacyTimeOff } from "../../../common/migrations/timeOffLegacy.js";
import { PayrollTreatment, TimeOffCategory, TimeOffStatus } from "../../../common/types/hr/time-off/TimeOff.js";

type Value = string | number | null;
export interface TimeOffMigrationDatabase {
  run(sql: string, params?: Value[]): Promise<unknown>;
  all<T>(sql: string, params?: Value[]): Promise<T[]>;
  get<T>(sql: string, params?: Value[]): Promise<T | null>;
  transaction<T>(callback: () => Promise<T>): Promise<T>;
}
const enumSql = (values: string[]) => values.map((value) => `'${value.replaceAll("'", "''")}'`).join(",");

/** Explicit maintenance operation; never called by ordinary database startup. */
export async function migrateTimeOff(db: TimeOffMigrationDatabase, companyId: string) {
  if (!companyId.trim()) throw new Error("An explicit companyId is required");
  const foreignKeys = await db.get<{ foreign_keys: number }>("PRAGMA foreign_keys");
  if (foreignKeys?.foreign_keys !== 1) throw new Error("Enable SQLite foreign_keys before migration");
  return db.transaction(async () => {
    await db.run(`CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, runAt TEXT DEFAULT CURRENT_TIMESTAMP)`);
    const tables = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
    const has = (name: string) => tables.some((table) => table.name === name);
    if (await db.get("SELECT name FROM migrations WHERE name=?", [TIME_OFF_MIGRATION])) {
      if (!has("time_off") || !has("time_off_motifs")) throw new Error("Migration marker exists but canonical tables are missing");
      if (await db.get("SELECT _id FROM time_off WHERE companyId<>? LIMIT 1", [companyId])) {
        throw new Error("Migrated database belongs to another company");
      }
      const columns = await db.all<{ name: string }>("PRAGMA table_info(time_off)");
      if (!columns.some(column => column.name === "supportingDocumentIds"))
        await db.run("ALTER TABLE time_off ADD COLUMN supportingDocumentIds TEXT CHECK(supportingDocumentIds IS NULL OR json_valid(supportingDocumentIds))");
      if (!columns.some(column => column.name === "balanceDaysDeducted"))
        await db.run("ALTER TABLE time_off ADD COLUMN balanceDaysDeducted REAL NOT NULL DEFAULT 0");
      return { alreadyApplied: true, metadataColumnsEnsured: true };
    }
    if (has("time_off") || has("time_off_motifs") || has("leaves_legacy_time_off_v1")) {
      throw new Error("Unrecognized partial TimeOff migration; restore or review before continuing");
    }
    if ((await db.all("PRAGMA foreign_key_check")).length) throw new Error("Existing foreign-key violations must be resolved first");
    const rows = has("leaves") ? await db.all<Record<string, Value>>("SELECT * FROM leaves") : [];
    for (const row of rows) {
      validateLegacyTimeOff(row);
      if (typeof row._id !== "string" || !row._id.trim()) throw new Error("Invalid SQLite leave identifier");
      if (row.companyId !== companyId) throw new Error("Leave belongs to another company; wrong database selected");
      const employee = await db.get<{ companyId: string }>("SELECT companyId FROM employees WHERE _id=?", [row.employeeId]);
      if (employee?.companyId !== companyId) throw new Error("Leave employee is missing or belongs to another company");
    }
    // Renaming retains every original column, index, and historical inbound FK.
    // Unknown triggers/views can contain write behavior: refuse rather than rewrite SQL blindly.
    const dependencies = await db.all<{ type: string; name: string; sql: string }>(
      "SELECT type,name,sql FROM sqlite_master WHERE type IN ('trigger','view') AND sql IS NOT NULL");
    if (dependencies.some((item) => /\bleaves\b/i.test(item.sql))) {
      throw new Error("Custom leaves triggers/views require review before migration");
    }
    if (has("leaves")) await db.run("ALTER TABLE leaves RENAME TO leaves_legacy_time_off_v1");
    await db.run(`CREATE TABLE time_off_motifs (
      _id TEXT PRIMARY KEY, companyId TEXT NOT NULL, code TEXT NOT NULL, label TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN (${enumSql(Object.values(TimeOffCategory))})),
      payrollTreatment TEXT NOT NULL CHECK(payrollTreatment IN (${enumSql(Object.values(PayrollTreatment))})),
      deductFromLeaveBalance INTEGER NOT NULL CHECK(deductFromLeaveBalance IN (0,1)),
      requiresApproval INTEGER NOT NULL CHECK(requiresApproval IN (0,1)),
      requiresJustification INTEGER NOT NULL CHECK(requiresJustification IN (0,1)),
      requiresSupportingDocument INTEGER NOT NULL CHECK(requiresSupportingDocument IN (0,1)),
      isSystemDefault INTEGER NOT NULL CHECK(isSystemDefault IN (0,1)),
      isActive INTEGER NOT NULL CHECK(isActive IN (0,1)),
      createdAt TEXT, updatedAt TEXT,
      serverVersion INTEGER NOT NULL DEFAULT 0, lastSyncedAt TEXT,
      synced INTEGER NOT NULL DEFAULT 0, isDeleted INTEGER NOT NULL DEFAULT 0,
      UNIQUE(companyId,code), UNIQUE(companyId,_id)
    )`);
    await db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_company_id_time_off ON employees(companyId,_id)");
    await db.run(`CREATE TABLE time_off (
      _id TEXT PRIMARY KEY, companyId TEXT NOT NULL, employeeId TEXT NOT NULL,
      motifId TEXT, motifSnapshot TEXT CHECK(motifSnapshot IS NULL OR json_valid(motifSnapshot)),
      startDate TEXT NOT NULL, endDate TEXT NOT NULL,
      isPartialDay INTEGER CHECK(isPartialDay IS NULL OR isPartialDay IN (0,1)), startTime TEXT, endTime TEXT,
      notes TEXT, additionalNotes TEXT, submittedAt TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN (${enumSql(Object.values(TimeOffStatus))})),
      approvedBy TEXT, approvedAt TEXT, rejectionReason TEXT,
      supportingDocumentIds TEXT CHECK(supportingDocumentIds IS NULL OR json_valid(supportingDocumentIds)),
      balanceDaysDeducted REAL NOT NULL DEFAULT 0,
      serverVersion INTEGER NOT NULL DEFAULT 0, createdAt TEXT, updatedAt TEXT, lastSyncedAt TEXT,
      synced INTEGER, isDeleted INTEGER NOT NULL DEFAULT 0,
      legacyNeedsReview INTEGER NOT NULL DEFAULT 0 CHECK(legacyNeedsReview IN (0,1)),
      legacyData TEXT CHECK(legacyData IS NULL OR json_valid(legacyData)),
      CHECK(motifId IS NOT NULL OR (legacyNeedsReview=1 AND legacyData IS NOT NULL)),
      UNIQUE(companyId,_id),
      FOREIGN KEY(companyId,employeeId) REFERENCES employees(companyId,_id),
      FOREIGN KEY(companyId,motifId) REFERENCES time_off_motifs(companyId,_id) ON DELETE RESTRICT
    )`);
    const copied = ["_id", "companyId", "employeeId", "startDate", "endDate", "isPartialDay", "startTime", "endTime",
      "notes", "additionalNotes", "submittedAt", "approvedBy", "approvedAt", "rejectionReason", "serverVersion",
      "createdAt", "updatedAt", "lastSyncedAt", "synced", "isDeleted"];
    for (const row of rows) {
      const fields = copied.filter((field) => Object.hasOwn(row, field));
      const values = fields.map((field) => row[field]);
      await db.run(`INSERT INTO time_off (${fields.join(",")},status,legacyNeedsReview,legacyData)
        VALUES (${fields.map(() => "?").join(",")},?,1,?)`,
        [...values, legacyTimeOffStatus(row.status), JSON.stringify(row)]);
      const saved = await db.get<Record<string, Value>>("SELECT * FROM time_off WHERE companyId=? AND _id=?", [companyId, row._id]);
      if (!saved || fields.some((field) => saved[field] !== row[field]) || saved.legacyData !== JSON.stringify(row)) {
        throw new Error(`TimeOff integrity check failed for ${row._id}`);
      }
    }
    await db.run("CREATE INDEX idx_time_off_company_employee_dates ON time_off(companyId,employeeId,startDate,endDate)");
    await db.run("CREATE INDEX idx_time_off_company_version ON time_off(companyId,serverVersion)");
    await db.run("CREATE INDEX idx_time_off_company_motif ON time_off(companyId,motifId)");
    await db.run("CREATE INDEX idx_time_off_motifs_company_version ON time_off_motifs(companyId,serverVersion)");
    // Preserve the old cursor AND its canonical alias. Queued legacy operations
    // remain byte-for-byte intact for the explicit Stage 3 compatibility adapter.
    if (has("sync_state")) {
      const conflicts = await db.all("SELECT * FROM sync_state WHERE entity='time_off'");
      if (conflicts.length) throw new Error("Existing time_off cursor requires review");
      await db.run(`INSERT INTO sync_state(companyId,entity,lastPulledVersion,updatedAt)
        SELECT companyId,'time_off',lastPulledVersion,updatedAt FROM sync_state WHERE entity='leave' AND companyId=?`, [companyId]);
    }
    if ((await db.all("PRAGMA foreign_key_check")).length) throw new Error("Migration introduced foreign-key violations");
    const integrity = await db.get<{ integrity_check: string }>("PRAGMA integrity_check");
    if (integrity?.integrity_check !== "ok") throw new Error("SQLite integrity check failed");
    await db.run("INSERT INTO migrations(name) VALUES (?)", [TIME_OFF_MIGRATION]);
    return { alreadyApplied: false, migrated: rows.length, unresolvedMotifs: rows.length };
  });
}
