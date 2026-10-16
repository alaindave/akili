// Real SQLite and temporary files; no network or production data.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { Buffer } from "node:buffer";
import console from "node:console";
import { URL } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = await fs.mkdtemp(path.join(os.tmpdir(), "akili-document-deletion-"));
const directory = path.join(root, "documents");
await fs.mkdir(directory);
const sql = new DatabaseSync(":memory:");
let inTransaction = false;
const db = {
  get: async (query, args = []) => sql.prepare(query).get(...args),
  all: async (query, args = []) => sql.prepare(query).all(...args),
  run: async (query, args = []) => sql.prepare(query).run(...args),
  transaction: async callback => {
    if (inTransaction) return callback();
    sql.exec("BEGIN");
    inTransaction = true;
    try { const result = await callback(); sql.exec("COMMIT"); return result; }
    catch (error) { sql.exec("ROLLBACK"); throw error; }
    finally { inTransaction = false; }
  },
};
const modules = {};
async function load(relative, extra = "") {
  const source = await fs.readFile(new URL(relative, import.meta.url), "utf8");
  const code = ts.transpileModule(source + extra, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Buffer, console, process: { env: {} },
    require: name => {
      const key = name.split("/").at(-1);
      if (key === "db.js") return db;
      if (key === "directories.js") return { getEmployeeDocumentsDir: () => directory };
      if (key === "companyStorage.js") return { requireCompanyStorage: () => ({ companyId: "a" }) };
      if (key === "employeeMediaLock.js") return { withEmployeeMedia: async (_id, task) => task() };
      if (key === "sync.repository.js") return { addToSyncQueue: () => { throw new Error("Pull must not enqueue writes"); } };
      if (key in modules) return modules[key];
      if (name === "electron") return { app: { isPackaged: false } };
      return name.startsWith(".") ? {} : require(name);
    },
  });
  return exports;
}

try {
  sql.exec(`CREATE TABLE employees_documents (
    _id TEXT PRIMARY KEY, companyId TEXT, employeeId TEXT, documentType TEXT,
    localPath TEXT, needsUpload INTEGER, isDeleted INTEGER, serverVersion INTEGER,
    updatedAt TEXT, lastSyncedAt TEXT);
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);`);
  const documents = await load("../src/electron/database/repositories/modules/hr/employeesDocuments.repository.ts");
  modules["employeesDocuments.repository.js"] = documents;
  modules["employeeDocumentLayout.repository.js"] = await load("../src/electron/database/repositories/shared/employeeDocumentLayout.repository.ts");
  const storage = await load("../src/electron/services/shared/employeeDocumentStorage.service.ts");
  modules["employeeDocumentStorage.service.js"] = storage;
  const downloaded = [];
  modules["employees.repository.js"] = { getEmployeeById: async () => ({ _id: "employee" }) };
  modules["downloadEmployeeDocument.util.js"] = {
    downloadEmployeeDocument: async (_employee, document) => downloaded.push(document._id),
  };
  const pull = await load("../src/electron/services/shared/sync/pull.service.ts", "\nexport { syncEmployeeDocuments };\n");
  const insert = (id, localPath, pending = 0, version = 1, companyId = "a") =>
    sql.prepare("INSERT INTO employees_documents VALUES (?, ?, 'employee', 'NATIONAL_ID', ?, ?, 0, ?, 'old', NULL)")
      .run(id, companyId, localPath, pending, version);
  const tombstone = id => ({ _id: id, companyId: "a", employeeId: "employee",
    documentType: "NATIONAL_ID", isDeleted: 1, serverVersion: 3, updatedAt: "new" });

  insert("old", "shared.pdf");
  insert("replacement", "shared.pdf");
  await fs.writeFile(path.join(directory, "shared.pdf"), "replacement bytes");
  await pull.syncEmployeeDocuments([tombstone("old")]);
  await storage.cleanupEmployeeDocuments();
  assert.equal((await documents.getEmployeeDocumentById("a", "old")).isDeleted, 1);
  assert.equal((await documents.getEmployeeDocumentById("a", "replacement")).isDeleted, 0);
  assert.equal(await fs.readFile(path.join(directory, "shared.pdf"), "utf8"), "replacement bytes");
  await pull.syncEmployeeDocuments([tombstone("never-local")]);
  assert.equal(await documents.getEmployeeDocumentById("a", "never-local"), undefined);

  insert("missing-file", "missing.pdf");
  await pull.syncEmployeeDocuments([tombstone("missing-file")]);
  assert.equal((await documents.getEmployeeDocumentById("a", "missing-file")).serverVersion, 3);
  insert("pending", "pending.pdf", 1);
  await fs.writeFile(path.join(directory, "pending.pdf"), "pending bytes");
  await assert.rejects(pull.syncEmployeeDocuments([tombstone("pending")]), /pending local changes/);
  assert.equal((await documents.getEmployeeDocumentById("a", "pending")).needsUpload, 1);
  insert("newer", "newer.pdf", 0, 9);
  await pull.syncEmployeeDocuments([tombstone("newer")]);
  assert.equal((await documents.getEmployeeDocumentById("a", "newer")).isDeleted, 0);
  await pull.syncEmployeeDocuments([{ ...tombstone("new-upload"), isDeleted: 0 }]);
  assert.deepEqual(downloaded, ["new-upload"], "Another document's version must not suppress a replacement download");
  insert("foreign", "foreign.pdf", 0, 1, "b");
  await pull.syncEmployeeDocuments([tombstone("foreign")]);
  assert.equal((await documents.getEmployeeDocumentById("b", "foreign")).isDeleted, 0);
  await assert.rejects(storage.importEmployeeDocumentDeletion({ ...tombstone("foreign"), companyId: "b" }), /company mismatch/);

  insert("rollback", "rollback.pdf");
  await fs.writeFile(path.join(directory, "rollback.pdf"), "original bytes");
  await assert.rejects(db.transaction(async () => {
    await pull.syncEmployeeDocuments([tombstone("rollback")]);
    throw new Error("simulated commit failure");
  }), /commit failure/);
  await storage.cleanupEmployeeDocuments();
  assert.equal((await documents.getEmployeeDocumentById("a", "rollback")).isDeleted, 0);
  assert.equal(await fs.readFile(path.join(directory, "rollback.pdf"), "utf8"), "original bytes");
  await pull.syncEmployeeDocuments([tombstone("rollback")]);
  await storage.cleanupEmployeeDocuments();
  await assert.rejects(fs.stat(path.join(directory, "rollback.pdf")), { code: "ENOENT" });
  await pull.syncEmployeeDocuments([tombstone("rollback")]);
  assert.equal(await fs.readFile(path.join(directory, "pending.pdf"), "utf8"), "pending bytes");
  console.log("Passed: deletion without localPath, replacement file protection, missing records/files, pending changes, stale versions, tenant isolation, rollback, cleanup and retry.");
} finally {
  sql.close();
  await fs.rm(root, { recursive: true, force: true });
}
