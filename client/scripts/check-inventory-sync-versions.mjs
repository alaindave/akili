import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const sql = new DatabaseSync(':memory:');
const run = async (query, params = []) => sql.prepare(query).run(...params);
const all = async (query, params = []) => sql.prepare(query).all(...params);
const db = { run, runDirect: run, all, allDirect: all,
  getDirect: async (query, params = []) => sql.prepare(query).get(...params),
  transaction: async callback => {
    sql.exec('BEGIN');
    try { const result = await callback(); sql.exec('COMMIT'); return result; }
    catch (error) { sql.exec('ROLLBACK'); throw error; }
  },
};
const entities = { INVENTORY_SYNC_TABLES: { inventory_item: 'inventory_items' }, isInventorySyncEntity: entity => entity === 'inventory_item' };
function load(relative, resolver) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: resolver, Date, Error,
    process: { env: {} }, console: { log() {}, warn() {}, error() {} } });
  return module.exports;
}
const resolve = name => name.endsWith('/db.js') ? db : entities;
const repo = load('../src/electron/database/repositories/modules/inventory/inventorySync.repository.ts', resolve);
const triggers = load('../src/electron/database/schemas/modules/inventory/inventory_sync.schema.ts', resolve);
const pending = () => sql.prepare('SELECT * FROM sync_queue WHERE companyId = ? AND synced = 0 ORDER BY _id').all('a');
const row = () => sql.prepare('SELECT * FROM inventory_items WHERE _id = ?').get('item');
const edit = name => sql.prepare('UPDATE inventory_items SET name = ?, synced = 0 WHERE _id = ?').run(name, 'item');
let remote = { _id: 'item', companyId: 'a', name: 'original', serverVersion: 7 };
let inFlightEdit = false;
let invalidVersion = false;
class Form { append(key, value) { this[key] = value; } getHeaders() { return {}; } }
const push = load('../src/electron/services/shared/sync/push.service.ts', name => {
  if (name.endsWith('/InventorySync.js')) return entities;
  if (name.endsWith('/inventorySync.repository.js')) return repo;
  if (name.endsWith('/auth.js')) return { getToken: async () => 'test' };
  if (name === 'electron') return { app: { isPackaged: false } };
  if (name === 'form-data') return { default: Form };
  if (name.endsWith('/sync.repository.js')) return {
    getUnsyncedItems: async () => pending(),
    markManySynced: async (company, ids) => {
      for (const id of ids) sql.prepare('UPDATE sync_queue SET synced = 1 WHERE companyId = ? AND _id = ?').run(company, id);
    },
  };
  if (name === 'axios') return { default: { post: async (_url, form) => {
    const items = JSON.parse(form.items);
    assert.equal(items.length, 1, 'Only one revision of a record is sent at once');
    const { data, queueId } = items[0];
    if (inFlightEdit) { inFlightEdit = false; edit('during upload'); }
    if (data.name !== remote.name && data.serverVersion !== remote.serverVersion) {
      return { data: { synced: [], failed: [{ queueId, code: 'REVISION_CONFLICT', details: { remote } }] } };
    }
    if (data.name !== remote.name) remote = { ...data, serverVersion: remote.serverVersion + 1 };
    return { data: { synced: [queueId], versions: invalidVersion ? {} : { [queueId]: remote.serverVersion } } };
  } } };
  return {};
});

try {
  sql.exec(`CREATE TABLE inventory_items (_id TEXT PRIMARY KEY, companyId TEXT, name TEXT, serverVersion INTEGER, synced INTEGER, isDeleted INTEGER DEFAULT 0);
    CREATE TABLE inventory_sku_settings (companyId TEXT, createdAt TEXT, updatedAt TEXT, serverVersion INTEGER, synced INTEGER, isDeleted INTEGER);
    CREATE TABLE sync_queue (_id INTEGER PRIMARY KEY AUTOINCREMENT, companyId TEXT, entity TEXT, entityId TEXT, operation TEXT, payload TEXT, synced INTEGER DEFAULT 0);`);
  await triggers.initializeInventorySync();
  await triggers.initializeInventorySync(); // Existing installations upgrade safely.
  sql.exec("INSERT INTO inventory_items VALUES ('item', 'a', 'original', 7, 1, 0)");
  edit('first'); edit('second');
  await push.pushPendingChanges('a');
  assert.equal(row().name, 'second');
  assert.equal(row().synced, 0);
  assert.equal(row().serverVersion, 8);
  assert.equal(pending().length, 1, 'Version metadata must not create extra queue entries');
  assert.equal(JSON.parse(pending()[0].payload).serverVersion, 8);
  await push.pushPendingChanges('a');
  assert.equal(row().synced, 1);
  assert.equal(row().serverVersion, 9);
  assert.equal(pending().length, 0);
  edit('third'); inFlightEdit = true;
  await push.pushPendingChanges('a');
  assert.equal(row().name, 'during upload');
  assert.equal(row().synced, 0);
  await push.pushPendingChanges('a');
  assert.equal(remote.name, 'during upload');
  assert.equal(row().synced, 1);

  // A missing version cannot retire a snapshot. An idempotent retry recovers it.
  edit('retry'); invalidVersion = true;
  await assert.rejects(push.pushPendingChanges('a'), /Invalid inventory acknowledgement/);
  assert.equal(pending().length, 1);
  invalidVersion = false;
  await push.pushPendingChanges('a');
  assert.equal(pending().length, 0);

  edit('atomic acknowledgement');
  const priorVersion = row().serverVersion;
  sql.exec("CREATE TRIGGER fail_ack BEFORE UPDATE ON sync_queue WHEN NEW.synced = 1 BEGIN SELECT RAISE(ABORT, 'simulated acknowledgement failure'); END");
  await assert.rejects(push.pushPendingChanges('a'), /simulated acknowledgement failure/);
  assert.equal(row().serverVersion, priorVersion, 'Revision update rolls back with queue acknowledgement');
  assert.equal(pending().length, 1);
  sql.exec('DROP TRIGGER fail_ack');
  await push.pushPendingChanges('a');
  assert.equal(pending().length, 0);

  // Emulate the old client accepting a snapshot but losing its returned version.
  edit('legacy accepted');
  const legacy = pending()[0];
  remote = { ...JSON.parse(legacy.payload), serverVersion: remote.serverVersion + 1 };
  sql.prepare('UPDATE sync_queue SET synced = 1 WHERE _id = ?').run(legacy._id);
  sql.exec("UPDATE inventory_items SET synced = 1 WHERE _id = 'item'");
  edit('legacy next');
  await push.pushPendingChanges('a');
  assert.equal(row().serverVersion, remote.serverVersion, 'Proven lost acknowledgement is repaired');
  assert.equal(pending().length, 1);
  await push.pushPendingChanges('a');
  assert.equal(remote.name, 'legacy next');

  edit('local change');
  remote = { ...remote, name: 'other device', serverVersion: remote.serverVersion + 1 };
  const before = JSON.stringify(pending());
  await push.pushPendingChanges('a');
  assert.equal(JSON.stringify(pending()), before, 'Real conflicts retain the local snapshot and base');
  assert.equal(remote.name, 'other device');
  await repo.recoverInventoryAcknowledgement('b', 'inventory_item', JSON.parse(pending()[0].payload), remote);
  assert.equal(JSON.stringify(pending()), before, 'Recovery is company scoped');
  console.log('Passed: sequential edits, in-flight edits, revision persistence, trigger upgrades, safe retries, legacy recovery, genuine conflicts and company isolation.');
} catch (error) { console.error(error); process.exitCode = 1; }
finally { sql.close(); }
