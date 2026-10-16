// Node 22+: exercise the migration with real SQLite and temporary media files.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import console from "node:console";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(relative, stubs) {
  const exports = {};
  const source = await fs.readFile(new URL(relative, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, Buffer, require: name => name in stubs ? stubs[name] : require(name) });
  return exports;
}

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "akili-media-layout-"));
const databases = [];
async function fixture(name) {
  const root = path.join(temporary, name, "files");
  for (const kind of ["company_logo", "employees_documents", "employees_photos"]) await fs.mkdir(path.join(root, kind), { recursive: true });
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  database.exec(`
    CREATE TABLE companies (_id TEXT, companyId TEXT, logoPath TEXT, serverVersion INTEGER DEFAULT 7);
    CREATE TABLE employees (_id TEXT, companyId TEXT, photo_path TEXT, photo_needs_upload INTEGER DEFAULT 1);
    CREATE TABLE employees_documents (_id TEXT, companyId TEXT, localPath TEXT, needsUpload INTEGER DEFAULT 1);
    CREATE TABLE sync_queue (_id INTEGER PRIMARY KEY, companyId TEXT, entity TEXT, payload TEXT, synced INTEGER DEFAULT 0);
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO companies VALUES ('a','a','company_logo/a/logo.png',7);
    INSERT INTO companies VALUES ('b','b','company_logo/b/logo.png',8);
    INSERT INTO employees VALUES ('e','a','a/e/photo.png',1);
    INSERT INTO employees_documents VALUES ('d','a','a/e/doc.pdf',1);
  `);
  for (const [entity, field, value] of [
    ["company", "logoPath", "company_logo/a/logo.png"],
    ["company_logo", "logoPath", "company_logo/a/logo.png"],
    ["employee", "photo_path", "a/e/photo.png"],
    ["employee_photo", "photo_path", "a/e/photo.png"],
    ["employee_document", "localPath", "a/e/doc.pdf"],
  ]) database.prepare("INSERT INTO sync_queue (companyId, entity, payload) VALUES ('a',?,?)")
    .run(entity, JSON.stringify({ [field]: value, companyId: "a", serverVersion: 7 }));
  const db = {
    get: async (sql, args = []) => database.prepare(sql).get(...args) ?? null,
    all: async (sql, args = []) => database.prepare(sql).all(...args),
    run: async (sql, args = []) => database.prepare(sql).run(...args),
    transaction: async callback => {
      database.exec("BEGIN");
      try { const result = await callback(); database.exec("COMMIT"); return result; }
      catch (error) { database.exec("ROLLBACK"); throw error; }
    },
  };
  const storage = {
    getCompanyFilesRoot: () => root,
    requireCompanyStorage: () => ({ companyId: "a" }),
    validateStorageCompany: id => { assert.equal(id, "a"); },
  };
  const repository = await load("../src/electron/database/repositories/shared/mediaLayout.repository.ts", { "../../db.js": db });
  let failCleanup = false;
  let failCommit = false;
  const service = await load("../src/electron/services/shared/mediaLayout.service.ts", {
    "../../storage/companyStorage.js": storage,
    "../../database/repositories/shared/mediaLayout.repository.js": {
      ...repository,
      migrateMediaLayoutPaths: async (...args) => {
        if (failCommit) throw new Error("simulated commit failure");
        return repository.migrateMediaLayoutPaths(...args);
      },
    },
    "node:fs/promises": { ...fs, unlink: async file => {
      if (failCleanup) throw new Error("simulated cleanup failure");
      return fs.unlink(file);
    } },
  });
  const files = ["company_logo/a/logo.png", "employees_photos/a/e/photo.png", "employees_documents/a/e/doc.pdf"];
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), file);
  }
  return { root, database, db, repository, service, storage, files,
    setCleanupFailure: value => { failCleanup = value; },
    setCommitFailure: value => { failCommit = value; } };
}

try {
  const f = await fixture("normal");
  await f.service.migrateMediaLayout();
  for (const file of f.files) {
    const target = file.replace("/a/", "/");
    assert.equal(await fs.readFile(path.join(f.root, target), "utf8"), file);
    await assert.rejects(fs.stat(path.join(f.root, file)), { code: "ENOENT" });
  }
  assert.equal((await f.db.get("SELECT logoPath FROM companies WHERE companyId = 'a'")).logoPath, "company_logo/logo.png");
  assert.equal((await f.db.get("SELECT logoPath FROM companies WHERE companyId = 'b'")).logoPath, "company_logo/b/logo.png");
  assert.equal((await f.db.get("SELECT photo_path FROM employees")).photo_path, "e/photo.png");
  assert.equal((await f.db.get("SELECT localPath FROM employees_documents")).localPath, "e/doc.pdf");
  assert.equal((await f.db.get("SELECT needsUpload FROM employees_documents")).needsUpload, 1);
  assert.equal((await f.db.get("SELECT serverVersion FROM companies WHERE companyId = 'a'")).serverVersion, 7);
  for (const row of await f.db.all("SELECT * FROM sync_queue")) {
    const payload = JSON.parse(row.payload);
    const field = row.entity.startsWith("company") ? "logoPath" : row.entity === "employee_document" ? "localPath" : "photo_path";
    assert.ok(!payload[field].includes("a/"));
    assert.equal(row.synced, 0);
    assert.equal(payload.serverVersion, 7);
  }
  const before = JSON.stringify(await f.db.all("SELECT * FROM sync_queue"));
  await f.service.migrateMediaLayout();
  assert.equal(JSON.stringify(await f.db.all("SELECT * FROM sync_queue")), before);

  const conflict = await fixture("conflict");
  await fs.writeFile(path.join(conflict.root, "company_logo/logo.png"), "different image");
  await assert.rejects(conflict.service.migrateMediaLayout(), /Conflicting media/);
  assert.equal(await conflict.repository.getMediaLayoutMigration(), null);
  assert.equal(await fs.readFile(path.join(conflict.root, "company_logo/a/logo.png"), "utf8"), "company_logo/a/logo.png");

  const metadata = await fixture("finder-metadata");
  for (const directory of ["company_logo", "employees_photos", "employees_documents", "employees_documents/e"]) {
    const source = path.join(metadata.root, directory.replace(/^(\w+)/, "$1/a"), ".DS_Store");
    const target = path.join(metadata.root, directory, ".DS_Store");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(source, "legacy metadata");
    await fs.writeFile(target, "current metadata");
  }
  await metadata.service.migrateMediaLayout();
  assert.equal((await metadata.repository.getMediaLayoutMigration()).length, 0);
  for (const file of metadata.files) {
    assert.equal(await fs.readFile(path.join(metadata.root, file.replace("/a/", "/")), "utf8"), file);
    await assert.rejects(fs.stat(path.join(metadata.root, file)), { code: "ENOENT" });
  }
  assert.equal(await fs.readFile(path.join(metadata.root, "employees_documents/.DS_Store"), "utf8"), "current metadata");
  assert.equal(await fs.readFile(path.join(metadata.root, "employees_documents/a/.DS_Store"), "utf8"), "legacy metadata");
  await metadata.service.migrateMediaLayout();

  const retry = await fixture("retry");
  retry.setCommitFailure(true);
  await assert.rejects(retry.service.migrateMediaLayout(), /commit failure/);
  assert.equal((await retry.db.get("SELECT localPath FROM employees_documents")).localPath, "a/e/doc.pdf");
  retry.setCommitFailure(false);
  retry.setCleanupFailure(true);
  await assert.rejects(retry.service.migrateMediaLayout(), /cleanup failure/);
  assert.equal((await retry.db.get("SELECT localPath FROM employees_documents")).localPath, "e/doc.pdf");
  assert.ok((await retry.repository.getMediaLayoutMigration()).length > 0);
  const journal = await retry.repository.getMediaLayoutMigration();
  journal.push({ source: "employees_documents/a/.DS_Store", target: "employees_documents/.DS_Store" });
  await fs.writeFile(path.join(retry.root, "employees_documents/a/.DS_Store"), "changed metadata");
  await fs.writeFile(path.join(retry.root, "employees_documents/.DS_Store"), "original metadata");
  await retry.db.run("UPDATE app_settings SET value = ? WHERE key = 'storage.media-layout.v2'", [JSON.stringify(journal)]);
  retry.setCleanupFailure(false);
  await retry.service.migrateMediaLayout();
  assert.equal((await retry.repository.getMediaLayoutMigration()).length, 0);
  for (const file of retry.files) await assert.rejects(fs.stat(path.join(retry.root, file)), { code: "ENOENT" });
  assert.equal(await fs.readFile(path.join(retry.root, "employees_documents/a/.DS_Store"), "utf8"), "changed metadata");

  const rollback = await fixture("rollback");
  rollback.database.prepare("UPDATE sync_queue SET payload = 'invalid json' WHERE _id = 1").run();
  await assert.rejects(rollback.service.migrateMediaLayout());
  assert.equal((await rollback.db.get("SELECT localPath FROM employees_documents")).localPath, "a/e/doc.pdf");
  assert.equal(await rollback.repository.getMediaLayoutMigration(), null);

  const access = await load("../src/electron/services/shared/mediaFile.service.ts", {
    "../../storage/companyStorage.js": f.storage,
    "../../storage/directories.js": { getEmployeeDocumentsDir: () => path.join(f.root, "employees_documents") },
  });
  assert.equal(access.resolveEmployeeDocumentPath("a", "e/doc.pdf"), path.join(f.root, "employees_documents/e/doc.pdf"));
  for (const unsafe of ["../secret", "/etc/passwd", "C:\\secret", "e/../../secret"]) assert.throws(() => access.resolveEmployeeDocumentPath("a", unsafe));
  assert.throws(() => access.resolveEmployeeDocumentPath("b", "e/doc.pdf"));
  const directories = {
    getEmployeeDocumentsDir: () => path.join(f.root, "employees_documents"),
    getEmployeePhotoDir: () => path.join(f.root, "employees_photos"),
    getCompanyLogoDir: () => path.join(f.root, "company_logo"),
  };
  const employee = { companyId: "a", _id: "e", photo_version: 0 };
  const company = { companyId: "a", _id: "a", logoPath: "company_logo/logo.png" };
  const queued = [];
  const sync = { addToSyncQueue: async item => { queued.push(JSON.parse(item.payload)); } };
  const persistence = {
    get: async sql => sql.includes("FROM employees_documents") ? null : sql.includes("FROM companies") ? company : employee,
    run: async () => ({ changes: 1 }),
    transaction: async callback => callback(),
  };
  const photo = await load("../src/electron/database/repositories/modules/hr/employeesPhotos.repository.ts", {
    "../../../db.js": persistence,
    "../../../../storage/directories.js": directories,
    "../../../../storage/companyStorage.js": f.storage,
    "../../shared/sync.repository.js": sync,
  });
  await photo.uploadEmployeePhoto("a", "e", { name: "photo.png", buffer: Buffer.from("new photo") });
  assert.match(queued.at(-1).photo_path, /^e\//);
  assert.equal(await fs.readFile(path.join(directories.getEmployeePhotoDir(), queued.at(-1).photo_path), "utf8"), "new photo");
  const documents = await load("../src/electron/database/repositories/modules/hr/employeesDocuments.repository.ts", {
    "../../../db.js": persistence,
    "../../../../storage/directories.js": directories,
    "../../../../storage/companyStorage.js": f.storage,
    "../../shared/sync.repository.js": sync,
  });
  const document = await documents.uploadEmployeeDocument({ companyId: "a", employeeId: "e", name: "document.pdf",
    buffer: Buffer.from("new document"), documentType: "NATIONAL_ID", uploadedBy: "user" });
  assert.match(document.localPath, /^e\//);
  assert.equal(await fs.readFile(path.join(directories.getEmployeeDocumentsDir(), document.localPath), "utf8"), "new document");
  const logos = await load("../src/electron/database/repositories/shared/companies.repository.ts", {
    "../../db.js": persistence, "../../../storage/companyStorage.js": f.storage, "./sync.repository.js": sync,
  });
  assert.equal(await logos.updateLogo("a", "image/png", Buffer.from("new logo")), "company_logo/logo.png");
  await assert.rejects(logos.updateLogo("b", "image/png", Buffer.from("wrong company")));
  const downloadStubs = {
    electron: { app: { isPackaged: true } }, axios: { get: async () => ({ data: Buffer.from("download") }) },
    "../storage/directories.js": directories, "../storage/companyStorage.js": f.storage,
    "../database/repositories/shared/companies.repository.js": { getCompanyById: async () => company },
    "../database/repositories/modules/hr/employees.repository.js": { getEmployeeById: async () => employee },
  };
  const logoDownload = await load("../src/electron/util/downloadCompanyLogo.util.ts", downloadStubs);
  const photoDownload = await load("../src/electron/util/downloadEmployeePhoto.util.ts", downloadStubs);
  const documentDownload = await load("../src/electron/util/downloadEmployeeDocument.util.ts", downloadStubs);
  assert.equal(await logoDownload.downloadCompanyLogo("a", "image/png"), path.join(directories.getCompanyLogoDir(), "logo.png"));
  assert.equal(await photoDownload.downloadEmployeePhoto("a", "e", 2, "image/png"), path.join(directories.getEmployeePhotoDir(), "e/photo_v2.png"));
  assert.equal(await documentDownload.downloadEmployeeDocument(employee, document), path.join(directories.getEmployeeDocumentsDir(), "e", document.fileName));
  for (const directory of Object.values(directories)) await assert.rejects(fs.stat(path.join(directory(), "a")), { code: "ENOENT" });
  console.log("Passed: uploads and downloads for logos, documents and photos use the flat layout.");
  console.log("Passed: flattened files and SQLite paths, pending uploads, company isolation, idempotency, conflicts, commit/cleanup retry, transaction rollback, document access containment.");
} finally {
  for (const database of databases) database.close();
  await fs.rm(temporary, { recursive: true, force: true });
}
