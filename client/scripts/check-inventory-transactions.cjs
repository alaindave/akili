// Run with Node 22+: node scripts/check-inventory-transactions.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const sql = new DatabaseSync(':memory:');
let queue = Promise.resolve();
const enqueue = (fn) => { const next = queue.catch(() => {}).then(fn); queue = next.catch(() => {}); return next; };
const runDirect = async (query, params = []) => sql.prepare(query).run(...params);
const getDirect = async (query, params = []) => sql.prepare(query).get(...params) ?? null;
const allDirect = async (query, params = []) => sql.prepare(query).all(...params);
const db = { runDirect, getDirect, allDirect,
  run: (query, params) => enqueue(() => runDirect(query, params)),
  get: (query, params) => enqueue(() => getDirect(query, params)),
  all: (query, params) => enqueue(() => allDirect(query, params)),
  transaction: (callback) => enqueue(async () => {
    sql.exec('BEGIN');
    try { const result = await callback(); sql.exec('COMMIT'); return result; }
    catch (error) { sql.exec('ROLLBACK'); throw error; }
  }),
};
const cache = new Map();
function load(file) {
  file = path.resolve(__dirname, '../src', file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Buffer, Date, console,
    require: (name) => name.endsWith('/db.js') ? db : name.startsWith('.') ?
      load(path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts'))) : require(name),
  });
  cache.set(file, module.exports);
  return module.exports;
}
const now = new Date().toISOString();
function insert(table, values) {
  const record = { createdAt: now, updatedAt: now, synced: 1, ...values };
  sql.prepare(`INSERT INTO ${table} (${Object.keys(record).join(',')}) VALUES (${Object.keys(record).map(() => '?').join(',')})`).run(...Object.values(record));
}
const draft = (type = 'RECEIPT', patch = {}) => ({ requestId: randomUUID(), type, date: now, reference: 'REF-123', reason: 'Test stock',
  warehouseId: 'w1', lines: [{ itemId: 'item', quantity: 10, unitCost: 5 }], ...patch });
const balance = (warehouse = 'w1', location = '') => sql.prepare("SELECT * FROM inventory_balances WHERE companyId = 'a' AND itemId = 'item' AND warehouseId = ? AND locationId = ?").get(warehouse, location);
const snapshot = () => JSON.stringify(['inventory_documents', 'inventory_document_lines', 'inventory_movements', 'inventory_balances', 'sync_queue']
  .map(table => sql.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));

(async () => {
  // Model an existing database: the current fresh category schema references a
  // missing `code` column in its UNIQUE constraint (unrelated to stock posting).
  sql.exec(`CREATE TABLE inventory_categories (_id TEXT PRIMARY KEY, companyId TEXT, code TEXT, name TEXT,
    parentId TEXT, isActive INTEGER DEFAULT 1, customFields TEXT, createdAt TEXT, updatedAt TEXT,
    serverVersion INTEGER DEFAULT 0, synced INTEGER DEFAULT 1, isDeleted INTEGER DEFAULT 0);`);
  await load('electron/database/schemas/modules/inventory/inventory_items.schema.ts').createInventoryItemsTable();
  await load('electron/database/schemas/modules/inventory/inventory_warehouses.schema.ts').createInventoryWarehouseTable();
  await load('electron/database/schemas/modules/inventory/inventory_movements.schema.ts').createInventoryMovementsTables();
  sql.exec(`CREATE TABLE sync_queue (id INTEGER PRIMARY KEY, companyId TEXT, entity TEXT, entityId TEXT, operation TEXT, payload TEXT, synced INTEGER DEFAULT 0);`);
  await load('electron/database/schemas/modules/inventory/inventory_sync.schema.ts').initializeInventorySync();
  for (const companyId of ['a', 'b']) {
    insert('inventory_units', { _id: `unit-${companyId}`, companyId, code: 'PCS', name: 'Pièce', category: 'QUANTITY', decimalPlaces: 0, isBaseUnit: 1 });
    insert('inventory_items', { _id: companyId === 'a' ? 'item' : 'foreign-item', companyId, sku: 'SKU', name: 'Article', itemType: 'RAW_MATERIAL', baseUnitId: `unit-${companyId}`, trackingMethod: 'NONE', costingMethod: 'AVERAGE' });
    insert('inventory_warehouses', { _id: companyId === 'a' ? 'w1' : 'foreign-warehouse', companyId, code: 'W1', name: 'Source', type: 'GENERAL' });
  }
  insert('inventory_warehouses', { _id: 'w2', companyId: 'a', code: 'W2', name: 'Destination', type: 'GENERAL' });
  insert('inventory_locations', { _id: 'bin', companyId: 'a', warehouseId: 'w2', code: 'B1', name: 'Bin', locationType: 'BIN' });
  const { inventoryTransactionService: service } = load('electron/services/modules/inventory/inventoryTransaction.service.ts');
  const post = async input => {
    const result = await service.post('a', 'responsible', input);
    const saved = sql.prepare('SELECT * FROM inventory_documents WHERE _id = ?').get(result.documentId);
    const posted = new Date(saved.postedAt);
    const pad = value => String(value).padStart(2, '0');
    const prefixes = { RECEIPT: 'ENT', ISSUE: 'SOR', TRANSFER: 'TRA', ADJUSTMENT: 'ADJ' };
    const expectedPrefix = `${prefixes[input.type]}-${pad(posted.getDate())}${pad(posted.getMonth() + 1)}${pad(posted.getFullYear() % 100)}-${pad(posted.getHours())}${pad(posted.getMinutes())}-`;
    assert.equal(result.documentNumber.slice(0, -4), expectedPrefix);
    const suffix = result.documentNumber.slice(-4);
    assert.match(suffix, /^\d{4}$/);
    assert.ok(Number(suffix) >= 1 && Number(suffix) <= 1000);
    assert.equal(result.documentNumber, saved.documentNumber);
    return result;
  };
  const receipt = draft();
  const result = await post(receipt);
  assert.equal(balance().quantityOnHand, 10);
  assert.equal(balance().totalValue, 50);
  const document = sql.prepare('SELECT * FROM inventory_documents WHERE _id = ?').get(result.documentId);
  assert.equal(document.postedBy, 'responsible');
  assert.equal(document.referenceId, 'REF-123');
  assert.equal(document.reason, 'Test stock');
  assert.equal(document.documentDate, now);
  assert.equal(document.status, 'POSTED');
  const first = snapshot();
  await Promise.all([post(receipt), post(receipt)]);
  assert.equal(snapshot(), first, 'Retries never apply the transaction twice');
  await assert.rejects(post({ ...receipt, reason: 'changed' }), /déjà/);
  await assert.rejects(service.post('a', 'different-user', receipt), /déjà/);
  await assert.rejects(post({ ...draft(), postedBy: 'forged-user' }));
  sql.exec(`CREATE TEMP TRIGGER fail_transaction_movement BEFORE INSERT ON inventory_movements
    WHEN NEW.referenceId = 'FAIL' BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END;`);
  await assert.rejects(post(draft('RECEIPT', { reference: 'FAIL' })), /simulated write failure/);
  assert.equal(snapshot(), first, 'A failed movement write rolls back the document, line, balance, and sync triggers');
  sql.exec('DROP TRIGGER fail_transaction_movement');
  await post(draft('RECEIPT', { lines: [{ itemId: 'item', quantity: 10, unitCost: 15 }] }));
  assert.equal(balance().averageCost, 10);
  await post(draft('ISSUE', { lines: [{ itemId: 'item', quantity: 2 }] }));
  assert.equal(balance().quantityOnHand, 18);
  assert.equal(balance().totalValue, 180);
  const transfer = await post(draft('TRANSFER', { destinationWarehouseId: 'w2', destinationLocationId: 'bin', lines: [{ itemId: 'item', quantity: 4 }] }));
  assert.equal(balance().quantityOnHand, 14);
  assert.equal(balance('w2', 'bin').quantityOnHand, 4);
  assert.equal(balance('w2', 'bin').totalValue, 40);
  const moves = sql.prepare('SELECT * FROM inventory_movements WHERE documentId = ? ORDER BY direction').all(transfer.documentId);
  assert.equal(moves.length, 2);
  assert.deepEqual(moves.map(row => row.direction), ['IN', 'OUT']);
  assert.equal(moves[0].quantity, moves[1].quantity);
  assert.equal(moves[0].totalCost, moves[1].totalCost);
  assert.equal(moves[0].locationId, 'bin');
  await post(draft('TRANSFER', { warehouseId: 'w2', locationId: 'bin', destinationWarehouseId: 'w2', lines: [{ itemId: 'item', quantity: 1 }] }));
  assert.equal(balance('w2', 'bin').quantityOnHand, 3);
  assert.equal(balance('w2').quantityOnHand, 1);
  await post(draft('ADJUSTMENT', { adjustmentDirection: 'OUT', lines: [{ itemId: 'item', quantity: 1 }] }));
  await post(draft('ADJUSTMENT', { adjustmentDirection: 'IN', lines: [{ itemId: 'item', quantity: 1, unitCost: 10 }] }));
  assert.equal(balance().quantityOnHand, 14);
  sql.exec("UPDATE inventory_balances SET quantityReserved = 13, quantityAvailable = 1 WHERE warehouseId = 'w1'");
  for (const invalid of [
    draft('ISSUE', { lines: [{ itemId: 'item', quantity: 2 }] }),
    draft('TRANSFER', { destinationWarehouseId: 'w1' }),
    draft('TRANSFER', { destinationWarehouseId: 'foreign-warehouse' }),
    draft('RECEIPT', { locationId: 'bin' }),
    draft('RECEIPT', { lines: [{ itemId: 'foreign-item', quantity: 1, unitCost: 2 }] }),
    draft('RECEIPT', { lines: [{ itemId: 'item', quantity: 1, unitCost: 2 }, { itemId: 'missing', quantity: 1, unitCost: 2 }] }),
    ...[0, -1, Infinity, 0.5].map(quantity => draft('RECEIPT', { lines: [{ itemId: 'item', quantity, unitCost: 1 }] })),
  ]) {
    const before = snapshot();
    await assert.rejects(post(invalid));
    assert.equal(snapshot(), before, 'Failed posting rolls back stock, documents, movements, and sync queue');
  }
  const simultaneous = await Promise.allSettled([
    post(draft('ISSUE', { lines: [{ itemId: 'item', quantity: 1 }] })),
    post(draft('ISSUE', { lines: [{ itemId: 'item', quantity: 1 }] })),
  ]);
  assert.equal(simultaneous.filter(result => result.status === 'fulfilled').length, 1, 'Concurrent issues cannot consume reserved stock');
  insert('inventory_items', { _id: 'serial-item', companyId: 'a', sku: 'SER', name: 'Serial', itemType: 'COMPONENT', baseUnitId: 'unit-a', trackingMethod: 'SERIAL' });
  await assert.rejects(post(draft('RECEIPT', { lines: [{ itemId: 'serial-item', quantity: 2, serialNumber: 'S1', unitCost: 1 }] })), /série/);
  const serialLine = { itemId: 'serial-item', quantity: 1, serialNumber: 'S1', unitCost: 1 };
  await post(draft('RECEIPT', { lines: [serialLine] }));
  await assert.rejects(post(draft('RECEIPT', { warehouseId: 'w2', lines: [serialLine] })), /déjà en stock/);
  await post(draft('TRANSFER', { destinationWarehouseId: 'w2', lines: [serialLine] }));
  assert.equal(sql.prepare("SELECT COUNT(*) AS count FROM inventory_balances WHERE serialNumber = 'S1' AND quantityOnHand > 0").get().count, 1);
  insert('inventory_items', { _id: 'lot-item', companyId: 'a', sku: 'LOT', name: 'Lot', itemType: 'COMPONENT', baseUnitId: 'unit-a', trackingMethod: 'LOT' });
  await assert.rejects(post(draft('RECEIPT', { lines: [{ itemId: 'lot-item', quantity: 1, unitCost: 1 }] })), /lot obligatoire/);
  await post(draft('RECEIPT', { lines: [{ itemId: 'lot-item', quantity: 1, unitCost: 1, lotId: 'L1' }] }));
  await post(draft('RECEIPT', { warehouseId: 'w2', locationId: 'bin', lines: [{ itemId: 'lot-item', quantity: 10, unitCost: 3, lotId: 'OPENING-LOT' }] }));
  sql.exec("UPDATE inventory_balances SET quantityReserved = 2, quantityAvailable = 8 WHERE lotId = 'OPENING-LOT'");
  const issueLot = draft('ISSUE', { warehouseId: 'w2', locationId: 'bin', lines: [{ itemId: 'lot-item', quantity: 8, lotId: 'OPENING-LOT' }] });
  await assert.rejects(post({ ...issueLot, lines: [{ ...issueLot.lines[0], lotId: 'wrong-lot' }] }), /aucun stock/);
  await assert.rejects(post({ ...issueLot, lines: [{ ...issueLot.lines[0], quantity: 9 }] }), /8 disponible, 2 réservé, 9 demandé/);
  await post(issueLot);
  const issuedLot = sql.prepare("SELECT * FROM inventory_balances WHERE lotId = 'OPENING-LOT'").get();
  assert.equal(issuedLot.quantityOnHand, 2);
  assert.equal(issuedLot.quantityReserved, 2);
  assert.equal(issuedLot.totalValue, 6);
  // Chlore scenario: an older deleted unlocated lot must not hide the active located lot.
  sql.exec("UPDATE inventory_balances SET isDeleted = 1 WHERE lotId = 'L1'");
  await post(draft('RECEIPT', { warehouseId: 'w2', locationId: 'bin', lines: [{ itemId: 'lot-item', quantity: 16, unitCost: 3, lotId: 'LOT20260293' }] }));
  await post(draft('ISSUE', { warehouseId: 'w2', locationId: 'bin', lines: [{ itemId: 'lot-item', quantity: 5, lotId: 'LOT20260293' }] }));
  assert.equal(sql.prepare("SELECT quantityOnHand FROM inventory_balances WHERE lotId = 'LOT20260293'").get().quantityOnHand, 11);
  sql.exec("UPDATE inventory_items SET costingMethod = 'FIFO' WHERE _id = 'item'");
  await assert.rejects(post(draft()), /FIFO/);
  insert('inventory_units', { _id: 'decimal-unit', companyId: 'a', code: 'KG', name: 'Kilogramme', category: 'WEIGHT', decimalPlaces: 3, isBaseUnit: 1 });
  insert('inventory_items', { _id: 'decimal-item', companyId: 'a', sku: 'DEC', name: 'Decimal', itemType: 'RAW_MATERIAL', baseUnitId: 'decimal-unit', trackingMethod: 'NONE' });
  await post(draft('RECEIPT', { lines: [{ itemId: 'decimal-item', quantity: 0.3, unitCost: 10 }] }));
  sql.exec("UPDATE inventory_balances SET quantityReserved = 0.2, quantityAvailable = 0.1 WHERE itemId = 'decimal-item'");
  await post(draft('ISSUE', { lines: [{ itemId: 'decimal-item', quantity: 0.1 }] }));
  assert.equal(sql.prepare("SELECT quantityOnHand FROM inventory_balances WHERE itemId = 'decimal-item'").get().quantityOnHand, 0.2);
  const multi = draft('RECEIPT', { lines: [{ itemId: 'decimal-item', quantity: 1, unitCost: 10 }, { itemId: 'decimal-item', quantity: 1, unitCost: 10 }] });
  await post(multi);
  const times = sql.prepare("SELECT json_extract(payload, '$.updatedAt') AS updatedAt FROM sync_queue WHERE entity = 'inventory_balance' AND json_extract(payload, '$.itemId') = 'decimal-item' ORDER BY id DESC LIMIT 2").all();
  assert(times[0].updatedAt > times[1].updatedAt, 'Successive balance snapshots have increasing sync timestamps');
  assert.equal(sql.prepare("SELECT COUNT(*) AS count FROM inventory_documents WHERE companyId = 'b'").get().count, 0);
  for (const entity of ['inventory_document', 'inventory_document_line', 'inventory_movement', 'inventory_balance']) {
    assert(sql.prepare('SELECT 1 FROM sync_queue WHERE companyId = ? AND entity = ?').get('a', entity), `${entity} queued for sync`);
  }
  console.log('Passed: receipts, issues, transfers, adjustments, valuation, tracking, tenant isolation, rollback, sync queue, retries, and concurrent stock protection.');
  sql.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
