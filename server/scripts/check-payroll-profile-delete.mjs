import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { URL } from "node:url";
import console from "node:console";
import ts from "typescript";

const resolve = createRequire(import.meta.url);
function load(file, overrides = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, { module, exports: module.exports, Date, Error,
    require: name => overrides[name] ?? (name.startsWith(".") ? {} : resolve(name)),
  });
  return module.exports;
}
const Model = load("../models/modules/hr/payrollEmployeeProfile.model.ts").default;
const records = new Map();
let version = 0;
Model.findOne = filter => ({ lean: async () => {
  const row = records.get(filter._id);
  return row?.companyId === filter.companyId ? row : null;
} });
Model.updateOne = async (filter, update, options) => {
  const existing = records.get(filter._id);
  if (existing && existing.companyId !== filter.companyId) {
    const error = new Error("Duplicate ID"); error.code = 11000; throw error;
  }
  if (existing && existing.serverVersion !== filter.serverVersion) return { matchedCount: 0 };
  assert.equal(options.upsert, !existing);
  const row = new Model({ ...update.$setOnInsert, ...update.$set });
  await row.validate();
  records.set(filter._id, row.toObject());
  return { matchedCount: existing ? 1 : 0, upsertedCount: existing ? 0 : 1 };
};
const sync = load("../sync.ts", {
  "./models/modules/hr/payrollEmployeeProfile.model.js": Model,
  "./utils/syncVersion.js": { getNextSyncVersion: async () => ++version },
});
const profile = { _id: "profile", companyId: "a", employeeId: "employee", componentId: "component",
  accountNumber: "cash", name: "SALARY", displayName: "Salary", displayOrder: 1, type: "EARNING",
  calculationType: "FIXE", value: 100, isDeleted: 0, serverVersion: 0, createdAt: "2026-10-01", updatedAt: "2026-10-12" };
await assert.rejects(() => sync.syncPayrollProfile("update", profile), error => error.code === "MISSING_RECORD");
const result = await sync.syncPayrollProfile("delete", profile);
assert.equal(result.record.isDeleted, 1);
assert(result.serverVersion > 0);
assert.equal((await sync.syncPayrollProfile("delete", profile)).serverVersion, result.serverVersion);
await assert.rejects(() => sync.syncPayrollProfile("create", profile), error => error.code === "REVISION_CONFLICT");
await assert.rejects(() => sync.syncPayrollProfile("delete", { ...profile, _id: "invalid", name: undefined }), error => error.name === "ValidationError");
assert(!records.has("invalid"));
await assert.rejects(() => sync.syncPayrollProfile("delete", { ...profile, companyId: "b" }), error => error.code === 11000);
assert.equal(records.get("profile").companyId, "a");
const active = await sync.syncPayrollProfile("create", { ...profile, _id: "active" });
await assert.rejects(() => sync.syncPayrollProfile("delete", { ...profile, _id: "active" }), error => error.code === "REVISION_CONFLICT");
const deleted = await sync.syncPayrollProfile("delete", { ...profile, _id: "active", serverVersion: active.serverVersion });
assert.equal(deleted.record.isDeleted, 1);
console.log("Passed: missing-profile deletion, idempotent retry, validation, company isolation, and existing-profile conflicts.");
const indexEvents = [];
let rejectReplacement = false;
const migration = load("../utils/migratePayrollProfileIndex.ts", {
  "../models/modules/hr/payrollEmployeeProfile.model.js": { collection: {
    createIndex: async (keys, options) => {
      indexEvents.push("create");
      assert.equal(keys.companyId, 1);
      assert.equal(options.partialFilterExpression.isDeleted, 0);
      if (rejectReplacement) throw new Error("duplicate active profiles");
    },
    indexes: async () => [
      { name: "legacy", unique: true, key: { employeeId: 1, componentId: 1 } },
      { name: "current", unique: true, key: { companyId: 1, employeeId: 1, componentId: 1 } },
    ],
    dropIndex: async name => indexEvents.push(name),
  } },
});
await migration.migratePayrollProfileIndex();
assert.deepEqual(indexEvents, ["create", "legacy"]);
indexEvents.length = 0;
rejectReplacement = true;
await assert.rejects(() => migration.migratePayrollProfileIndex(), /duplicate active profiles/);
assert.deepEqual(indexEvents, ["create"]);
console.log("Passed: replacement index installed before removing legacy uniqueness; migration aborts on duplicates.");
