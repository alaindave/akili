import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { DatabaseSync } from "node:sqlite";
import { URL } from "node:url";
import console from "node:console";
import ts from "typescript";

const sql = new DatabaseSync(":memory:");
const db = {
  all: async (query, values) => sql.prepare(query).all(...values),
  run: async (query, values) => sql.prepare(query).run(...values),
  transaction: async callback => {
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
const repo = load("../src/electron/database/repositories/modules/hr/leaves.repository.ts",
  name => name.endsWith("/db.js") ? db : {});
const base = { companyId: "a", _id: "leave", employeeId: "employee", serverVersion: 4,
  submittedAt: "2026-10-01T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z", submittedMonth: "2026-10",
  startDate: "2026-10-20", endDate: "2026-10-21", subject: "Leave", notes: "Reason",
  additionalNotes: "", status: "ATTENTE_APPROBATION", isDeleted: 0 };
const cancellation = { companyId: "a", _id: "leave", employeeId: "employee",
  serverVersion: 4, status: "ANNULÉ", updatedAt: "2026-10-02T00:00:00.000Z" };
const deletion = { ...cancellation, isDeleted: 1, updatedAt: "2026-10-03T00:00:00.000Z" };
try {
  sql.exec(`CREATE TABLE leaves (companyId TEXT, _id TEXT, serverVersion INTEGER,
    updatedAt TEXT, synced INTEGER, isDeleted INTEGER);
    CREATE TABLE sync_queue (_id INTEGER PRIMARY KEY, companyId TEXT, entity TEXT,
    entityId TEXT, operation TEXT, payload TEXT, synced INTEGER);
    INSERT INTO leaves VALUES ('a','leave',4,'2026-10-03T00:00:00.000Z',0,1),
    ('b','leave',4,'2026-10-03T00:00:00.000Z',0,1);`);
  const insert = (id, payload, operation, synced = 0) => sql.prepare(
    "INSERT INTO sync_queue VALUES (?,?,'leave','leave',?,?,?)"
  ).run(id, payload.companyId, operation, JSON.stringify(payload), synced);
  const payload = id => JSON.parse(sql.prepare("SELECT payload FROM sync_queue WHERE _id=?").get(id).payload);
  const local = () => sql.prepare("SELECT * FROM leaves WHERE companyId='a'").get();
  insert(1, base, "create", 1);
  insert(2, cancellation, "update");
  insert(3, deletion, "delete");
  insert(4, { ...deletion, companyId: "b" }, "delete");
  await repo.acknowledgeLeave("a", cancellation, "2", 5);
  assert.equal(payload(3).serverVersion, 5, "An in-flight deletion receives the cancellation revision");
  assert.equal(payload(3).isDeleted, 1);
  assert.equal(local().synced, 0);
  assert.equal(local().isDeleted, 1);
  assert.equal(payload(4).serverVersion, 4, "Other companies remain untouched");
  await repo.acknowledgeLeave("a", payload(3), "3", 6);
  assert.equal(local().serverVersion, 6);
  assert.equal(local().synced, 1);
  assert.equal(local().isDeleted, 1);
  await assert.rejects(() => repo.acknowledgeLeave("a", deletion, "3", undefined));
  await assert.rejects(() => repo.acknowledgeLeave("b", deletion, "3", 7));

  // Reproduce a previously accepted cancellation whose version was never saved.
  sql.exec("DELETE FROM sync_queue WHERE _id=3; UPDATE leaves SET serverVersion=4,synced=0 WHERE companyId='a'");
  insert(3, deletion, "delete");
  const remote = { ...base, ...cancellation, serverVersion: 5 };
  assert.equal(await repo.recoverLeaveRevision("a", deletion, { ...remote, notes: "Remote edit" }), false);
  assert.equal(await repo.recoverLeaveRevision("a", deletion, { ...remote, companyId: "b" }), false);
  assert.equal(await repo.recoverLeaveRevision("a", deletion, { ...remote, updatedAt: deletion.updatedAt }), false);
  assert.equal(payload(3).serverVersion, 4, "Genuine conflicts stay pending");
  assert.equal(await repo.recoverLeaveRevision("a", deletion, remote), true);
  assert.equal(payload(3).serverVersion, 5);
  assert.equal(local().isDeleted, 1);
  assert.equal(local().synced, 0);
  sql.exec("DELETE FROM sync_queue WHERE _id=1");
  assert.equal(await repo.recoverLeaveRevision("a", deletion, remote), false,
    "Partial cancellation history alone cannot prove the full server record");

  // The real push service must send only one revision per leave, and acknowledge
  // it even when a later deletion is still pending.
  const sent = [];
  const acknowledged = [];
  const recovered = [];
  const pending = [cancellation, deletion].map((item, index) => ({ _id: String(index + 10),
    companyId: "a", entity: "leave", entityId: "leave", operation: index ? "delete" : "update",
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
    if (name.endsWith("/leaves.repository.js")) return {
      acknowledgeLeave: async (...args) => acknowledged.push(args),
      recoverLeaveRevision: async (...args) => recovered.push(args),
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
  console.log("Passed: leave revision chaining, deletion preservation, guarded conflict recovery, company isolation, and push ordering.");
} finally { sql.close(); }
