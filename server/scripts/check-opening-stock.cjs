// Node 22+: real SQLite/Mongoose validation, transactional in-memory Mongo adapter.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const quiet = { log() {}, warn() {}, error() {} };
function load(file, resolve) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInThisContext(`(function(module, exports, require, console) { ${code}\n})`, { filename: file })(module, module.exports, resolve, quiet);
  return module.exports;
}
const cache = new Map();
function model(file) {
  if (!cache.has(file)) cache.set(file, load(file, name => name === 'mongoose' ? require(name) : model(path.posix.join(path.posix.dirname(file), name.replace(/\.js$/, '.ts')))));
  return cache.get(file);
}
const registry = model('server/models/modules/inventory/inventorySync.ts');
const Company = model('server/models/shared/company.model.ts').default;
let state = {};
let version = 0;
const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
  if (value instanceof RegExp) return value.test(row[key]);
  if (value && typeof value === 'object') {
    if ('$ne' in value) return row[key] !== value.$ne;
    if ('$gt' in value) return row[key] > value.$gt;
  }
  return row[key] === value;
});
for (const [name, Model] of Object.entries({ company: Company, ...registry.inventorySyncModels })) {
  state[name] = [];
  Model.findOne = filter => {
    let sort;
    const query = { session: () => query, sort: value => { sort = value; return query; }, lean: async () => {
      let rows = state[name].filter(row => matches(row, filter));
      if (sort) rows.sort((a, b) => b.documentNumber.localeCompare(a.documentNumber));
      return rows[0] ? structuredClone(rows[0]) : null;
    } };
    return query;
  };
  Model.exists = filter => ({ session: async () => state[name].some(row => matches(row, filter)) });
  Model.create = async rows => {
    for (const row of rows) {
      const doc = new Model(row);
      await doc.validate();
      state[name].push(doc.toObject());
    }
  };
  Model.updateOne = async (filter, update, options = {}) => {
    let row = state[name].find(row => matches(row, filter));
    if (!row && options.upsert) {
      row = { ...filter, ...update.$setOnInsert };
      state[name].push(row);
    }
    if (!row) return { modifiedCount: 0 };
    if (name === 'company' && update.$set?.inventoryInitialized) assert.equal(filter.inventoryInitialized.$ne, true);
    Object.assign(row, update.$set);
    return { modifiedCount: 1 };
  };
}
let tail = Promise.resolve();
const mongoose = { startSession: async () => ({
  withTransaction: callback => {
    const work = tail.then(async () => {
      const before = structuredClone(state);
      try { return await callback(); } catch (error) { state = before; throw error; }
    });
    tail = work.catch(() => {});
    return work;
  }, endSession: async () => {},
}) };
const service = load('server/services/openingStock.service.ts', name => {
  if (name === 'mongoose') return mongoose;
  if (name.endsWith('/company.model.js')) return { default: Company, __esModule: true };
  if (name.endsWith('/inventorySync.js')) return registry;
  if (name.endsWith('/syncVersion.js')) return { getNextSyncVersion: async () => ++version };
  return require(name);
});
const sync = load('server/sync.ts', name => {
  if (name.endsWith('/company.model.js')) return { default: Company, __esModule: true };
  if (name.endsWith('/inventorySync.js')) return registry;
  if (name.endsWith('/syncVersion.js')) return { getNextSyncVersion: async () => ++version };
  return name.startsWith('.') ? {} : require(name);
});
function seed(companyId) {
  state.company.push({ _id: companyId, companyId, name: companyId, isDeleted: 0, inventoryInitialized: false });
  state.inventory_item.push({ _id: `${companyId}-item`, companyId, baseUnitId: `${companyId}-unit`, isActive: true, isDeleted: 0, trackingMethod: 'NONE' });
  state.inventory_unit.push({ _id: `${companyId}-unit`, companyId, decimalPlaces: 0, isDeleted: 0 });
  state.inventory_warehouse.push({ _id: `${companyId}-warehouse`, companyId, isActive: true, isDeleted: 0 });
}
const input = company => ({ _id: `opening:${randomUUID()}`, lines: [{ itemId: `${company}-item`, warehouseId: `${company}-warehouse`, quantity: 4, unitCost: 2.5 }] });

(async () => {
  seed('a'); seed('b'); seed('c');
  const first = input('a');
  const second = input('a');
  const results = await Promise.allSettled([service.postOpeningStock('a', 'admin', first), service.postOpeningStock('a', 'admin', second)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'INVENTORY_ALREADY_INITIALIZED');
  const company = state.company.find(row => row.companyId === 'a');
  assert.equal(company.inventoryInitialized, true);
  assert.match(company.inventoryInitializationDocumentNumber, /^INI-\d{4}-0001$/);
  assert(company.inventoryInitializedAt);
  assert.equal(state.inventory_document.length, 1);
  assert.equal(state.inventory_document[0].status, 'POSTED');
  assert.equal(state.inventory_document_line.length, 1);
  assert.equal(state.inventory_movement.length, 1);
  assert.equal(state.inventory_balance[0].quantityOnHand, 4);
  assert.equal(state.inventory_balance[0].totalValue, 10);
  await service.postOpeningStock('a', 'admin', first);
  assert.equal(state.inventory_movement.length, 1, 'Lost-response retries do not apply stock twice');
  const broken = input('b');
  broken.lines.push({ ...broken.lines[0], itemId: 'a-item' });
  await assert.rejects(service.postOpeningStock('b', 'admin', broken), /autre entreprise/);
  assert.equal(state.company.find(row => row.companyId === 'b').inventoryInitialized, false);
  assert.equal(state.inventory_document.length, 1, 'A later invalid line rolls back earlier stock effects and the company flag');
  await service.postOpeningStock('b', 'admin', input('b'));
  assert.equal(state.inventory_document.length, 2, 'Other companies can initialize independently');
  const duplicate = input('c'); duplicate.lines.push({ ...duplicate.lines[0] });
  await assert.rejects(service.postOpeningStock('c', 'admin', duplicate), /deux fois/);
  for (const patch of [{ quantity: -1 }, { quantity: Infinity }, { quantity: 0.5 }, { unitCost: -1 }, { quantity: 1e308, unitCost: 1e308 }]) {
    const bad = input('c'); Object.assign(bad.lines[0], patch);
    await assert.rejects(service.postOpeningStock('c', 'admin', bad));
  }
  for (const [entity, record] of [
    ['inventory_document', { ...state.inventory_document[0], _id: randomUUID() }],
    ['inventory_movement', { ...state.inventory_movement[0], _id: randomUUID() }],
    ['inventory_document_line', { ...state.inventory_document_line[0], _id: randomUUID() }],
  ]) {
    await assert.rejects(sync.syncInventory(entity, 'create', { ...record, updatedAt: new Date().toISOString() }), /stock initial/);
  }
  await sync.syncCompany('update', { _id: 'a', companyId: 'a', updatedAt: new Date().toISOString(), name: 'Changed', inventoryInitialized: false, inventoryInitializedAt: null, inventoryInitializationDocumentId: null, inventoryInitializationDocumentNumber: null });
  assert.equal(state.company.find(row => row.companyId === 'a').inventoryInitialized, true, 'Stale profile sync cannot reset initialization');

  const sql = new DatabaseSync(':memory:');
  const db = {
    run: async (query, values = []) => sql.prepare(query).run(...values),
    get: async (query, values = []) => sql.prepare(query).get(...values) ?? null,
    all: async (query, values = []) => sql.prepare(query).all(...values),
    transaction: async callback => { sql.exec('BEGIN'); try { const result = await callback(); sql.exec('COMMIT'); return result; } catch (error) { sql.exec('ROLLBACK'); throw error; } },
  };
  db.runDirect = db.run; db.getDirect = db.get;
  const base = 'client/src/electron/database/';
  const resolve = name => name.endsWith('/db.js') ? db : name === 'electron' ? { app: {} } : name.endsWith('/sync.repository.js') ? { addToSyncQueue: async () => {} } : require(name);
  const schema = load(base + 'schemas/shared/companies.schema.ts', resolve);
  await schema.createCompanyTable(); await schema.createCompanyTable();
  await db.run("INSERT INTO companies (_id, companyId, name, createdAt, updatedAt, synced) VALUES ('a', 'a', 'Local pending edit', 'now', 'now', 0)");
  const companies = load(base + 'repositories/shared/companies.repository.ts', resolve);
  await companies.upsertCompany({ ...company, name: 'Remote name', serverVersion: 20 });
  const local = await companies.getCompanyById('a');
  assert.equal(local.name, 'Local pending edit');
  assert.equal(local.synced, 0);
  assert.equal(local.inventoryInitialized, 1, 'Authoritative flag reconciles even with pending local edits');
  await companies.upsertCompany({ ...company, inventoryInitialized: false });
  assert.equal((await companies.getCompanyById('a')).inventoryInitialized, 1, 'Older pulls do not reset initialization');
  sql.close();
  console.log('Passed: competing submissions, idempotent retries, rollback, tenant isolation, validation, sync bypass protection, SQLite migration, and company-state reconciliation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
