import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import loadMigration from "./time-off-migration-loader.mjs";

const sql = new DatabaseSync(":memory:");
const db = {
  get: async (query, values = []) => sql.prepare(query).get(...values),
  all: async (query, values = []) => sql.prepare(query).all(...values),
  run: async (query, values = []) => sql.prepare(query).run(...values),
  transaction: async callback => {
    if (sql.isTransaction) return callback();
    sql.exec("BEGIN");
    try { const result = await callback(); sql.exec("COMMIT"); return result; }
    catch (error) { sql.exec("ROLLBACK"); throw error; }
  },
};
function load(path, require) {
  const module = { exports: {} };
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, { module, exports: module.exports, require,
    process: { env: { VITE_API_URL: "https://sync.invalid" } }, console: { log() {}, warn() {}, error() {} } });
  return module.exports;
}
const queue = {
  addToSyncQueue: async item => {
    const result = sql.prepare("INSERT INTO sync_queue(companyId,entity,entityId,operation,payload,synced) VALUES (?,?,?,?,?,0)")
      .run(item.companyId, item.entity, item.entityId, item.operation, item.payload);
    return Number(result.lastInsertRowid);
  },
  getUnsyncedItems: async companyId => sql.prepare("SELECT * FROM sync_queue WHERE companyId=? AND synced=0 ORDER BY createdAt,_id").all(companyId),
  getPendingSyncItems: async (companyId, targets) => (await queue.getUnsyncedItems(companyId))
    .filter(row => targets.some(target => target.entity === row.entity && (!target.entityId || target.entityId === row.entityId))),
  markManySynced: async (companyId, ids) => {
    for (const id of ids) sql.prepare("UPDATE sync_queue SET synced=1 WHERE companyId=? AND _id=?").run(companyId, id);
  },
};
const repo = load("../src/electron/database/repositories/modules/hr/timeOff.repository.ts", name => {
  if (name.endsWith("/db.js")) return db;
  if (name === "crypto") return { randomUUID };
  if (name.endsWith("/sync.repository.js")) return queue;
  return {};
});
try {
  sql.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE employees(_id TEXT PRIMARY KEY,companyId TEXT,remainingLeave REAL);
    INSERT INTO employees VALUES ('e','a',20),('eb','b',20);
    CREATE TABLE sync_state(companyId TEXT,entity TEXT,lastPulledVersion INTEGER,updatedAt TEXT,PRIMARY KEY(companyId,entity));
    CREATE TABLE sync_queue(_id INTEGER PRIMARY KEY,companyId TEXT,entity TEXT,entityId TEXT,operation TEXT,payload TEXT,
      synced INTEGER DEFAULT 0,createdAt TEXT DEFAULT CURRENT_TIMESTAMP);`);
  const { migrateTimeOff } = loadMigration(fileURLToPath(new URL("../src/electron/database/migrations/timeOff.migration.ts", import.meta.url)));
  await migrateTimeOff(db, "a");
  const motif = { _id: "m", companyId: "a", code: "ANNUAL", label: "Annual", category: "LEAVE", payrollTreatment: "PAID",
    deductFromLeaveBalance: true, requiresApproval: true, requiresJustification: false, requiresSupportingDocument: false,
    isSystemDefault: false, isActive: true, serverVersion: 1, synced: 1, isDeleted: 0 };
  await repo.upsertPulledTimeOff("a", "time_off_motif", motif);
  await repo.upsertPulledTimeOff("a", "time_off_motif", { ...motif, serverVersion: 0, label: "Stale" });
  assert.equal((await repo.getTimeOffMotif("a", "m")).label, "Annual");
  const request = await repo.createTimeOff("a", { _id: "r", employeeId: "e", motifId: "m", startDate: "2026-10-19", endDate: "2026-10-20", isPartialDay: false });
  let first = await repo.prepareTimeOffMutation((await queue.getUnsyncedItems("a"))[0]);
  assert.equal((await repo.prepareTimeOffMutation(first)).payload, first.payload, "Retries retain a stable mutation identity");
  await repo.updateTimeOff("a", "r", { additionalNotes: "Edited during push" });
  const accepted = { ...request, serverVersion: 2 };
  await repo.acknowledgeTimeOff("a", "time_off", first, accepted);
  assert.equal((await repo.getTimeOff("a", "r")).additionalNotes, "Edited during push");
  assert.equal((await repo.getTimeOff("a", "r")).synced, 0);
  assert.equal((await repo.getTimeOff("a", "r")).isPartialDay, false);
  let second = (await queue.getUnsyncedItems("a"))[0];
  assert.equal(JSON.parse(second.payload).serverVersion, 2);
  assert.equal(JSON.parse(second.payload).requestedAction, "notes");
  second = await repo.prepareTimeOffMutation(second);
  await assert.rejects(() => repo.acknowledgeTimeOff("a", "time_off", second, { ...accepted, companyId: "b" }));
  assert.equal((await queue.getUnsyncedItems("a")).length, 1);
  await repo.acknowledgeTimeOff("a", "time_off", second, { ...accepted, additionalNotes: "Edited during push", serverVersion: 3 });
  assert.equal((await repo.getTimeOff("a", "r")).synced, 1);

  await repo.transitionTimeOff("a", "r", "approve");
  const approval = await repo.prepareTimeOffMutation((await queue.getUnsyncedItems("a"))[0]);
  await repo.transitionTimeOff("a", "r", "cancel");
  const approved = { ...accepted, status: "APPROVED", serverVersion: 4, approvedBy: "manager", approvedAt: "2026-10-22T10:00:00Z",
    motifSnapshot: { code: motif.code, label: motif.label, category: motif.category, payrollTreatment: motif.payrollTreatment, deductFromLeaveBalance: true }, balanceDaysDeducted: 2 };
  await repo.acknowledgeTimeOff("a", "time_off", approval, approved);
  assert.equal((await repo.getTimeOff("a", "r")).status, "CANCELLED", "Approval acknowledgement preserves later cancellation");
  const cancellation = await repo.prepareTimeOffMutation((await queue.getUnsyncedItems("a"))[0]);
  assert.equal(JSON.parse(cancellation.payload).serverVersion, 4);
  await repo.acknowledgeTimeOff("a", "time_off", cancellation, { ...approved, status: "CANCELLED", serverVersion: 5 });
  await repo.transitionTimeOff("a", "r", "delete");
  const deletion = await repo.prepareTimeOffMutation((await queue.getUnsyncedItems("a"))[0]);
  await repo.acknowledgeTimeOff("a", "time_off", deletion, { ...approved, status: "CANCELLED", isDeleted: 1, serverVersion: 6 });
  assert.equal(await repo.getTimeOff("a", "r"), null);
  assert.equal(sql.prepare("SELECT isDeleted FROM time_off WHERE _id='r'").get().isDeleted, 1);

  // Shared push orders dependencies and sends only one revision of each record.
  await repo.saveTimeOffMotif("a", { ...motif, _id: "new-m", code: "NEW", serverVersion: 0 });
  await repo.saveTimeOffMotif("a", { ...motif, _id: "new-m", code: "NEW", label: "Second revision", serverVersion: 0 });
  await repo.createTimeOff("a", { _id: "new-r", employeeId: "e", motifId: "new-m", startDate: "2026-10-19", endDate: "2026-10-20" });
  await queue.addToSyncQueue({ companyId: "a", entity: "employee", entityId: "e", operation: "update", payload: JSON.stringify({ companyId: "a", _id: "e" }) });
  await queue.addToSyncQueue({ companyId: "a", entity: "leave", entityId: "historical", operation: "update", payload: "{}" });
  // The legacy payload may predate tenant envelopes and must be held without breaking modern pushes.
  const sent = [];
  class Form { append(key, value) { this[key] = value; } getHeaders() { return {}; } }
  const push = load("../src/electron/services/shared/sync/push.service.ts", name => {
    if (name === "electron") return { app: { isPackaged: false } };
    if (name === "form-data") return Form;
    if (name.endsWith("/InventorySync.js")) return { isInventorySyncEntity: () => false };
    if (name.endsWith("/auth.js")) return { getToken: async () => "token" };
    if (name.endsWith("/sync.repository.js")) return queue;
    if (name.endsWith("/timeOff.repository.js")) return repo;
    if (name === "axios") return { post: async (url, form) => {
      assert.equal(url, "https://sync.invalid/sync/push");
      sent.push(...JSON.parse(form.items));
      return { data: { synced: [], failed: [] } };
    } };
    return {};
  });
  await push.pushPendingChanges("a");
  assert.deepEqual(sent.map(row => row.entity), ["employee", "time_off_motif"]);
  assert.equal(sent.filter(row => row.data._id === "new-m").length, 1);
  assert.equal((await queue.getUnsyncedItems("a")).filter(row => row.entity === "leave").length, 1);

  // Shared pull holds its cursor and preserves local edits until acknowledgement.
  let cursor = 0;
  const pull = load("../src/electron/services/shared/sync/pull.service.ts", name => {
    if (name === "electron") return { app: { isPackaged: false } };
    if (name.endsWith("/db.js")) return db;
    if (name.endsWith("/auth.js")) return { getToken: async () => "token" };
    if (name.endsWith("/sync.repository.js")) return queue;
    if (name.endsWith("/syncState.repository.js")) return {
      getSyncState: async () => ({ lastPulledVersion: cursor }), updateLastPulledVersion: async (_company, _entity, version) => { cursor = version; },
    };
    if (name === "axios") return { get: async (url) => {
      assert.equal(url, "https://sync.invalid/sync/pull");
      return { data: { items: [{ ...motif, _id: "new-m", label: "Remote", serverVersion: 9 }], nextVersion: 9, hasMore: false } };
    } };
    return {};
  });
  await assert.rejects(() => pull.pullEntityByVersion("a", "time_off_motif", async rows => {
    for (const row of rows) await repo.upsertPulledTimeOff("a", "time_off_motif", row);
    return true;
  }), /CURSOR WAS NOT ADVANCED/);
  assert.equal(cursor, 0); assert.equal((await repo.getTimeOffMotif("a", "new-m")).label, "Second revision");
  let policyQueue = (await queue.getUnsyncedItems("a")).find(row => row.entity === "time_off_motif");
  await repo.acknowledgeTimeOff("a", "time_off_motif", policyQueue, { ...motif, _id: "new-m", code: "NEW", serverVersion: 10 });
  policyQueue = await repo.prepareTimeOffMutation((await queue.getUnsyncedItems("a")).find(row => row.entity === "time_off_motif"));
  await repo.acknowledgeTimeOff("a", "time_off_motif", policyQueue, { ...motif, _id: "new-m", code: "NEW", label: "Second revision", serverVersion: 11 });
  sent.length = 0;
  await push.pushPendingChanges("a");
  assert.deepEqual(sent.map(row => row.entity), ["employee", "time_off"], "Request follows acknowledged policy revisions");
  console.log("PASS: SQLite mutations, stable retries, revision chaining, in-flight edits, tenant checks, deletion, dependency ordering, legacy queue preservation and blocked pull cursors.");
} finally { sql.close(); }
