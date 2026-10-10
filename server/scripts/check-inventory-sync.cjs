// Node 22+: real SQLite and Mongoose validation, with in-memory HTTP/model adapters.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '../..');
const client = 'client/src/electron/';
const quiet = { log() {}, warn() {}, error() {} };
function load(file, resolve, extra = '') {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8') + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInThisContext(`(function(module, exports, require, console, process) { ${code}\n})`, { filename: file })(
    module, module.exports, resolve, quiet, { env: { VITE_API_URL: 'http://test' } }
  );
  return module.exports;
}
const sql = new DatabaseSync(':memory:');
const db = {
  run: async (query, values = []) => sql.prepare(query).run(...values),
  all: async (query, values = []) => sql.prepare(query).all(...values),
  getDirect: async (query, values = []) => sql.prepare(query).get(...values),
  transaction: async (callback) => {
    sql.exec('BEGIN');
    try { const result = await callback(); sql.exec('COMMIT'); return result; }
    catch (error) { sql.exec('ROLLBACK'); throw error; }
  },
};
db.runDirect = db.run;
const entities = load('client/src/common/types/inventory/InventorySync.ts', () => ({}));
const clientResolve = name => name.endsWith('/db.js') ? db : name.endsWith('/InventorySync.js') ? entities : {};
const inventory = load(client + 'database/repositories/modules/inventory/inventorySync.repository.ts', clientResolve);
const pending = async company => db.all('SELECT * FROM sync_queue WHERE companyId = ? AND synced = 0 ORDER BY _id', [company]);
const queue = {
  getUnsyncedItems: pending,
  markManySynced: async (company, ids) => {
    for (const id of ids) await db.run('UPDATE sync_queue SET synced = 1 WHERE companyId = ? AND _id = ?', [company, id]);
  },
};
const fixtures = {
  inventory_category: { code: 'CAT', name: 'Category' },
  inventory_unit: { code: 'KG', name: 'Kilogram', category: 'WEIGHT' },
  inventory_item: { sku: 'SKU', name: 'Item', itemType: 'RAW_MATERIAL', baseUnitId: 'inventory_unit', trackingMethod: 'NONE', customFields: '{"color":"blue"}' },
  inventory_warehouse: { code: 'WH', name: 'Warehouse' },
  inventory_location: { warehouseId: 'inventory_warehouse', code: 'A', name: 'Shelf', locationType: 'SHELF' },
  inventory_document: { documentNumber: 'DOC', type: 'RECEIPT', status: 'DRAFT', documentDate: '2026-10-01T00:00:00.000Z' },
  inventory_document_line: { documentId: 'inventory_document', lineNumber: 1, itemId: 'inventory_item', quantity: 2, unitId: 'inventory_unit' },
  inventory_movement: { movementId: 'MOVE', documentId: 'inventory_document', documentLineId: 'inventory_document_line', itemId: 'inventory_item', warehouseId: 'inventory_warehouse', quantity: 2, unitId: 'inventory_unit', direction: 'IN', movementType: 'RECEIPT', occurredAt: '2026-10-01T00:00:00.000Z' },
  inventory_balance: { itemId: 'inventory_item', warehouseId: 'inventory_warehouse', quantityOnHand: 2, quantityAvailable: 2 },
  inventory_sku_settings: { enabled: 1 },
};
const modelCache = new Map();
function loadModel(file) {
  if (!modelCache.has(file)) modelCache.set(file, load(file, name => name === 'mongoose' ? require(name) : loadModel(path.posix.join(path.posix.dirname(file), name.replace(/\.js$/, '.ts')))));
  return modelCache.get(file);
}
const registry = loadModel('server/models/modules/inventory/inventorySync.ts');
const records = new Map();
let version = 0;
for (const [entity, Model] of Object.entries(registry.inventorySyncModels)) {
  const rows = new Map();
  records.set(entity, rows);
  Model.findOne = filter => ({ lean: async () => {
    const row = rows.get(filter._id);
    return row?.companyId === filter.companyId ? structuredClone(row) : null;
  } });
  Model.replaceOne = async (filter, value, options) => {
    const existing = rows.get(filter._id);
    if (existing && existing.companyId !== filter.companyId) throw Object.assign(new Error('duplicate ID'), { code: 11000 });
    if (existing && filter.serverVersion !== undefined && existing.serverVersion !== filter.serverVersion) return { matchedCount: 0 };
    rows.set(filter._id, structuredClone(value));
    return existing ? { matchedCount: 1 } : { upsertedCount: options.upsert ? 1 : 0 };
  };
  const matches = (row, filter) => row.companyId === filter.companyId && row.serverVersion > filter.serverVersion.$gt;
  Model.find = filter => {
    let max = Infinity;
    const query = { sort: () => query, limit: n => { max = n; return query; }, lean: async () => [...rows.values()].filter(row => matches(row, filter)).sort((a, b) => a.serverVersion - b.serverVersion).slice(0, max).map(row => JSON.parse(JSON.stringify(row))) };
    return query;
  };
  Model.exists = async filter => [...rows.values()].some(row => matches(row, filter));
}
const sync = load('server/sync.ts', name => {
  if (name.endsWith('/inventorySync.js')) return registry;
  if (name.endsWith('/syncVersion.js')) return { getNextSyncVersion: async () => ++version };
  return name.startsWith('.') ? {} : require(name);
});
const router = load('server/routes/shared/sync.route.ts', name => {
  if (name.endsWith('/inventorySync.js')) return registry;
  if (name === '../../sync.js') return sync;
  if (name.endsWith('/authorize.js')) return (_req, _res, next) => next();
  if (name.endsWith('/sync_upload.js')) return { fields: () => (_req, _res, next) => next() };
  return name.startsWith('.') ? {} : require(name);
}).default;
async function request(method, url, values, companyId = 'a') {
  const route = router.stack.find(layer => layer.route?.path === url && layer.route.methods[method]).route;
  let body, status = 200;
  const res = { status: value => { status = value; return res; }, json: value => { body = value; return res; } };
  await route.stack.at(-1).handle({ user: { companyId }, headers: { 'x-company-id': companyId },
    body: method === 'post' ? { items: JSON.stringify(values) } : {}, query: method === 'get' ? values : {} }, res);
  assert.equal(status, 200, JSON.stringify(body));
  return body;
}
let duringPush = async () => {};
class Form { append(key, value) { this[key] = value; } getHeaders() { return {}; } }
const push = load(client + 'services/shared/sync/push.service.ts', name => {
  if (name === 'axios') return { post: async (_url, form) => {
    const data = await request('post', '/push', JSON.parse(form.items));
    await duringPush();
    return { status: 200, data };
  } };
  if (name === 'electron') return { app: { isPackaged: false } };
  if (name === 'form-data') return Form;
  if (name.endsWith('/auth.js')) return { getToken: async () => 'token' };
  if (name.endsWith('/InventorySync.js')) return entities;
  if (name.endsWith('/inventorySync.repository.js')) return inventory;
  if (name.endsWith('/sync.repository.js')) return queue;
  return name.startsWith('.') ? {} : require(name);
});
const cursors = new Map();
const pull = load(client + 'services/shared/sync/pull.service.ts', name => {
  if (name === 'axios') return { get: async (_url, options) => ({ data: await request('get', '/pull', options.params) }) };
  if (name === 'electron') return { app: { isPackaged: false } };
  if (name.endsWith('/auth.js')) return { getToken: async () => 'token' };
  if (name.endsWith('/sync.repository.js')) return queue;
  if (name.endsWith('/syncState.repository.js')) return {
    getSyncState: async (_company, entity) => ({ lastPulledVersion: cursors.get(entity) ?? 0 }),
    updateLastPulledVersion: async (_company, entity, value) => cursors.set(entity, value),
  };
  return name.startsWith('.') ? {} : require(name);
}, '\nexport { pullEntityByVersion };');
async function insert(entity, companyId = 'a', suffix = '') {
  const fields = { _id: entity + suffix, companyId, ...fixtures[entity], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
  if (entity === 'inventory_sku_settings') delete fields._id;
  await db.run(`INSERT INTO ${entities.INVENTORY_SYNC_TABLES[entity]} (${Object.keys(fields).join(',')}) VALUES (${Object.keys(fields).map(() => '?').join(',')})`, Object.values(fields));
}
(async () => {
  await load(client + 'database/schemas/shared/sync.schema.ts', clientResolve).createSyncTable();
  for (const [file, fn] of [['items', 'createInventoryItemsTable'], ['movements', 'createInventoryMovementsTables'], ['warehouses', 'createInventoryWarehouseTable']]) {
    await load(client + `database/schemas/modules/inventory/inventory_${file}.schema.ts`, clientResolve)[fn]();
  }
  await insert('inventory_item');
  // Simulate a database created before SKU settings had synchronization metadata.
  sql.exec(`DROP TABLE inventory_sku_settings;
    CREATE TABLE inventory_sku_settings (companyId TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0,
      prefix TEXT NOT NULL DEFAULT 'ART-', digits INTEGER NOT NULL DEFAULT 5, nextNumber INTEGER NOT NULL DEFAULT 1);
    INSERT INTO inventory_sku_settings (companyId, enabled) VALUES ('a', 1)`);
  const initialize = load(client + 'database/schemas/modules/inventory/inventory_sync.schema.ts', clientResolve).initializeInventorySync;
  await initialize();
  await initialize();
  assert.equal((await pending('a')).length, 2, 'Backfill and legacy SKU migration are idempotent');
  for (const entity of Object.keys(fixtures)) if (!['inventory_item', 'inventory_sku_settings'].includes(entity)) await insert(entity);
  assert.equal((await pending('a')).length, 10, 'Every table queues its writes');
  await assert.rejects(db.transaction(async () => {
    await db.run("UPDATE inventory_items SET name = 'Rollback', synced = 0");
    throw new Error('rollback');
  }));
  assert.equal((await pending('a')).length, 10, 'Queue writes roll back with data');
  const result = await push.pushPendingChanges('a');
  assert.equal(result.pendingChanges, 0);
  assert.equal(result.syncedCount, 10);
  for (const [entity, table] of Object.entries(entities.INVENTORY_SYNC_TABLES)) {
    assert.equal((await db.getDirect(`SELECT synced FROM ${table}`)).synced, 1);
    assert.equal(records.get(entity).size, 1);
    const response = await request('get', '/pull', { entity, afterVersion: '0', limit: '1' });
    assert.equal(response.items.length, 1);
    assert.equal(response.hasMore, false);
    assert.equal((await request('get', '/pull', { entity, afterVersion: String(response.nextVersion) })).items.length, 0);
    assert.equal((await request('get', '/pull', { entity }, 'b')).items.length, 0);
    assert.equal(await inventory.applyInventoryBatch('a', entity, response.items), true);
  }
  assert.equal((await pending('a')).length, 0, 'Pulls must not echo into the queue');
  assert.equal(JSON.parse((await db.getDirect('SELECT customFields FROM inventory_items')).customFields).color, 'blue');
  const beforeRetry = version;
  const rows = await db.all('SELECT * FROM sync_queue');
  await request('post', '/push', rows.map(row => ({ queueId: row._id, companyId: 'a', entity: row.entity, operation: row.operation, data: JSON.parse(row.payload) })));
  assert.equal(version, beforeRetry, 'Replays do not allocate new versions');
  await db.run("UPDATE inventory_items SET name = 'First', updatedAt = '2026-10-02T00:00:00.000Z', synced = 0");
  duringPush = async () => db.run("UPDATE inventory_items SET name = 'Second', updatedAt = '2026-10-03T00:00:00.000Z', synced = 0");
  await push.pushPendingChanges('a');
  assert.equal((await pending('a')).length, 1);
  assert.equal((await db.getDirect('SELECT synced FROM inventory_items')).synced, 0);
  const remote = (await request('get', '/pull', { entity: 'inventory_item' })).items;
  assert.equal(await inventory.applyInventoryBatch('a', 'inventory_item', remote), false);
  await assert.rejects(() => pull.pullEntityByVersion('a', 'inventory_item', items => inventory.applyInventoryBatch('a', 'inventory_item', items)), /CURSOR WAS NOT ADVANCED/);
  assert.equal(cursors.get('inventory_item'), undefined);
  duringPush = async () => {};
  await push.pushPendingChanges('a');
  await pull.pullEntityByVersion('a', 'inventory_item', items => inventory.applyInventoryBatch('a', 'inventory_item', items));
  assert(cursors.get('inventory_item') > 0, 'Cursor advances only after safe application');
  const bad = { ...JSON.parse(rows.find(row => row.entity === 'inventory_movement').payload), quantity: -1, updatedAt: '2026-10-04T00:00:00.000Z' };
  await db.run('INSERT INTO sync_queue (companyId, entity, entityId, operation, payload) VALUES (?, ?, ?, ?, ?)', ['a', 'inventory_movement', bad._id, 'create', JSON.stringify(bad)]);
  await db.run("UPDATE inventory_warehouses SET name = 'New warehouse', updatedAt = '2026-10-04T00:00:00.000Z', synced = 0");
  await push.pushPendingChanges('a');
  assert.equal((await pending('a')).length, 1, 'Only the failed item remains pending');
  await db.run('DELETE FROM inventory_document_lines');
  await push.pushPendingChanges('a');
  assert.equal(records.get('inventory_document_line').get('inventory_document_line').isDeleted, 1);
  const tombstones = (await request('get', '/pull', { entity: 'inventory_document_line' })).items;
  assert.equal(tombstones[0].isDeleted, 1, 'Pull includes deletion tombstones');
  await assert.rejects(inventory.applyInventoryBatch('b', 'inventory_item', remote), /Invalid inventory pull/);
  console.log('Passed: all 10 entities push/pull, transactional queue capture, backfill, replay safety, concurrent edits, partial failures, tombstones, tenant isolation, and JSON conversion.');
  sql.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
