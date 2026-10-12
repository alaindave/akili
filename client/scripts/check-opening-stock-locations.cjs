// Node 22+: exercise local draft persistence and the submission payload in SQLite.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const sql = new DatabaseSync(':memory:');
const run = async (query, values = []) => sql.prepare(query).run(...values);
const get = async (query, values = []) => sql.prepare(query).get(...values) ?? null;
const all = async (query, values = []) => sql.prepare(query).all(...values);
const db = { run, get, all, runDirect: run, getDirect: get,
  transaction: async callback => {
    sql.exec('BEGIN');
    try { const result = await callback(); sql.exec('COMMIT'); return result; }
    catch (error) { sql.exec('ROLLBACK'); throw error; }
  },
};
let submitted;
const cache = new Map();
function load(file) {
  file = path.resolve(__dirname, '../src', file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const resolve = name => {
    if (name.endsWith('/db.js')) return db;
    if (name === 'electron') return { app: { isPackaged: false } };
    if (name === 'axios') return { post: async (_url, input) => { submitted = input; throw new Error('offline'); }, isAxiosError: () => false };
    if (name.endsWith('/auth.js')) return { getToken: async () => 'token' };
    if (name.endsWith('/companies.repository.js')) return { getCompanyById: company => get('SELECT * FROM companies WHERE companyId = ?', [company]) };
    if (name.endsWith('/inventoryWarehouse.repository.js')) return { InventoryWarehouseRepository: class {} };
    if (name.endsWith('/push.service.js')) return { pushPendingChanges: async () => ({ pendingChanges: false }) };
    if (name.endsWith('/pull.service.js') || name.endsWith('/inventorySync.repository.js')) return {};
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts')));
    return require(name);
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: resolve, Date, process, console });
  cache.set(file, module.exports);
  return module.exports;
}

(async () => {
  await load('electron/database/schemas/modules/inventory/inventory_warehouses.schema.ts').createInventoryWarehouseTable();
  sql.exec(`CREATE TABLE companies (companyId TEXT PRIMARY KEY, inventoryInitialized INTEGER DEFAULT 0);
    CREATE TABLE inventory_opening_drafts (companyId TEXT PRIMARY KEY, payload TEXT, updatedAt TEXT);
    CREATE TABLE inventory_items (_id TEXT PRIMARY KEY, companyId TEXT, name TEXT, isActive INTEGER, isDeleted INTEGER);
    CREATE TABLE inventory_units (_id TEXT PRIMARY KEY, companyId TEXT, name TEXT, isDeleted INTEGER);
    INSERT INTO companies (companyId) VALUES ('a'), ('b');
    INSERT INTO inventory_items VALUES ('item', 'a', 'Article', 1, 0);
    INSERT INTO inventory_units VALUES ('unit', 'a', 'Pièce', 0);`);
  for (const [id, companyId] of [['w1', 'a'], ['w2', 'a'], ['foreign-warehouse', 'b']]) {
    await run(`INSERT INTO inventory_warehouses (_id, companyId, code, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'now', 'now')`, [id, companyId, id, id]);
  }
  for (const [id, parentId, warehouseId, companyId, isActive, isDeleted] of [
    ['zone', null, 'w1', 'a', 1, 0], ['rack', 'zone', 'w1', 'a', 1, 0], ['bin', 'rack', 'w1', 'a', 1, 0],
    ['other', null, 'w2', 'a', 1, 0], ['foreign', null, 'foreign-warehouse', 'b', 1, 0],
    ['inactive', null, 'w1', 'a', 0, 0], ['deleted', null, 'w1', 'a', 1, 1],
  ]) await run(`INSERT INTO inventory_locations (_id, companyId, warehouseId, parentId, code, name, locationType, isActive, isDeleted, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 'OTHER', ?, ?, 'now', 'now')`, [id, companyId, warehouseId, parentId, id, id, isActive, isDeleted]);
  const service = load('electron/services/modules/inventory/openingStock.service.ts');
  const state = await service.getOpeningStockState('a');
  assert.equal(state.locations.length, 4);
  assert.equal(state.locations.find(location => location._id === 'rack').parentId, 'zone');
  assert.equal(state.locations.find(location => location._id === 'bin').parentId, 'rack');
  assert(state.locations.every(location => location.companyId === 'a' && location.isActive && !location.isDeleted));
  const legacy = { _id: `opening:${randomUUID()}`, lines: [{ itemId: 'item', warehouseId: 'w1', quantity: 2, unitCost: 3 }] };
  await service.saveOpeningStockDraft('a', legacy);
  assert.equal((await service.getOpeningStockState('a')).draft.lines[0].locationId, undefined, 'Old drafts remain valid');
  const draft = { ...legacy, lines: ['zone', 'rack', 'bin'].map(locationId => ({ ...legacy.lines[0], locationId })) };
  await service.saveOpeningStockDraft('a', draft);
  assert.deepEqual(JSON.parse(JSON.stringify((await service.getOpeningStockState('a')).draft)), draft);
  for (const locationId of ['missing', 'other', 'foreign', 'inactive', 'deleted', '', ' ', 42]) {
    const before = await get('SELECT payload FROM inventory_opening_drafts WHERE companyId = ?', ['a']);
    await assert.rejects(service.saveOpeningStockDraft('a', { ...legacy, lines: [{ ...legacy.lines[0], locationId }] }));
    assert.deepEqual(await get('SELECT payload FROM inventory_opening_drafts WHERE companyId = ?', ['a']), before, 'Invalid location cannot overwrite the saved draft');
  }
  await assert.rejects(service.submitOpeningStock('a', draft), /offline/);
  assert.deepEqual(JSON.parse(JSON.stringify(submitted)), draft, 'Submission forwards the selected location on every line');
  assert.deepEqual(JSON.parse(JSON.stringify((await service.getOpeningStockState('a')).draft)), draft, 'Network failure preserves located drafts');
  sql.close();
  console.log('Passed: location hierarchy loading, legacy drafts, location persistence, warehouse/company validation, and offline retry payload.');
})().catch(error => { console.error(error); process.exitCode = 1; });
