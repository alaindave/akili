// Run with Node 22.13+: node scripts/check-task-modules.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');
const adapter = {
  run: async (sql, params = []) => db.prepare(sql).run(...params),
  all: async (sql, params = []) => db.prepare(sql).all(...params),
  get: async (sql, params = []) => db.prepare(sql).get(...params) ?? null,
};
adapter.runDirect = adapter.run;
adapter.getDirect = adapter.get;
adapter.transaction = async (callback) => {
  db.exec('BEGIN');
  try { const result = await callback(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
};
function load(relativePath) {
  const filename = path.resolve(__dirname, '../src/electron/database', relativePath);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => {
    if (name === '../../db.js') return adapter;
    if (name === '../../incidentNumber.js') return load('incidentNumber.ts');
    if (name === './tasks_comments.repository.js') return { getTaskCommentsWithAuthor: async () => [] };
    if (name === './sync.repository.js') return load('repositories/shared/sync.repository.ts');
    if (name === 'electron') return { BrowserWindow: { getAllWindows: () => [] } };
    return require(name);
  };
  vm.runInNewContext(code, { require: localRequire, module, exports: module.exports }, { filename });
  return module.exports;
}

(async () => {
  const { createTasksTables } = load('schemas/shared/tasks.schema.ts');
  await load('schemas/shared/sync.schema.ts').createSyncTable();
  db.exec("CREATE TABLE admin_users (_id TEXT PRIMARY KEY, companyId TEXT, firstName TEXT, lastName TEXT, email TEXT, role TEXT)");
  db.exec("INSERT INTO admin_users VALUES ('user-1', 'company-a', 'Alice', 'Test', 'alice@example.com', 'ADMIN')");
  await createTasksTables();
  await createTasksTables();
  const repo = load('repositories/shared/tasks.repository.ts');
  const sync = load('repositories/shared/sync.repository.ts');
  const input = {
    companyId: 'company-a', module: 'INVENTORY', author: { _id: 'user-1' },
    recipients: [{ _id: 'user-1' }], subject: 'Stock check', message: 'Count stock',
    deadline: '2026-10-10T00:00:00Z', priority: 'MOYENNE',
  };
  const task = await repo.createTask('company-a', input);
  assert.equal(task.module, 'INVENTORY');
  const hrTask = await repo.createTask('company-a', { ...input, module: 'HR', subject: 'HR task' });
  await repo.createTask('company-b', { ...input, companyId: 'company-b' });
  for (const module of ['HR', 'INVENTORY']) {
    const expected = module === 'HR' ? hrTask._id : task._id;
    const lists = [
      await repo.getAllTasks('company-a', module),
      await repo.getAllTasksForUser('company-a', 'user-1', module),
      await repo.getTopTasks('company-a', 'user-1', module),
    ];
    for (const tasks of lists) {
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0]._id, expected);
    }
  }
  assert.equal(await repo.getTaskById('company-a', task._id, 'HR'), null);
  assert.equal(await repo.getTaskById('company-b', task._id, 'INVENTORY'), null);
  assert.equal((await repo.getTaskById('company-a', task._id, 'INVENTORY'))._id, task._id);
  await assert.rejects(repo.updateTask('company-a', { ...task, module: 'HR' }), /Task not found in this module/);
  await repo.updateTask('company-a', { ...task, subject: 'Updated stock check' });
  assert.equal((await repo.getTaskById('company-a', task._id, 'INVENTORY')).module, 'INVENTORY');
  const pending = await sync.getUnsyncedItems('company-a');
  assert.deepEqual(pending.map(item => JSON.parse(item.payload).module), ['INVENTORY', 'HR', 'INVENTORY']);
  assert.equal(await repo.deleteTask('company-a', task._id, 'HR'), null);
  assert.equal((await sync.getUnsyncedItems('company-a')).length, pending.length);
  await repo.markTaskSynced('company-a', task._id, 'HR');
  assert.equal(db.prepare('SELECT synced FROM tasks WHERE _id = ?').get(task._id).synced, 0);
  await repo.deleteTask('company-a', task._id, 'INVENTORY');
  assert.equal(JSON.parse((await sync.getUnsyncedItems('company-a')).at(-1).payload).module, 'INVENTORY');
  assert.equal((await repo.getAllTasks('company-a', 'INVENTORY')).length, 0);
  assert.equal(await repo.getTaskById('company-a', task._id, 'INVENTORY'), null);
  const serverTask = { ...task, author: 'user-1', serverVersion: 2 };
  await assert.rejects(repo.upsertTask({ ...serverTask, module: 'HR' }), /another company or module/);
  await assert.rejects(repo.upsertTask({ ...serverTask, companyId: 'company-b' }), /another company or module/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM task_recipients WHERE taskId = ?').get(task._id).count, 1);
  await repo.upsertTask(serverTask);
  assert.equal((await repo.getTaskById('company-a', task._id, 'INVENTORY')).module, 'INVENTORY');
  await repo.markTaskSynced('company-a', task._id, 'INVENTORY');
  assert.equal(db.prepare('SELECT synced FROM tasks WHERE _id = ?').get(task._id).synced, 1);
  await repo.upsertTask({ ...serverTask, subject: 'Stale', serverVersion: 1 });
  assert.equal((await repo.getTaskById('company-a', task._id, 'INVENTORY')).subject, task.subject);
  for (const action of [
    () => repo.createTask('company-a', { ...input, module: undefined }),
    () => repo.updateTask('company-a', { ...task, module: undefined }),
    () => repo.getAllTasks('company-a'),
    () => repo.getAllTasksForUser('company-a', 'user-1'),
    () => repo.getTopTasks('company-a', 'user-1'),
    () => repo.getTaskById('company-a', task._id),
    () => repo.deleteTask('company-a', task._id),
    () => repo.markTaskSynced('company-a', task._id),
    () => repo.upsertTask({ ...serverTask, module: undefined }),
  ]) await assert.rejects(action(), /valid task module is required/);
  db.exec('ALTER TABLE tasks DROP COLUMN module');
  await createTasksTables();
  assert.equal((await repo.getTaskById('company-a', task._id, 'HR')).module, 'HR');
  console.log('Passed: required module for every operation, company/module isolation, scoped deletes and acknowledgements, sync conflict protection, stale revisions, and legacy migration.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
