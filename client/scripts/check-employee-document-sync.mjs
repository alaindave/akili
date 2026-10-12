// Node 22+: real SQLite/files and server document validation; no network access.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import console from "node:console";

const root = fileURLToPath(new URL("../../", import.meta.url));
const serverRequire = createRequire(path.join(root, "server/package.json"));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "akili-document-sync-"));
const sql = new DatabaseSync(":memory:");
const db = {
  run: async (query, values = []) => sql.prepare(query).run(...values),
  get: async (query, values = []) => sql.prepare(query).get(...values),
  all: async (query, values = []) => sql.prepare(query).all(...values),
  transaction: async callback => {
    sql.exec("BEGIN");
    try { const result = await callback(); sql.exec("COMMIT"); return result; }
    catch (error) { sql.exec("ROLLBACK"); throw error; }
  },
};
let queued = [];
let nextId = 0;
const queue = {
  addToSyncQueue: async item => queued.push({ ...item, _id: String(++nextId) }),
  getUnsyncedItems: async companyId => queued.filter(item => item.companyId === companyId),
  markManySynced: async (companyId, ids) => {
    queued = queued.filter(item => item.companyId !== companyId || !ids.includes(item._id));
  },
};
function load(file, overrides = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, Buffer, Date, Error,
    process: { env: { VITE_API_URL: "http://test" } },
    console: { log() {}, warn() {}, error() {} },
    require: name => {
      const key = name.split("/").at(-1);
      if (key in overrides) return overrides[key];
      if (key === "db.js") return db;
      if (key === "sync.repository.js") return queue;
      if (key === "directories.js") return { getEmployeeDocumentsDir: () => directory };
      if (key === "auth.js") return { getToken: async () => "token" };
      if (key === "InventorySync.js") return { isInventorySyncEntity: () => false };
      if (name === "electron") return { app: { isPackaged: false } };
      return name.startsWith(".") ? {} : serverRequire(name);
    },
  });
  return module.exports;
}

try {
  sql.exec(`CREATE TABLE employees (_id TEXT PRIMARY KEY);
    CREATE TABLE admin_users (_id TEXT PRIMARY KEY);
    INSERT INTO employees VALUES ('employee');
    INSERT INTO admin_users VALUES ('admin');`);
  const prefix = "client/src/electron/";
  const schema = load(prefix + "database/schemas/modules/hr/employees_documents.schema.ts");
  await schema.createEmployeesDocumentsTable();
  const documents = load(prefix + "database/repositories/modules/hr/employeesDocuments.repository.ts");
  const file = { companyId: "a", employeeId: "employee", uploadedBy: "admin",
    documentType: "NATIONAL_ID", name: "id.pdf", mimeType: "application/pdf", buffer: Buffer.from("document") };
  const document = await documents.uploadEmployeeDocument(file);
  assert.equal(queued[0].operation, "create", "First upload must create its server record");
  assert.equal(queued[0].entityId, document._id);

  const Model = load("server/models/modules/hr/employeesDocuments.model.ts").default;
  let stored;
  let version = 0;
  Model.findOne = filter => ({ lean: async () => stored?.companyId === filter.companyId && stored?._id === filter._id ? stored : null });
  Model.updateOne = async (_filter, update) => {
    stored = new Model({ ...update.$setOnInsert, ...update.$set }).toObject();
    return { matchedCount: 1, upsertedCount: 1 };
  };
  const server = load("server/sync.ts", {
    "employeesDocuments.model.js": Model,
    "employee.model.js": { findOne: async filter => filter.companyId === "a" ? { _id: "employee" } : null },
    "supabase.service.js": { storage: { from: () => ({ upload: async () => ({}) }) } },
    "syncVersion.js": { getNextSyncVersion: async () => ++version },
  });
  const attachment = { buffer: file.buffer, originalname: document.fileName, mimetype: file.mimeType };
  await assert.rejects(() => server.syncEmployeeDocument("update", document, attachment), error => error.code === "MISSING_RECORD");

  // Reproduce an already-persisted entry from the old client.
  queued[0].operation = "update";
  const originalPayload = queued[0].payload;
  let acknowledge = false;
  class Form {
    append(key, value) { this[key] = value; }
    getHeaders() { return {}; }
  }
  const push = load(prefix + "services/shared/sync/push.service.ts", {
    "employeesDocuments.repository.js": documents,
    "form-data": Form,
    fs: { existsSync: fs.existsSync, createReadStream: filename => filename },
    axios: { post: async (_url, form) => {
      const [item] = JSON.parse(form.items);
      assert.equal(item.operation, "create");
      await server.syncEmployeeDocument(item.operation, item.data, attachment);
      return { data: { synced: acknowledge ? [item.queueId] : [] } };
    } },
  });
  await push.pushPendingChanges("a");
  assert.equal(queued.length, 1, "Unacknowledged uploads remain queued");
  assert.equal(queued[0].payload, originalPayload);
  assert.equal(queued[0].operation, "update", "Repair must not rewrite durable snapshots");
  const firstVersion = stored.serverVersion;
  acknowledge = true;
  await push.pushPendingChanges("a");
  assert.equal(queued.length, 0);
  assert.equal(stored.serverVersion, firstVersion, "Retry of accepted create must be idempotent");
  await documents.upsertEmployeeDocument({ ...document, serverVersion: firstVersion, needsUpload: 0 });
  const replacement = await documents.uploadEmployeeDocument({ ...file, buffer: Buffer.from("replacement") });
  assert.equal(replacement.serverVersion, firstVersion, "Replacement must retain the known server revision");
  assert.equal(queued[0].operation, "update");
  assert.equal(replacement._id, document._id);

  const operations = [];
  const inspectPush = load(prefix + "services/shared/sync/push.service.ts", {
    "employeesDocuments.repository.js": documents,
    "form-data": Form,
    fs: { existsSync: () => false },
    axios: { post: async (_url, form) => {
      operations.push(...JSON.parse(form.items).map(item => item.operation));
      return { data: { synced: [] } };
    } },
  });
  await inspectPush.pushPendingChanges("a");
  assert.deepEqual(operations, ["update"], "Versioned updates must stay updates");
  queued = [{ ...queued[0], operation: "delete", payload: JSON.stringify({ ...replacement, serverVersion: 0, isDeleted: 1 }) }];
  operations.length = 0;
  await inspectPush.pushPendingChanges("a");
  assert.deepEqual(operations, ["delete"], "Deletes must never be converted to creates");
  await assert.rejects(() => server.syncEmployeeDocument("create", { ...document, originalName: "conflicting.pdf" }, attachment), error => error.code === "REVISION_CONFLICT");
  console.log("Passed: document creation, legacy queue recovery, idempotent retry, versioned replacement, deletion, and conflict protection.");
} finally {
  sql.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
