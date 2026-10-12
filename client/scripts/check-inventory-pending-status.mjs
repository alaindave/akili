import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { URL } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import console from 'node:console';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const sql = new DatabaseSync(':memory:');
const requireModule = createRequire(import.meta.url);
const events = [];
let callbacks = null;
const run = async (query, params = []) => sql.prepare(query).run(...params);
const all = async (query, params = []) => sql.prepare(query).all(...params);
const db = {
  run, runDirect: run, all, allDirect: all,
  get: async (query, params = []) => sql.prepare(query).get(...params) ?? null,
  getDirect: async (query, params = []) => sql.prepare(query).get(...params) ?? null,
  afterCommit: callback => callbacks ? callbacks.push(callback) : callback(),
  transaction: async callback => {
    if (callbacks) return callback();
    sql.exec('BEGIN'); callbacks = [];
    try {
      const value = await callback(); sql.exec('COMMIT');
      const notify = callbacks; callbacks = null;
      notify.forEach(fn => fn());
      return value;
    } catch (error) { callbacks = null; sql.exec('ROLLBACK'); throw error; }
  },
};
const cache = new Map();
function load(relative) {
  const file = new URL(relative, import.meta.url);
  if (cache.has(file.href)) return cache.get(file.href);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports,
    console: { log() {}, error(error) { throw error; } },
    require: name => {
      if (name.endsWith('/db.js')) return db;
      if (name === 'electron') return { BrowserWindow: { getAllWindows: () => [{
        isDestroyed: () => false, webContents: { send: (channel, payload) => events.push({ channel, ...payload }) },
      }] } };
      if (!name.startsWith('.')) return requireModule(name);
      return load(new URL(name.replace(/\.js$/, '.ts'), file).href);
    },
  });
  cache.set(file.href, module.exports);
  return module.exports;
}

try {
  await load('../src/electron/database/schemas/modules/inventory/inventory_items.schema.ts').createInventoryItemsTable();
  await load('../src/electron/database/schemas/modules/inventory/inventory_warehouses.schema.ts').createInventoryWarehouseTable();
  await load('../src/electron/database/schemas/modules/inventory/inventory_movements.schema.ts').createInventoryMovementsTables();
  sql.exec(`CREATE TABLE sync_queue (_id INTEGER PRIMARY KEY, companyId TEXT, entity TEXT, entityId TEXT,
    operation TEXT, payload TEXT, synced INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);`);
  await load('../src/electron/database/schemas/modules/inventory/inventory_sync.schema.ts').initializeInventorySync();
  const { InventoryItemRepository } = load('../src/electron/database/repositories/modules/inventory/inventoryItem.repository.ts');
  const repo = new InventoryItemRepository();
  const now = new Date().toISOString();
  const item = { _id: 'item', companyId: 'a', sku: 'SKU', name: 'Original', itemType: 'RAW_MATERIAL',
    baseUnitId: 'unit', trackingMethod: 'NONE', isActive: true, createdAt: now, updatedAt: now,
    serverVersion: 0, synced: false, isDeleted: false };
  await repo.create(item);
  await setImmediate();
  assert.equal(events.at(-1).channel, 'sync:pending-changes');
  assert.equal(events.at(-1).pendingChanges, 1);
  await repo.update({ ...item, name: 'Edited' });
  await setImmediate();
  assert.equal(events.at(-1).pendingChanges, 2, 'Editing refreshes the navbar without starting sync');
  const count = events.length;
  await assert.rejects(db.transaction(async () => {
    await repo.update({ ...item, name: 'Rolled back' });
    await setImmediate();
    assert.equal(events.length, count, 'No notification before commit');
    throw new Error('rollback');
  }), /rollback/);
  await setImmediate();
  assert.equal(events.length, count, 'Rolled-back edits never notify');
  assert.equal((await repo.getById('a', 'item')).name, 'Edited');
  await db.transaction(async () => {
    await repo.update({ ...item, name: 'Committed' });
    assert.equal(events.length, count);
  });
  await setImmediate();
  assert.equal(events.at(-1).pendingChanges, 3);
  await repo.create({ ...item, _id: 'other-company', companyId: 'b' });
  await setImmediate();
  assert.equal(events.at(-1).companyId, 'b');
  assert.equal(events.at(-1).pendingChanges, 1, 'Counts stay company scoped');
  await repo.deactivate('a', 'item', now);
  await setImmediate();
  assert.equal(events.at(-1).companyId, 'a');
  assert.equal(events.at(-1).pendingChanges, 4);
  await repo.softDelete('a', 'item', now);
  await setImmediate();
  assert.equal(events.at(-1).pendingChanges, 5);
  const sync = load('../src/electron/database/repositories/shared/sync.repository.ts');
  await sync.markManySynced('a', (await sync.getUnsyncedItems('a')).map(entry => entry._id));
  assert.equal(events.at(-1).pendingChanges, 0, 'Acknowledgements clear the navbar count');
  async function change(entity, action) {
    const before = (await sync.getUnsyncedItems('a')).length;
    const eventCount = events.length;
    const result = await action();
    await setImmediate();
    const pending = await sync.getUnsyncedItems('a');
    assert.equal(pending.length, before + 1, `${entity} creates one pending operation`);
    assert(events.length > eventCount, `${entity} refreshes the navbar`);
    assert.equal(events.at(-1).companyId, 'a');
    assert.equal(events.at(-1).pendingChanges, pending.length);
    assert.equal(pending.at(-1).entity, entity);
    return result;
  }
  const { InventoryWarehouseRepository } = load('../src/electron/database/repositories/modules/inventory/inventoryWarehouse.repository.ts');
  const { InventoryLocationRepository } = load('../src/electron/database/repositories/modules/inventory/inventoryLocation.repository.ts');
  const warehouses = new InventoryWarehouseRepository();
  const locations = new InventoryLocationRepository();
  const warehouseInput = { code: 'W1', name: 'Warehouse', type: 'GENERAL', isActive: true };
  const warehouse = await change('inventory_warehouse', () => warehouses.create('a', warehouseInput));
  await change('inventory_warehouse', () => warehouses.update('a', warehouse._id, { ...warehouseInput, name: 'Updated' }));
  const locationInput = { warehouseId: warehouse._id, code: 'B1', name: 'Bin', locationType: 'BIN', isActive: true };
  const location = await change('inventory_location', () => locations.create('a', locationInput));
  await change('inventory_location', () => locations.update('a', location._id, { ...locationInput, name: 'Updated bin' }));
  const beforeFailure = events.length;
  await assert.rejects(warehouses.create('a', warehouseInput));
  await setImmediate();
  assert.equal(events.length, beforeFailure, 'Failed warehouse creation never notifies');
  await assert.rejects(db.transaction(async () => {
    await warehouses.create('a', { ...warehouseInput, code: 'ROLLBACK' });
    await locations.update('a', location._id, { ...locationInput, name: 'Rollback' });
    throw new Error('rollback');
  }), /rollback/);
  await setImmediate();
  assert.equal(events.length, beforeFailure, 'Warehouse and location rollback never notifies');
  const settings = load('../src/electron/database/repositories/modules/inventory/stockSettings.repository.ts');
  await change('inventory_category', () => settings.saveStockCategory('a', { code: 'CAT', name: 'Category', isActive: true }));
  const category = (await settings.getStockSettings('a')).categories[0];
  await change('inventory_category', () => settings.saveStockCategory('a', { id: category._id, code: 'CAT', name: 'Updated category', isActive: true }));
  await change('inventory_category', () => settings.archiveStockCategory('a', category._id));
  await change('inventory_unit', () => settings.saveStockUnit('a', { code: 'KG', name: 'Kilogram', category: 'WEIGHT', decimalPlaces: 2 }));
  const unit = (await settings.getStockSettings('a')).units[0];
  await change('inventory_unit', () => settings.saveStockUnit('a', { id: unit._id, code: 'KG', name: 'Kilograms', category: 'WEIGHT', decimalPlaces: 2 }));
  await change('inventory_unit', () => settings.archiveStockUnit('a', unit._id));
  await change('inventory_sku_settings', () => settings.saveSkuNumbering('a', { enabled: true }));
  const catalog = load('../src/electron/database/repositories/modules/inventory/inventoryCatalog.repository.ts');
  const stockUnit = await change('inventory_unit', () => catalog.createInventoryUnit('a', { code: 'PCS', name: 'Piece', category: 'QUANTITY', decimalPlaces: 0 }));
  await change('inventory_item', () => repo.create({ ...item, _id: 'stock-item', sku: 'STOCK', baseUnitId: stockUnit._id }));
  const { inventoryTransactionService } = load('../src/electron/services/modules/inventory/inventoryTransaction.service.ts');
  const draft = { requestId: randomUUID(), type: 'RECEIPT', date: now, reference: '', reason: 'Test', warehouseId: warehouse._id,
    locationId: location._id, lines: [{ itemId: 'stock-item', quantity: 10, unitCost: 5 }] };
  await change('inventory_transaction', () => inventoryTransactionService.post('a', 'admin', draft));
  await change('inventory_transaction', () => inventoryTransactionService.post('a', 'admin', { ...draft, requestId: randomUUID(), type: 'ISSUE', lines: [{ itemId: 'stock-item', quantity: 2 }] }));
  const balance = await db.get("SELECT quantityOnHand FROM inventory_balances WHERE companyId = 'a'");
  assert.equal(balance.quantityOnHand, 8);
  assert(!(await sync.getUnsyncedItems('a')).some(entry => ['inventory_balance', 'inventory_movement', 'inventory_document_line'].includes(entry.entity)), 'Stock rows stay within complete operations');
  console.log('Passed: items, warehouse/location creates and edits, category/unit saves and archives, SKU settings, receipts/issues, stock balances, company isolation and commit/rollback notifications.');
} finally { sql.close(); }
