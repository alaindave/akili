import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { DatabaseSync } from "node:sqlite";
import { URL } from "node:url";
import console from "node:console";
import ts from "typescript";

const sql = new DatabaseSync(":memory:");
const db = {
  get: async (query, values) => sql.prepare(query).get(...values),
  all: async (query, values) => sql.prepare(query).all(...values),
  run: async (query, values) => sql.prepare(query).run(...values),
  transaction: async callback => {
    sql.exec("BEGIN");
    try { const result = await callback(); sql.exec("COMMIT"); return result; }
    catch (error) { sql.exec("ROLLBACK"); throw error; }
  },
};
const module = { exports: {} };
const source = fs.readFileSync(new URL("../src/electron/database/repositories/modules/hr/payrollProfile.repository.ts", import.meta.url), "utf8");
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  module, exports: module.exports, require: name => name.endsWith("/db.js") ? db :
    name.endsWith("/sync.repository.js") ? { addToSyncQueue: async item => {
      sql.prepare("INSERT INTO sync_queue (companyId,entity,entityId,payload,synced) VALUES (?,?,?,?,0)")
        .run(item.companyId,item.entity,item.entityId,item.payload);
    } } : {},
});
try {
  sql.exec(`CREATE TABLE payroll_employee_profiles (companyId TEXT, _id TEXT, serverVersion INTEGER, updatedAt TEXT, synced INTEGER, lastSyncedAt TEXT);
    CREATE TABLE sync_queue (_id INTEGER PRIMARY KEY, companyId TEXT, entity TEXT, entityId TEXT, payload TEXT, synced INTEGER);
    INSERT INTO payroll_employee_profiles VALUES ('a','p',4,'later',0,NULL),('b','p',4,'later',0,NULL);`);
  const snapshot = { _id: "p", companyId: "a", serverVersion: 4, updatedAt: "first", value: 100 };
  const insert = sql.prepare("INSERT INTO sync_queue VALUES (?,?,'payroll_profile','p',?,0)");
  insert.run(1, "a", JSON.stringify(snapshot));
  insert.run(2, "a", JSON.stringify({ ...snapshot, updatedAt: "later", value: 200 }));
  insert.run(3, "b", JSON.stringify({ ...snapshot, companyId: "b" }));
  await module.exports.acknowledgePayrollProfile("a", snapshot, "1", 5);
  const next = JSON.parse(sql.prepare("SELECT payload FROM sync_queue WHERE _id=2").get().payload);
  assert.equal(next.serverVersion, 5);
  assert.equal(next.value, 200);
  assert.equal(sql.prepare("SELECT synced FROM payroll_employee_profiles WHERE companyId='a'").get().synced, 0);
  assert.equal(sql.prepare("SELECT serverVersion FROM payroll_employee_profiles WHERE companyId='b'").get().serverVersion, 4);
  assert.equal(sql.prepare("SELECT synced FROM sync_queue WHERE _id=1").get().synced, 1);
  await module.exports.acknowledgePayrollProfile("a", next, "2", 6);
  const local = sql.prepare("SELECT * FROM payroll_employee_profiles WHERE companyId='a'").get();
  assert.equal(local.serverVersion, 6);
  assert.equal(local.synced, 1);
  await assert.rejects(() => module.exports.acknowledgePayrollProfile("a", next, "2", undefined));
  sql.exec("ALTER TABLE payroll_employee_profiles ADD COLUMN isDeleted INTEGER DEFAULT 0");
  sql.exec("UPDATE payroll_employee_profiles SET synced=0,isDeleted=1 WHERE companyId='a'");
  await module.exports.recoverPayrollProfileQueue("a");
  await module.exports.recoverPayrollProfileQueue("a");
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM sync_queue WHERE companyId='a' AND synced=0").get().n, 1);
  const deletion = JSON.parse(sql.prepare("SELECT payload FROM sync_queue WHERE companyId='a' AND synced=0").get().payload);
  assert.equal(await module.exports.recoverPayrollProfileRevision("a", deletion, { ...next, serverVersion: 7, value: 999 }), false,
    "A real remote edit must never be overwritten by recovery");
  assert.equal(await module.exports.recoverPayrollProfileRevision("a", deletion, { ...next, serverVersion: 7 }), true);
  assert.equal(JSON.parse(sql.prepare("SELECT payload FROM sync_queue WHERE companyId='a' AND synced=0").get().payload).serverVersion, 7);
  const pushModule = { exports: {} };
  const sent = [];
  class Form {
    append(key, value) { this[key] = value; }
    getHeaders() { return {}; }
  }
  const pending = [1, 2].map(id => ({ _id: String(id), entity: "payroll_profile", entityId: "p",
    companyId: "a", operation: "update", payload: JSON.stringify(snapshot) }));
  const pushSource = fs.readFileSync(new URL("../src/electron/services/shared/sync/push.service.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(pushSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
    module: pushModule, exports: pushModule.exports, process: { env: {} },
    console: { log() {}, warn() {}, error() {} },
    require: name => {
      if (name === "electron") return { app: { isPackaged: false } };
      if (name === "form-data") return Form;
      if (name.endsWith("/InventorySync.js")) return { isInventorySyncEntity: () => false };
      if (name.endsWith("/auth.js")) return { getToken: async () => "token" };
      if (name.endsWith("/sync.repository.js")) return { getUnsyncedItems: async () => pending, markManySynced: async () => {} };
      if (name === "axios") return { post: async (_url, form) => {
        sent.push(...JSON.parse(form.items));
        return { data: { synced: [] } };
      } };
      return {};
    },
  });
  await pushModule.exports.pushPendingChanges("a");
  assert.equal(sent.length, 1, "Only the oldest profile edit can be sent before its acknowledgement");
  assert.equal(sent[0].queueId, "1");
  assert.equal(pending.length, 2, "Rejected edits remain queued");
  // Exercise the real pull repository with active-only uniqueness.
  sql.exec(`ALTER TABLE payroll_employee_profiles RENAME TO previous_profiles;
    CREATE TABLE payroll_employee_profiles (
      companyId TEXT, _id TEXT PRIMARY KEY, employeeId TEXT, componentId TEXT,
      accountNumber TEXT, name TEXT, displayName TEXT, displayOrder INTEGER,
      type TEXT, calculationType TEXT, value REAL, taxable INTEGER,
      requiresHRApproval INTEGER, enabled INTEGER, isOverridden INTEGER,
      createdAt TEXT, updatedAt TEXT, serverVersion INTEGER, synced INTEGER, isDeleted INTEGER);
    CREATE UNIQUE INDEX active_profiles ON payroll_employee_profiles(companyId,employeeId,componentId) WHERE isDeleted=0;`);
  const pulled = { companyId: "a", _id: "old", employeeId: "employee", componentId: "component",
    accountNumber: "cash", name: "SALARY", displayName: "Salary", displayOrder: 1,
    type: "EARNING", calculationType: "FIXE", value: 100, createdAt: "2026-10-01",
    updatedAt: "2026-10-12", serverVersion: 1, isDeleted: 1 };
  await module.exports.upsertEmployeePayrollProfile(pulled);
  await module.exports.upsertEmployeePayrollProfile({ ...pulled, _id: "deleted-again" });
  await module.exports.upsertEmployeePayrollProfile({ ...pulled, _id: "active", isDeleted: 0 });
  await assert.rejects(() => module.exports.upsertEmployeePayrollProfile({ ...pulled, _id: "conflict", isDeleted: 0 }), /PAYROLL_PROFILE_ID_CONFLICT/);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM payroll_employee_profiles").get().n, 3);
  console.log("Passed: chained payroll revisions, pending edit preservation, acknowledgement, and company isolation.");
} finally {
  sql.close();
}
