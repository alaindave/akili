const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sqlite = require('sqlite3');
const db = new sqlite.Database(':memory:');
const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(error) {
  error ? reject(error) : resolve(this);
}));
const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row ?? null)));
const adapter = { run, get, runDirect: run, getDirect: get, transaction: async (callback) => {
  await run('BEGIN');
  try { const result = await callback(); await run('COMMIT'); return result; }
  catch (error) { await run('ROLLBACK'); throw error; }
} };
function load(file, resolve, expose = '') {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), 'utf8') + expose, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: resolve, Date, Error,
    console: { log() {}, warn() {}, error() {} }, process: { env: {} } });
  return module.exports;
}
(async () => {
  await run(`CREATE TABLE attendances (
    _id TEXT PRIMARY KEY, companyId TEXT, employeeId TEXT, date TEXT, clockIn TEXT,
    clockOut TEXT, status TEXT, source TEXT, lateMinutes INTEGER, notes TEXT,
    serverVersion INTEGER, isDeleted INTEGER, createdAt TEXT, updatedAt TEXT,
    synced INTEGER, lastSyncedAt TEXT)`);
  await run('CREATE UNIQUE INDEX employee_date ON attendances(employeeId, date) WHERE isDeleted = 0');
  await run('CREATE TABLE sync_queue (_id INTEGER PRIMARY KEY, companyId TEXT, entity TEXT, entityId TEXT, synced INTEGER)');
  const repo = load('../src/electron/database/repositories/modules/hr/attendances.repository.ts', name => name.endsWith('/db.js') ? adapter : {});
  const base = { companyId: 'company', employeeId: 'employee', date: '2026-10-07', clockIn: '08:00', clockOut: '17:00',
    status: 'PONCTUEL', source: 'MANUAL', serverVersion: 1, isDeleted: 0, createdAt: '2026-10-07', updatedAt: '2026-10-07' };
  const row = id => get('SELECT * FROM attendances WHERE _id = ?', [id]);
  await repo.upsertAttendance({ ...base, _id: 'old', isDeleted: 1 });
  await repo.upsertAttendance({ ...base, _id: 'replacement' });
  const incoming = { ...base, _id: 'old', serverVersion: 2, clockIn: '09:00', clockOut: '18:00' };
  assert.equal((await repo.upsertAttendance(incoming))._id, 'replacement');
  assert.equal((await row('old')).isDeleted, 1);
  assert.equal((await row('replacement')).clockIn, '09:00');
  await repo.upsertAttendance({ ...incoming, _id: 'unknown', serverVersion: 3 });
  assert.equal(await row('unknown'), null, 'Unknown live IDs merge into the active row');
  await repo.upsertAttendance({ ...incoming, isDeleted: 1, serverVersion: 4 });
  await repo.upsertAttendance({ ...incoming, _id: 'other-tombstone', isDeleted: 1, serverVersion: 5 });
  assert.equal((await row('replacement')).isDeleted, 0, 'Tombstones cannot delete replacements');
  await repo.upsertAttendance({ ...incoming, _id: 'replacement', serverVersion: 2, clockIn: '07:00' });
  assert.equal((await row('replacement')).clockIn, '09:00', 'Older pulls cannot overwrite newer rows');
  const pull = load('../src/electron/services/shared/sync/pull.service.ts', name => {
    if (name.endsWith('/attendances.repository.js')) return repo;
    if (name === 'electron') return { app: { isPackaged: false } };
    return {};
  }, '\nexport { syncAttendances };');
  for (const id of ['old', 'replacement']) {
    await run("INSERT INTO sync_queue VALUES (1, 'company', 'attendance', ?, 0)", [id]);
    await run("UPDATE attendances SET synced = 0 WHERE _id = 'replacement'");
    assert.equal(await pull.syncAttendances([{ ...incoming, serverVersion: 6, clockIn: '10:00' }]), false);
    assert.equal((await row('replacement')).clockIn, '09:00');
    assert.equal((await row('replacement')).synced, 0);
    assert.equal((await get('SELECT COUNT(*) AS count FROM sync_queue')).count, 1);
    await run('DELETE FROM sync_queue');
  }
  assert.equal(await pull.syncAttendances([{ ...incoming, serverVersion: 6, clockIn: '10:00' }]), true);
  assert.equal((await row('replacement')).clockIn, '10:00');
  await repo.upsertAttendance({ ...base, _id: 'lone-deleted', employeeId: 'other', isDeleted: 1 });
  await repo.upsertAttendance({ ...base, _id: 'lone-deleted', employeeId: 'other', serverVersion: 2 });
  assert.equal((await row('lone-deleted')).isDeleted, 0, 'A deleted row without a replacement can be restored');
  console.log('Passed attendance duplicate reconciliation, tombstone isolation, version checks, pending edits, pull retries, and restoration.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
