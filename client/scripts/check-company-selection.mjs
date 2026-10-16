import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import console from "node:console";
import fs from "node:fs";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { URL } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(relative, stubs) {
  const module = { exports: {} };
  const source = fs.readFileSync(new URL(relative, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Buffer, console,
    require: (name) => name in stubs ? stubs[name] : require(name),
  });
  return module.exports;
}

const database = new DatabaseSync(":memory:");
const db = {
  run: async (sql, args = []) => database.prepare(sql).run(...args),
  get: async (sql, args = []) => database.prepare(sql).get(...args) ?? null,
  all: async (sql, args = []) => database.prepare(sql).all(...args),
  transaction: async (callback) => {
    database.exec("BEGIN");
    try { const value = await callback(); database.exec("COMMIT"); return value; }
    catch (error) { database.exec("ROLLBACK"); throw error; }
  },
};
const passwords = new Map();
const auth = load("../src/electron/auth.ts", { keytar: {
  getPassword: async (_, account) => passwords.get(account) ?? null,
  setPassword: async (_, account, value) => { passwords.set(account, value); },
  deletePassword: async (_, account) => passwords.delete(account),
} });
const companySchema = load("../src/electron/database/schemas/shared/companies.schema.ts", { "../../db.js": db });
await companySchema.createCompanyTable();
const companies = load("../src/electron/database/repositories/shared/companies.repository.ts", {
  "../../db.js": db, "./sync.repository.js": { addToSyncQueue: async () => {} },
  "../../../auth.js": auth, electron: { app: {} },
});
const company = (id, name) => ({ _id: id, companyId: id, name, legalName: name,
  address: `${id} address`, createdAt: "2026-10-14", updatedAt: "2026-10-14", serverVersion: 1, synced: 1, isDeleted: 0 });
const companyService = load("../src/electron/services/shared/company.service.ts", {
  "../../database/repositories/shared/companies.repository.js": companies, "../../auth.js": auth,
});
await companies.upsertCompanyId(company("a", "Alpha"));
await companies.upsertCompanyId(company("b", "Beta"));
await companies.upsertCompany({ ...company("b", "Beta updated"), serverVersion: 2 });
assert.equal((await companies.getCompanyById("a")).name, "Alpha");
assert.equal((await companies.getCompanyById("b")).name, "Beta updated");
assert.equal((await companies.getConfiguredCompanies()).length, 2);
await db.run("UPDATE companies SET isDeleted = 1 WHERE companyId = 'b'");
assert.equal((await companies.getConfiguredCompanies()).length, 1);
await db.run("UPDATE companies SET isDeleted = 0 WHERE companyId = 'b'");

// Preserve a legacy offline account while migrating its global email constraint.
database.exec(`CREATE TABLE offline_users (
  companyId TEXT NOT NULL, _id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL, role TEXT NOT NULL, firstName TEXT NOT NULL, lastName TEXT NOT NULL,
  notes TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, lastVerifiedAt DATETIME);
  INSERT INTO offline_users(companyId,_id,email,password,role,firstName,lastName)
  VALUES ('a','user-a','shared@example.com','hash','ADMIN','A','User');`);
const schema = load("../src/electron/database/schemas/shared/offline_users.schema.ts", { "../../db.js": db });
await schema.createOfflineUsersTable();
await schema.createOfflineUsersTable();
assert.equal((await db.get("SELECT * FROM offline_users WHERE _id = 'user-a'")).password, "hash");
const users = load("../src/electron/database/repositories/shared/offline_users.repository.ts", {
  "../../db.js": db, "./sync.repository.js": { addToSyncQueue: async () => {} },
});
await users.createOrUpdateOfflineUser({ companyId: "b", _id: "user-b", email: "shared@example.com",
  password: "other-hash", role: "ADMIN", firstName: "B", lastName: "User", notes: "", lastVerifiedAt: "2026-10-14" });
assert.equal((await users.getOfflineUserByEmail("shared@example.com", "a"))._id, "user-a");
assert.equal((await users.getOfflineUserByEmail("shared@example.com", "b"))._id, "user-b");
assert.equal(await users.getOfflineUserByEmail("shared@example.com"), null);

let startedCompany;
const sessions = load("../src/electron/services/shared/companySession.service.ts", {
  electron: { BrowserWindow: { getAllWindows: () => [] } }, "../../auth.js": auth,
  "../../database/repositories/shared/companies.repository.js": companies,
  "../../socket.js": { getSocket: () => null },
  "./sync/backgroundSync.service.js": { stopBackgroundSync() {}, startBackgroundSync: (id) => { startedCompany = id; } },
});
const token = (id) => `header.${Buffer.from(JSON.stringify({ companyId: id, _id: `user-${id}`, role: "ADMIN" })).toString("base64url")}.signature`;
await sessions.establishCompanySession({ companyId: "a", _id: "user-a", role: "ADMIN" }, token("a"));
assert.equal(await companyService.getCurrentCompanyId(), "a");
assert.equal(await auth.getToken("b"), null);
await assert.rejects(sessions.initializeAuthenticatedCompany(company("b", "Beta"), "a"));

const handlers = new Map();
load("../src/electron/ipc/shared/offline_users.ipc.ts", {
  electron: { ipcMain: { handle: (name, callback) => handlers.set(name, callback) } },
  bcrypt: { compare: async (password, hash) => password === "correct" && hash === "other-hash" },
  "../../services/shared/companySession.service.js": sessions,
  "../../database/repositories/shared/offline_users.repository.js": users,
}).registerOfflineUsersIPC();
const login = handlers.get("offline-users:login");
await assert.rejects(login(null, { email: "shared@example.com", password: "wrong", companyId: "b" }));
assert.equal(await auth.getActiveCompanyId(), "a");
await assert.rejects(login(null, { email: "shared@example.com", password: "correct", companyId: "a" }));
await login(null, { email: "shared@example.com", password: "correct", companyId: "b" });
assert.equal(await auth.getActiveCompanyId(), "b");
assert.equal(startedCompany, "b");
assert.equal(await auth.getToken(), null, "Offline switching clears the previous company's online token");
await assert.rejects(auth.requireLocalIdentity("a"));
assert.equal((await auth.requireLocalIdentity("b"))._id, "user-b");
await sessions.endCompanySession();
assert.equal(await companyService.getCurrentCompanyId(), null);
database.close();
// The server must authenticate the selected tenant when emails are shared.
let authenticate;
const admin = (id) => ({ _id: `user-${id}`, companyId: id, passwordHash: `hash-${id}`,
  generateAuthToken: () => token(id) });
load("../../server/routes/shared/authenticate.route.ts", {
  express: { Router: () => ({ post: (_path, handler) => { authenticate = handler; } }) },
  bcrypt: { compare: async (password, hash) => password === "correct-password" && hash === "hash-b" },
  joi: require("../../server/node_modules/joi"),
  "../../db.js": {
    getAdminUserByEmail: async (_email, id) => id === "a" || id === "b" ? admin(id) : null,
    getCompanyById: async (id) => company(id, id),
  },
});
const response = () => ({ code: 200, body: null,
  status(code) { this.code = code; return this; },
  set() { return this; }, header() { return this; },
  send(body) { this.body = body; return this; },
});
let res = response();
await authenticate({ body: { email: "shared@example.com", password: "correct-password", companyId: "b" } }, res);
assert.equal(res.code, 200);
assert.equal(res.body.company.companyId, "b");
res = response();
await authenticate({ body: { email: "shared@example.com", password: "correct-password", companyId: "a" } }, res);
assert.equal(res.code, 400);
res = response();
await authenticate({ body: { email: "shared@example.com", password: "correct-password" } }, res);
assert.equal(res.code, 400, "Ambiguous email login must fail without selecting a company");
console.log("Passed: company list, multiple companies, soft deletion, migration preservation/idempotency, shared email isolation, failed login, offline switching, token scoping, and logout.");
