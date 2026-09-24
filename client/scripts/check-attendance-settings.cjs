const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sqlite = require('sqlite3');
const db = new sqlite.Database(':memory:');
const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (error) {
  error ? reject(error) : resolve(this);
}));
const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
const get = async (...args) => (await all(...args))[0] ?? null;
const adapter = { run, all, get, runDirect: run, getDirect: get, transaction: async (callback) => {
  await run('BEGIN');
  try { const result = await callback(); await run('COMMIT'); return result; }
  catch (error) { await run('ROLLBACK'); throw error; }
} };
let role = 'ADMIN', failQueue = false;
const queue = {
  addToSyncQueue: async (item) => {
    if (failQueue) throw new Error('queue failure');
    await run('INSERT INTO sync_queue(payload) VALUES (?)', [item.payload]);
  },
  notifyPendingChanges: async () => {},
};
function load(relative) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/electron/database', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console, require: (name) => {
    if (name.endsWith('/db.js')) return adapter;
    if (name.endsWith('/sync.repository.js')) return queue;
    if (name.endsWith('/admin_users.repository.js')) return { getAdminUsersById: async () => ({ role }) };
    if (name === 'electron') return { app: {} };
    return require(name);
  } });
  return module.exports;
}
(async () => {
  const schema = load('schemas/shared/companies.schema.ts');
  const companies = load('repositories/shared/companies.repository.ts');
  const settings = load('repositories/modules/hr/attendanceSettings.repository.ts');
  await schema.createCompanyTable();
  await run('ALTER TABLE companies DROP COLUMN attendanceClockIn');
  await schema.createCompanyTable(); // Upgrade an existing database.
  await schema.createCompanyTable(); // Idempotent.
  await run('CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT)');
  await run('CREATE TABLE sync_queue (payload TEXT)');
  const company = { _id: 'a', companyId: 'a', name: 'A', createdAt: '2026-09-24', updatedAt: '2026-09-24', serverVersion: 1 };
  await companies.upsertCompanyId(company);
  assert.equal(await settings.getAttendanceClockIn('a'), '08:00');
  await run("INSERT INTO app_settings VALUES ('attendance.clockIn.a', '07:30')");
  await settings.migrateAttendanceClockInSettings();
  await settings.migrateAttendanceClockInSettings();
  assert.equal(await settings.getAttendanceClockIn('a'), '07:30');
  assert.equal((await all('SELECT * FROM sync_queue')).length, 1);
  assert.equal((await all('SELECT * FROM app_settings')).length, 0);
  await settings.saveAttendanceClockIn('a', 'admin', '09:15');
  const payload = JSON.parse((await all('SELECT * FROM sync_queue'))[1].payload);
  assert.equal(payload.attendanceClockIn, '09:15');
  assert.equal(payload.synced, 0);
  await assert.rejects(() => settings.saveAttendanceClockIn('a', 'admin', '24:00'));
  role = 'EMPLOYEE';
  await assert.rejects(() => settings.saveAttendanceClockIn('a', 'user', '10:00'));
  role = 'ADMIN'; failQueue = true;
  await assert.rejects(() => settings.saveAttendanceClockIn('a', 'admin', '10:00'));
  assert.equal(await settings.getAttendanceClockIn('a'), '09:15');
  failQueue = false;
  await companies.markCompanySynced('a');
  await companies.upsertCompany({ ...company, attendanceClockIn: '06:45', serverVersion: 2 });
  assert.equal(await settings.getAttendanceClockIn('a'), '06:45');
  await companies.updateCompany({ ...company, name: 'Renamed' });
  assert.equal(await settings.getAttendanceClockIn('a'), '06:45');
  console.log('Attendance settings migration, queue, rollback, authorization, and pull checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
