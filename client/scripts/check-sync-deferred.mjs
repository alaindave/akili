// Node 22+: real SQLite transactions, mocked HTTP/Electron.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
import console from 'node:console';
import process from 'node:process';
const database = new DatabaseSync(':memory:');
const db = {
  all: async (sql, params = []) => database.prepare(sql).all(...params),
  get: async (sql, params = []) => database.prepare(sql).get(...params),
  run: async (sql, params = []) => database.prepare(sql).run(...params),
  transaction: async (callback) => {
    database.exec('BEGIN');
    try {
      const result = await callback();
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  },
};
let pages = [];
let requested = [];
let queue;
let state;
function load(file, expose = '', overrides = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.resolve(import.meta.dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source + expose, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, {
    module, exports: module.exports, Error, Date, setTimeout: callback => callback(),
    console: { log() {}, warn() {}, error() {} }, process: { env: { VITE_API_URL: 'http://test' } },
    require: (name) => {
      const override = Object.keys(overrides).find(key => name.endsWith(key));
      if (override) return overrides[override];
      if (name === 'electron') return { app: { isPackaged: false } };
      if (name.endsWith('/db.js')) return db;
      if (name.endsWith('/auth.js')) return { getToken: async () => 'token' };
      if (name.endsWith('/sync.repository.js')) return queue;
      if (name.endsWith('/syncState.repository.js')) return state;
      if (name.endsWith('/tasks.repository.js')) return {
        upsertTask: async (task) => db.run('INSERT OR REPLACE INTO applied VALUES (?)', [task._id]),
        markTaskSynced: async () => assert.fail('Failed comments must not acknowledge the task'),
      };
      if (name.endsWith('/tasks_comments.repository.js')) return {
        upsertTaskComment: async () => { throw new Error('Comment foreign key failure'); },
      };
      if (name === 'axios') return {
        get: async (_url, options) => {
          requested.push(options.params.afterVersion);
          const page = pages.shift();
          assert(page, 'Unexpected HTTP pull');
          return { data: page };
        },
      };
      return {};
    },
  });
  return module.exports;
}
const row = (_id, serverVersion) => ({ _id, companyId: 'a', serverVersion });
const page = (items, hasMore = false) => ({ items, nextVersion: items.at(-1)?.serverVersion, hasMore });
const enqueue = (companyId, entity, entityId, payload = '{}') => database.prepare(
  'INSERT INTO sync_queue (companyId, entity, entityId, payload) VALUES (?, ?, ?, ?)'
).run(companyId, entity, entityId, payload);
const reset = () => {
  database.exec('DELETE FROM sync_queue; DELETE FROM sync_state; DELETE FROM applied');
  requested = [];
};
const apply = async ([item]) => {
  await db.run('INSERT OR REPLACE INTO applied VALUES (?)', [item._id]);
  return true;
};
(async () => {
  database.exec(`CREATE TABLE sync_queue (_id INTEGER PRIMARY KEY, companyId TEXT, entity TEXT,
    entityId TEXT, payload TEXT, synced INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE sync_state (companyId TEXT, entity TEXT, lastPulledVersion INTEGER, updatedAt TEXT,
      PRIMARY KEY(companyId, entity));
    CREATE TABLE applied (_id TEXT PRIMARY KEY);`);
  queue = load('src/electron/database/repositories/shared/sync.repository.ts');
  state = load('src/electron/database/repositories/shared/syncState.repository.ts');
  const pull = load('src/electron/services/shared/sync/pull.service.ts', '\nexport { syncTasks };');

  await state.updateLastPulledVersion('a', 'task', 10);
  pages = [page([row('first', 11)], true), page([row('blocked', 12)], true), page([row('last', 13)])];
  const blocker = enqueue('a', 'task', 'blocked');
  await assert.rejects(() => pull.pullEntityByVersion('a', 'task', apply), (error) => {
    assert.match(error.message, /1 record\(s\) waiting for local changes, 0 import failure/);
    assert.match(error.message, new RegExp(`blocked: waiting.*queue ${blocker.lastInsertRowid}`));
    return true;
  });
  assert.deepEqual(requested, [10, 11, 12], 'Resume at saved cursor and continue unrelated rows');
  assert.equal((await state.getSyncState('a', 'task')).lastPulledVersion, 11);
  assert.deepEqual((await db.all('SELECT * FROM applied ORDER BY _id')).map(x => x._id), ['first', 'last']);
  database.exec('DELETE FROM sync_queue');
  pages = [page([row('blocked', 12), row('last', 13)])];
  await pull.pullEntityByVersion('a', 'task', apply);
  assert.equal(requested.at(-1), 11, 'Retry from before the blocked page');
  assert.equal((await state.getSyncState('a', 'task')).lastPulledVersion, 13);

  reset();
  pages = [page([row('bad', 1), row('good', 2)])];
  await assert.rejects(() => pull.pullEntityByVersion('a', 'task', async (items) => {
    await apply(items);
    return items[0]._id !== 'bad';
  }), /0 record\(s\) waiting for local changes, 1 import failure/);
  assert.deepEqual((await db.all('SELECT * FROM applied')).map(x => x._id), ['good'], 'False imports roll back');
  assert.equal((await state.getSyncState('a', 'task')).lastPulledVersion, 0);

  reset();
  pages = [page([{ ...row('task', 1), comments: [{ _id: 'comment' }] }])];
  await assert.rejects(() => pull.pullEntityByVersion('a', 'task', pull.syncTasks), /Comment foreign key failure/);
  assert.equal((await db.all('SELECT * FROM applied')).length, 0, 'Task write rolls back when its comment fails');

  reset();
  enqueue('other', 'task', 'shared');
  enqueue('a', 'task', 'unrelated');
  enqueue('a', 'task_comment', 'c1', JSON.stringify({ taskId: 'unrelated' }));
  pages = [page([row('shared', 1)])];
  await pull.pullEntityByVersion('a', 'task', apply);
  assert.equal((await db.all('SELECT * FROM applied')).length, 1, 'Other companies and unrelated edits do not block');
  enqueue('a', 'task_comment', 'c2', JSON.stringify({ taskId: 'shared' }));
  pages = [page([row('shared', 2)])];
  await assert.rejects(() => pull.pullEntityByVersion('a', 'task', apply), /waiting for local changes in queue/);

  reset();
  enqueue('a', 'inventory_transaction', 'doc');
  for (const entity of ['inventory_item', 'inventory_warehouse', 'inventory_location', 'inventory_category', 'inventory_unit', 'inventory_sku_settings']) {
    pages = [page([row(entity, 1)])];
    await pull.pullEntityByVersion('a', entity, apply);
    assert.equal((await state.getSyncState('a', entity)).lastPulledVersion, 1);
  }
  for (const entity of ['inventory_document', 'inventory_document_line', 'inventory_movement', 'inventory_balance']) {
    pages = [page([row(entity, 1)])];
    await assert.rejects(() => pull.pullEntityByVersion('a', entity, apply), /inventory_transaction/);
    assert.equal((await state.getSyncState('a', entity)).lastPulledVersion, 0);
  }

  reset();
  enqueue('a', 'company_logo', 'a');
  pages = [page([{ companyId: 'a', serverVersion: 1 }])];
  await assert.rejects(() => pull.pullEntityByVersion('a', 'company_logo', async () => true), /company_logo a: waiting/);
  database.exec('DELETE FROM sync_queue');
  pages = [page([{ companyId: 'a', serverVersion: 1 }])];
  await pull.pullEntityByVersion('a', 'company_logo', async () => true);
  assert.equal((await state.getSyncState('a', 'company_logo')).lastPulledVersion, 1);

  reset();
  await state.updateLastPulledVersion('a', 'employee', 90);
  pages = [page([row('employee', 4)])];
  await pull.pullEntityByVersion('a', 'employee', apply, 500, 'employee_photo');
  assert.deepEqual(requested, [0]);
  assert.equal((await state.getSyncState('a', 'employee')).lastPulledVersion, 90);
  await state.updateLastPulledVersion('a', 'employee_photo', 0);
  pages = [page([row('employee', 4)])];
  await pull.pullEntityByVersion('a', 'employee', apply, 500, 'employee_photo');
  assert.equal(requested.at(-1), 0, 'Explicit recovery reset still permits replay');

  const events = [];
  let pushAttempts = 0;
  let acceptRetry = false;
  const coordinator = load('src/electron/services/shared/sync/sync.service.ts', '', {
    electron: { app: { isPackaged: false }, BrowserWindow: { getAllWindows: () => [{
      isDestroyed: () => false, webContents: { send: (_channel, event) => events.push(event) },
    }] } },
    '/network.service.js': { NetworkService: { canReachBackend: async () => true } },
    '/payrollProfile.repository.js': { recoverPayrollProfileQueue: async () => {} },
    '/sync.repository.js': {
      getUnsyncedItems: async () => acceptRetry && pushAttempts > 1 ? [] : [{ _id: 'q1' }],
      notifyPendingChanges: async () => {},
    },
    '/push.service.js': { pushPendingChanges: async () => {
      pushAttempts++;
      return { pendingChanges: 1, failures: ['task blocked, queue q1: REVISION_CONFLICT'] };
    } },
    '/pull.service.js': { pullLatestChanges: async () => { throw new Error('task blocked: waiting for local changes'); } },
  });
  await coordinator.default('a');
  assert.match(events.at(-1).error, /REVISION_CONFLICT/);
  assert.match(events.at(-1).error, /waiting for local changes/);
  assert.equal(events.at(-1).pendingChanges, 1);
  acceptRetry = true;
  pushAttempts = 0;
  await coordinator.default('a');
  assert.equal(events.at(-1).error, 'task blocked: waiting for local changes', 'Resolved push errors must not be reported');
  console.log('Passed: saved cursors, partial-page retry, rollback, original errors, company isolation, related edits, inventory guards, logo IDs, and recovery cursors.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => database.close());
