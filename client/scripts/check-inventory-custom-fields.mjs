import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import console from 'node:console';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../src');
const sql = new DatabaseSync(':memory:');
let callbacks = null;
const run = async (query, params = []) => sql.prepare(query).run(...params);
const get = async (query, params = []) => sql.prepare(query).get(...params) ?? null;
const all = async (query, params = []) => sql.prepare(query).all(...params);
const db = { run, get, all, runDirect: run, getDirect: get, allDirect: all,
  afterCommit: callback => callbacks ? callbacks.push(callback) : callback(),
  transaction: async callback => {
    if (callbacks) return callback();
    sql.exec('BEGIN'); callbacks = [];
    try {
      const result = await callback(); sql.exec('COMMIT');
      const pending = callbacks; callbacks = null; pending.forEach(fn => fn()); return result;
    } catch (error) { callbacks = null; sql.exec('ROLLBACK'); throw error; }
  },
};
const cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const require = createRequire(file);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console, Date,
    require: name => {
      if (name.endsWith('/db.js')) return db;
      if (name.endsWith('/shared/sync.repository.js')) return {
        notifyPendingChanges: async () => {},
        addToSyncQueue: async entry => run(
          'INSERT INTO sync_queue (companyId, entity, entityId, operation, payload) VALUES (?, ?, ?, ?, ?)',
          [entry.companyId, entry.entity, entry.entityId, entry.operation, entry.payload]),
      };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts')));
      return require(name);
    },
  });
  cache.set(file, module.exports);
  return module.exports;
}
const now = new Date().toISOString();
try {
  // Existing installations have this catalog table; isolate its unrelated fresh-schema issue.
  sql.exec(`CREATE TABLE inventory_categories (_id TEXT PRIMARY KEY, companyId TEXT, code TEXT, name TEXT,
    parentId TEXT, isActive INTEGER DEFAULT 1, customFields TEXT, createdAt TEXT, updatedAt TEXT,
    serverVersion INTEGER DEFAULT 0, synced INTEGER DEFAULT 0, isDeleted INTEGER DEFAULT 0);
    CREATE TABLE sync_queue (_id INTEGER PRIMARY KEY, companyId TEXT, entity TEXT, entityId TEXT, operation TEXT, payload TEXT, synced INTEGER DEFAULT 0);
    CREATE TABLE companies (companyId TEXT PRIMARY KEY, email TEXT, isDeleted INTEGER DEFAULT 0);
    INSERT INTO companies(companyId) VALUES ('a'), ('b');`);
  await load('electron/database/schemas/modules/inventory/inventory_items.schema.ts').createInventoryItemsTable();
  await load('electron/database/schemas/modules/inventory/inventory_warehouses.schema.ts').createInventoryWarehouseTable();
  await load('electron/database/schemas/modules/inventory/inventory_movements.schema.ts').createInventoryMovementsTables();
  const migration = load('electron/database/schemas/modules/inventory/inventory_sync.schema.ts');
  await migration.initializeInventorySync();
  const definitions = load('electron/services/modules/inventory/inventoryCustomField.service.ts');
  for (const entity of ['ITEM', 'CATEGORY', 'WAREHOUSE', 'LOCATION', 'DOCUMENT', 'DOCUMENT_LINE']) {
    await definitions.createCustomField('a', { entity, label: 'Référence' });
  }
  assert.equal((await definitions.getCustomFields('a')).length, 6);
  assert.equal((await definitions.getCustomFields('b')).length, 0);
  await definitions.createCustomField('b', { entity: 'ITEM', label: 'Référence' });
  await assert.rejects(() => definitions.createCustomField('a', { entity: 'ITEM', label: 'REFERENCE!' }), /existe déjà/);
  const { generateCustomFieldKey } = load('common/types/inventory/customFieldValidation.ts');
  for (const [label, key] of [
    ['Origin Country', 'origin_country'], [' Référence fournisseur! ', 'reference_fournisseur'],
    ['2026 code', 'field_2026_code'], ['constructor', 'field_constructor'],
    ['__proto__', 'proto'], ['a'.repeat(100), 'a'.repeat(64)],
  ]) assert.equal(generateCustomFieldKey(label), key);
  assert.throws(() => generateCustomFieldKey('!!!'));
  for (const input of [
    { entity: 'ITEM', key: 'manual_key', label: 'Invalid' },
    { entity: 'ITEM', label: '!!!' },
    { entity: 'ITEM', label: ' ' },
    { entity: 'UNKNOWN', label: 'Invalid' },
  ]) assert.throws(() => definitions.createCustomField('a', input));
  const beforeMigration = await definitions.getCustomFields('a');
  await migration.initializeInventorySync();
  assert.deepEqual(await definitions.getCustomFields('a'), beforeMigration, 'Migration preserves existing definitions');
  const queueBefore = sql.prepare("SELECT COUNT(*) AS count FROM sync_queue WHERE entity = 'inventory_custom_field'").get().count;
  assert.equal(queueBefore, 7, 'One offline sync snapshot per definition, no migration duplicates');

  const settings = load('electron/database/repositories/modules/inventory/stockSettings.repository.ts');
  await settings.saveStockCategory('a', { name: 'Category', isActive: true, customFields: { reference: 'CAT' } });
  await settings.saveStockUnit('a', { code: 'PCS', name: 'Pièce', category: 'QUANTITY', decimalPlaces: 0 });
  const catalog = await settings.getStockSettings('a');
  assert.equal(catalog.customFields.length, 6);
  assert.equal(JSON.parse(sql.prepare('SELECT customFields FROM inventory_categories').get().customFields).reference, 'CAT');
  const itemService = new (load('electron/services/modules/inventory/inventoryItem.service.ts').InventoryItemService)();
  const item = await itemService.create('a', { sku: 'SKU', name: 'Article', itemType: 'RAW_MATERIAL',
    baseUnitId: catalog.units[0]._id, trackingMethod: 'NONE', customFields: { reference: 'ITEM' } });
  assert.equal((await itemService.getById('a', item._id)).customFields.reference, 'ITEM');
  const warehouses = new (load('electron/database/repositories/modules/inventory/inventoryWarehouse.repository.ts').InventoryWarehouseRepository)();
  const warehouse = await warehouses.create('a', { name: 'Warehouse', type: 'GENERAL', isActive: true, customFields: { reference: 'WAREHOUSE' } });
  assert.equal((await warehouses.getById('a', warehouse._id)).customFields.reference, 'WAREHOUSE');
  const locations = new (load('electron/database/repositories/modules/inventory/inventoryLocation.repository.ts').InventoryLocationRepository)();
  const location = await locations.create('a', { warehouseId: warehouse._id, code: 'B1', name: 'Bin', locationType: 'BIN', isActive: true, customFields: { reference: 'LOCATION' } });
  assert.equal((await locations.getById('a', location._id)).customFields.reference, 'LOCATION');
  const posting = load('electron/services/modules/inventory/inventoryTransaction.service.ts').inventoryTransactionService;
  const draft = { requestId: randomUUID(), type: 'RECEIPT', date: now, reference: 'REF', reason: 'Test',
    warehouseId: warehouse._id, locationId: location._id, customFields: { reference: 'DOCUMENT', transaction_request: 'user text' },
    lines: [{ itemId: item._id, quantity: 2, unitCost: 3, customFields: { reference: 'LINE' } }] };
  const posted = await posting.post('a', 'user', draft);
  const document = sql.prepare('SELECT customFields FROM inventory_documents WHERE _id = ?').get(posted.documentId);
  assert.equal(JSON.parse(document.customFields).userFields.reference, 'DOCUMENT');
  assert.equal(JSON.parse(JSON.parse(document.customFields).transactionRequest).customFields.reference, 'DOCUMENT', 'Internal fingerprint remains separate');
  const line = sql.prepare('SELECT customFields FROM inventory_document_lines WHERE documentId = ?').get(posted.documentId);
  assert.equal(JSON.parse(line.customFields).userFields.reference, 'LINE');
  await posting.post('a', 'user', draft);
  assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM inventory_documents').get().count, 1);
  await assert.rejects(() => posting.post('a', 'user', { ...draft, requestId: randomUUID(),
    lines: [...draft.lines, { itemId: 'missing', quantity: 1, unitCost: 1 }] }));
  assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM inventory_documents').get().count, 1, 'Failed posting rolls back custom document and line values');
  await assert.rejects(() => posting.post('a', 'user', { ...draft, requestId: randomUUID(), customFields: { bad: 42 } }));

  const sync = load('electron/database/repositories/modules/inventory/inventorySync.repository.ts');
  const queued = sql.prepare("SELECT * FROM sync_queue WHERE companyId = 'a' AND entity = 'inventory_custom_field' LIMIT 1").get();
  const snapshot = JSON.parse(queued.payload);
  await sync.acknowledgeInventorySnapshot('a', 'inventory_custom_field', snapshot, queued._id, 1);
  assert.equal(await sync.applyInventoryBatch('a', 'inventory_custom_field', [{ ...snapshot, label: 'Updated remotely', serverVersion: 2 }]), true);
  assert.equal((await definitions.getCustomFields('a')).find(field => field._id === snapshot._id).label, 'Updated remotely');
  assert.equal((await definitions.getCustomFields('a')).find(field => field._id === snapshot._id).key, 'reference');
  assert.equal((await itemService.getById('a', item._id)).customFields.reference, 'ITEM');
  await assert.rejects(() => sync.applyInventoryBatch('a', 'inventory_custom_field', [{ ...snapshot, key: 'renamed', serverVersion: 3 }]), /ne peuvent pas/);
  await assert.rejects(() => sync.applyInventoryBatch('a', 'inventory_custom_field', [{ ...snapshot, entity: 'CATEGORY', serverVersion: 3 }]), /ne peuvent pas/);
  await assert.rejects(() => sync.applyInventoryBatch('b', 'inventory_custom_field', [{ ...snapshot, serverVersion: 3 }]), /Invalid/);

  const model = load('../../server/models/modules/inventory/inventoryCustomField.model.ts').default;
  const queueCount = () => sql.prepare("SELECT COUNT(*) AS count FROM sync_queue WHERE entity = 'inventory_custom_field'").get().count;
  const beforeEdits = queueCount();
  await assert.rejects(() => definitions.updateCustomField('b', { id: snapshot._id, label: 'Forbidden' }), /introuvable/);
  await assert.rejects(() => definitions.archiveCustomField('b', snapshot._id), /introuvable/);
  assert.throws(() => definitions.updateCustomField('a', { id: snapshot._id, label: ' ' }));
  assert.throws(() => definitions.updateCustomField('a', { id: snapshot._id, label: 'New', key: 'new' }));
  assert.equal(queueCount(), beforeEdits, 'Rejected edits do not enqueue changes');
  await definitions.updateCustomField('a', { id: snapshot._id, label: 'Renamed locally' });
  const renamed = (await definitions.getCustomFields('a')).find(field => field._id === snapshot._id);
  assert.equal(renamed.label, 'Renamed locally');
  assert.equal(renamed.key, snapshot.key);
  assert.equal(renamed.synced, false);
  await definitions.archiveCustomField('a', snapshot._id);
  assert.equal((await definitions.getCustomFields('a')).some(field => field._id === snapshot._id), false);
  const archived = sql.prepare('SELECT * FROM inventory_custom_fields WHERE _id = ?').get(snapshot._id);
  assert.equal(archived.isActive, 0);
  assert.equal(archived.key, snapshot.key);
  assert.equal(archived.isDeleted, 0);
  assert.equal((await itemService.getById('a', item._id)).customFields.reference, 'ITEM');
  assert.equal(queueCount(), beforeEdits + 2, 'Rename and archive enqueue offline snapshots');
  await assert.rejects(() => definitions.createCustomField('a', { entity: snapshot.entity, label: 'Référence' }), /existe déjà/);
  await assert.rejects(() => definitions.updateCustomField('a', { id: snapshot._id, label: 'Archived' }), /archivé/);
  assert.equal(new model({ ...snapshot, createdAt: now, updatedAt: now }).validateSync(), undefined);
  assert(new model({ ...snapshot, key: 'constructor', createdAt: now, updatedAt: now }).validateSync());
  console.log('Passed: six entity definitions and persisted form values, duplicate/key validation, company isolation, additive migration, offline queue, sync acknowledgement/pull, document metadata isolation, posting retries, and server validation.');
} finally { sql.close(); }
