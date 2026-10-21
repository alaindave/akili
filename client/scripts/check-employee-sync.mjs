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
    process: { env: {} }, console: { log() {}, warn() {}, error() {} } });
  return module.exports;
}
const repo = load("../src/electron/database/repositories/modules/hr/employees.repository.ts",
  name => name.endsWith("/db.js") ? db : {});
const base = { companyId: "a", _id: "employee", serverVersion: 4,
  firstName: "Alice", lastName: "Original", matricule: "1", idNum: "2",
  dateBirth: "1990-01-01", dateHired: "2020-01-01", role: "Worker",
  department: "Atelier", salary: 100, accountNumber: "cash", remainingLeave: 20,
  status: "ACTIF", telephone: "123", address: "Address", emergencyContact: "Bob",
  relationship: "Sibling", contactPhone: "456", isDeleted: 0,
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" };
const nameUpdate = { ...base, lastName: "Updated", updatedAt: "2026-10-02T00:00:00.000Z" };
const deletion = { ...nameUpdate, isDeleted: 1, updatedAt: "2026-10-03T00:00:00.000Z" };
try {
  sql.exec(`CREATE TABLE employees (companyId TEXT, _id TEXT, serverVersion INTEGER,
    updatedAt TEXT, synced INTEGER, isDeleted INTEGER, lastSyncedAt TEXT);
    CREATE TABLE sync_queue (_id INTEGER PRIMARY KEY, companyId TEXT, entity TEXT,
    entityId TEXT, operation TEXT, payload TEXT, synced INTEGER);
    INSERT INTO employees VALUES ('a','employee',4,'2026-10-03T00:00:00.000Z',0,1,NULL),
    ('b','employee',4,'2026-10-03T00:00:00.000Z',0,1,NULL);`);
  const insert = (id, payload, operation, synced = 0) => sql.prepare(
    "INSERT INTO sync_queue VALUES (?,?,'employee','employee',?,?,?)"
  ).run(id, payload.companyId, operation, JSON.stringify(payload), synced);
  const payload = id => JSON.parse(sql.prepare("SELECT payload FROM sync_queue WHERE _id=?").get(id).payload);
  const local = () => sql.prepare("SELECT * FROM employees WHERE companyId='a'").get();
  insert(1, base, "create", 1);
  insert(2, nameUpdate, "update");
  insert(3, deletion, "delete");
  insert(4, { ...deletion, companyId: "b" }, "delete");
  await repo.acknowledgeEmployee("a", nameUpdate, "2", 5);
  assert.equal(payload(3).serverVersion, 5, "An in-flight deletion receives the name update revision");
  assert.equal(payload(3).isDeleted, 1);
  assert.equal(local().synced, 0);
  assert.equal(local().isDeleted, 1);
  assert.equal(payload(4).serverVersion, 4, "Other companies remain untouched");
  await repo.acknowledgeEmployee("a", payload(3), "3", 6);
  assert.equal(local().serverVersion, 6);
  assert.equal(local().synced, 1);
  assert.equal(local().isDeleted, 1);
  await assert.rejects(() => repo.acknowledgeEmployee("a", deletion, "3", undefined));
  await assert.rejects(() => repo.acknowledgeEmployee("b", deletion, "3", 7));
  await assert.rejects(() => repo.acknowledgeEmployee("a", { ...deletion, serverVersion: 8 }, "3", 7));

  // Reproduce a previously accepted name update whose version was never saved.
  sql.exec("DELETE FROM sync_queue WHERE _id=3; UPDATE employees SET serverVersion=4,synced=0 WHERE companyId='a'");
  insert(3, deletion, "delete");
  const remote = { ...base, ...nameUpdate, dateBirth: "1990-01-01T00:00:00.000Z",
    dateHired: "2020-01-01T00:00:00.000Z", serverVersion: 5 };
  assert.equal(await repo.recoverEmployeeRevision("a", deletion, { ...remote, firstName: "Remote edit" }), false);
  assert.equal(await repo.recoverEmployeeRevision("a", deletion, { ...remote, companyId: "b" }), false);
  assert.equal(await repo.recoverEmployeeRevision("a", deletion, { ...remote, updatedAt: deletion.updatedAt }), false);
  assert.equal(payload(3).serverVersion, 4, "Genuine conflicts stay pending");
  assert.equal(await repo.recoverEmployeeRevision("a", deletion, remote), true);
  assert.equal(payload(3).serverVersion, 5);
  assert.equal(local().isDeleted, 1);
  assert.equal(local().synced, 0);
  sql.exec("DELETE FROM sync_queue WHERE synced=1");
  assert.equal(await repo.recoverEmployeeRevision("a", deletion, remote), false,
    "Missing history cannot prove the server record");

  // A stale dirty flag may be repaired only with an exact accepted snapshot.
  const columns = new Set(sql.prepare("PRAGMA table_info(employees)").all().map(row => row.name));
  for (const [key, value] of Object.entries(base)) {
    if (!columns.has(key)) sql.exec(`ALTER TABLE employees ADD COLUMN ${key} ${typeof value === "number" ? "INTEGER" : "TEXT"}`);
  }
  sql.exec("DELETE FROM sync_queue; DELETE FROM employees");
  const keys = Object.keys(base);
  sql.prepare(`INSERT INTO employees (${keys.join(",")},synced) VALUES (${keys.map(() => "?").join(",")},0)`)
    .run(...Object.values(base));
  insert(20, base, "update", 1);
  await repo.upsertEmployee({ ...base, serverVersion: 5 });
  assert.equal(local().synced, 1, "Exact acknowledged snapshot repairs stale dirty flag");
  assert.equal(local().serverVersion, 5);
  sql.exec("UPDATE employees SET synced=0,firstName='Unsaved edit'");
  await assert.rejects(() => repo.upsertEmployee({ ...base, serverVersion: 6 }), /unsynced local changes/);
  assert.equal(local().firstName, "Unsaved edit", "Unqueued edits must never be overwritten");
  sql.prepare("UPDATE employees SET firstName=?").run(base.firstName);
  insert(21, base, "update");
  await assert.rejects(() => repo.upsertEmployee({ ...base, serverVersion: 6 }), /unsynced local changes/);
  sql.exec("DELETE FROM sync_queue; DELETE FROM employees");
  await repo.upsertEmployee({ ...base, serverVersion: 6 });
  assert.equal(local().synced, 1, "Server imports are immediately marked synced");

  // The real push service must send only one revision per employee, and acknowledge
  // it even when a later deletion is still pending.
  const sent = [];
  const acknowledged = [];
  const recovered = [];
  const pending = [nameUpdate, deletion].map((item, index) => ({ _id: String(index + 10),
    companyId: "a", entity: "employee", entityId: "employee", operation: index ? "delete" : "update",
    payload: JSON.stringify(item) }));
  class Form { append(key, value) { this[key] = value; } getHeaders() { return {}; } }
  let conflict = false;
  const push = load("../src/electron/services/shared/sync/push.service.ts", name => {
    if (name === "electron") return { app: { isPackaged: false } };
    if (name === "form-data") return Form;
    if (name.endsWith("/InventorySync.js")) return { isInventorySyncEntity: () => false };
    if (name.endsWith("/auth.js")) return { getToken: async () => "token" };
    if (name.endsWith("/sync.repository.js")) return {
      getUnsyncedItems: async () => pending, markManySynced: async () => {},
    };
    if (name.endsWith("/employees.repository.js")) return {
      acknowledgeEmployee: async (...args) => acknowledged.push(args),
      recoverEmployeeRevision: async (...args) => recovered.push(args),
    };
    if (name === "axios") return { post: async (_url, form) => {
      sent.push(...JSON.parse(form.items));
      return { data: conflict ? { synced: [], failed: [{ queueId: "10", code: "REVISION_CONFLICT", details: { remote } }] }
        : { synced: ["10"], versions: { "10": 5 } } };
    } };
    return {};
  });
  await push.pushPendingChanges("a");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].queueId, "10");
  assert.equal(acknowledged.length, 1);
  assert.equal(acknowledged[0][3], 5);
  conflict = true;
  await push.pushPendingChanges("a");
  assert.equal(recovered.length, 1);
  console.log("Passed: employee revision chaining, deletion preservation, guarded conflict recovery, company isolation, and push ordering.");
} finally { sql.close(); }
