import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { URL } from 'node:url';
import console from 'node:console';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const sql = new DatabaseSync(':memory:');
let commitCallbacks = null;
const run = async (query, params = []) => sql.prepare(query).run(...params);
const all = async (query, params = []) => sql.prepare(query).all(...params);
const get = async (query, params = []) => sql.prepare(query).get(...params) ?? null;
const db = { run, all, get, runDirect: run, allDirect: all, getDirect: get,
  afterCommit: callback => commitCallbacks ? commitCallbacks.push(callback) : callback(),
  transaction: async callback => {
    if (commitCallbacks) return callback();
    sql.exec('BEGIN'); commitCallbacks = [];
    try { const value = await callback(); sql.exec('COMMIT');
      const callbacks = commitCallbacks; commitCallbacks = null; callbacks.forEach(fn => fn()); return value;
    } catch (error) { commitCallbacks = null; sql.exec('ROLLBACK'); throw error; }
  },
};
const tables = { inventory_document: 'inventory_documents', inventory_document_line: 'inventory_document_lines',
  inventory_movement: 'inventory_movements', inventory_balance: 'inventory_balances' };
const entities = { INVENTORY_SYNC_TABLES: tables, isInventorySyncEntity: value => Object.hasOwn(tables, value) };
const accepted = new Set();
let uploads = 0;
let loseResponse = false;
class Form { append(key, value) { this[key] = value; } getHeaders() { return {}; } }
const cache = new Map();
function load(relative) {
  const file = new URL(relative, import.meta.url);
  if (cache.has(file.href)) return cache.get(file.href);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, process: { env: {} },
    console: { log() {}, warn() {}, error() {} }, require: name => {
      if (name.endsWith('/db.js')) return db;
      if (name.endsWith('/InventorySync.js')) return entities;
      if (name.endsWith('/auth.js')) return { getToken: async () => 'test' };
      if (name === 'electron') return { app: { isPackaged: false }, BrowserWindow: { getAllWindows: () => [] } };
      if (name === 'form-data') return { default: Form };
      if (name === 'axios') return { default: { post: async (_url, form) => {
        uploads++;
        const entries = JSON.parse(form.items);
        for (const entry of entries) {
          assert.equal(entry.entity, 'inventory_transaction', 'Never upload stock as separate row snapshots');
          assert.equal(entry.companyId, 'a');
          assert.equal(entry.data.lines.length, 1); assert.equal(entry.data.movements.length, 1);
          accepted.add(entry.data._id); // Model idempotent server operation IDs.
        }
        if (loseResponse) { loseResponse = false; throw new Error('Lost response'); }
        return { data: { synced: entries.map(entry => entry.queueId) } };
      } } };
      if (name.startsWith('.') && /(?:inventoryPostingSync|sync)\.repository\.js$/.test(name)) return load(new URL(name.replace(/\.js$/, '.ts'), file).href);
      return {};
    },
  });
  cache.set(file.href, module.exports); return module.exports;
}
const pending = () => sql.prepare("SELECT * FROM sync_queue WHERE companyId = 'a' AND synced = 0").all();
function seed(company, id, complete = true) {
  sql.prepare('INSERT INTO inventory_documents VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, company, 'POSTED', 'MANUAL', 'RECEIPT', '2026-10-12', 0);
  if (!complete) return;
  sql.prepare('INSERT INTO inventory_document_lines VALUES (?, ?, ?, ?, ?, ?)').run(`${id}:line`, company, id, 1, '2026-10-12', 0);
  sql.prepare('INSERT INTO inventory_movements VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`${id}:move`, company, id, `${id}:line`, id, 'w', '', '', '', '2026-10-12', 0);
  sql.prepare('INSERT INTO inventory_balances (_id, companyId, itemId, warehouseId, locationId, lotId, serialNumber, updatedAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`${id}:balance`, company, id, 'w', '', '', '', '2026-10-12', 0);
}
try {
  sql.exec(`CREATE TABLE sync_queue (_id INTEGER PRIMARY KEY, companyId TEXT, entity TEXT, entityId TEXT, operation TEXT, payload TEXT, synced INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE inventory_sku_settings (companyId TEXT, createdAt TEXT, updatedAt TEXT, serverVersion INTEGER, synced INTEGER, isDeleted INTEGER);
    CREATE TABLE inventory_documents (_id TEXT PRIMARY KEY, companyId TEXT, status TEXT, referenceType TEXT, type TEXT, updatedAt TEXT, synced INTEGER);
    CREATE TABLE inventory_document_lines (_id TEXT PRIMARY KEY, companyId TEXT, documentId TEXT, lineNumber INTEGER, updatedAt TEXT, synced INTEGER);
    CREATE TABLE inventory_movements (_id TEXT PRIMARY KEY, companyId TEXT, documentId TEXT, documentLineId TEXT, itemId TEXT, warehouseId TEXT, locationId TEXT, lotId TEXT, serialNumber TEXT, updatedAt TEXT, synced INTEGER);
    CREATE TABLE inventory_balances (_id TEXT PRIMARY KEY, companyId TEXT, itemId TEXT, warehouseId TEXT, locationId TEXT, lotId TEXT, serialNumber TEXT, updatedAt TEXT, synced INTEGER);`);
  const triggers = load('../src/electron/database/schemas/modules/inventory/inventory_sync.schema.ts');
  await triggers.initializeInventorySync();
  seed('a', 'receipt'); seed('b', 'foreign');
  const repo = load('../src/electron/database/repositories/modules/inventory/inventoryPostingSync.repository.ts');
  const push = load('../src/electron/services/shared/sync/push.service.ts');
  await repo.recoverStockOperations('a');
  assert.equal(pending().length, 1);
  await triggers.initializeInventorySync(); // Startup backfills dirty source rows again.
  assert.equal(pending().length, 5);
  loseResponse = true;
  await assert.rejects(push.pushPendingChanges('a'), /Lost response/);
  assert.equal(pending().length, 1, 'Recovery retires duplicates even when an aggregate already exists');
  await push.pushPendingChanges('a');
  assert.equal(accepted.size, 1);
  assert.equal(pending().length, 0);
  for (const table of Object.values(tables)) {
    assert.equal(sql.prepare(`SELECT synced FROM ${table} WHERE companyId = 'a'`).get().synced, 1);
    assert.equal(sql.prepare(`SELECT synced FROM ${table} WHERE companyId = 'b'`).get().synced, 0);
  }
  await triggers.initializeInventorySync();
  assert.equal(pending().length, 0, 'Acknowledged stock is not resurrected after restart');
  sql.exec('ALTER TABLE inventory_balances ADD COLUMN serverVersion INTEGER DEFAULT 0; ALTER TABLE inventory_balances ADD COLUMN isDeleted INTEGER DEFAULT 0');
  const inventorySync = load('../src/electron/database/repositories/modules/inventory/inventorySync.repository.ts');
  const localBalance = sql.prepare("SELECT * FROM inventory_balances WHERE companyId = 'a'").get();
  await inventorySync.applyInventoryBatch('a', 'inventory_balance', [{ ...localBalance, _id: 'server-balance', serverVersion: 5 }]);
  assert.equal(sql.prepare("SELECT COUNT(*) AS total FROM inventory_balances WHERE companyId = 'a'").get().total, 1);
  assert.equal(sql.prepare("SELECT _id FROM inventory_balances WHERE companyId = 'a'").get()._id, 'server-balance');
  seed('a', 'incomplete', false);
  const calls = uploads;
  await assert.rejects(push.pushPendingChanges('a'), /réconciliation/);
  assert.equal(uploads, calls, 'Incomplete legacy records are not sent through snapshot upload');
  assert.equal(pending().length, 1, 'Incomplete legacy records remain recoverable');
  seed('a', 'rollback');
  sql.exec("CREATE TRIGGER reject_aggregate BEFORE INSERT ON sync_queue WHEN NEW.entity = 'inventory_transaction' BEGIN SELECT RAISE(ABORT, 'queue failure'); END");
  const before = JSON.stringify(pending());
  await assert.rejects(repo.recoverStockOperations('a'), /queue failure/);
  assert.equal(JSON.stringify(pending()), before, 'Failed aggregation preserves all snapshots');
  console.log('Passed: atomic stock upload, restart recovery, lost-response retry, acknowledgement cleanup, tenant isolation, incomplete-record retention and rollback.');
} finally { sql.close(); }
