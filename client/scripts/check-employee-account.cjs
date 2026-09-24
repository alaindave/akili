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
  get: async (sql, params = []) => db.prepare(sql).get(...params),
};
db.exec('CREATE TABLE test_queue (payload TEXT)');
let failQueue = false;
const queued = { at: (index) => db.prepare('SELECT payload FROM test_queue').all().map((row) => JSON.parse(row.payload)).at(index) };
adapter.runDirect = adapter.run;
adapter.getDirect = adapter.get;
adapter.allDirect = adapter.all;
adapter.transaction = async (callback) => {
  db.exec('BEGIN');
  try { const value = await callback(); db.exec('COMMIT'); return value; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
};
function load(relative) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/electron/database', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console: { log() {}, warn() {} }, require: (name) => {
    if (name.endsWith('/db.js')) return adapter;
    if (name.endsWith('/sync.repository.js')) return { notifyPendingChanges: async () => {}, addToSyncQueue: async (item) => { if (failQueue && item.entity === "payroll_profile") throw new Error("queue failure"); db.prepare("INSERT INTO test_queue VALUES (?)").run(item.payload); } };
    if (name.endsWith('/payrollAccount.repository.js')) return load('repositories/modules/hr/payrollAccount.repository.ts');
    if (name.endsWith('/payroll_components.repository.js')) return { getPayrollComponentById: async () => null };
    if (name.endsWith('/payrollProfile.service.js')) return { initializeEmployeePayrollProfilesForEmployee: async () => {} };
    return require(name);
  } });
  return module.exports;
}
(async () => {
  const schema = load('schemas/modules/hr/employees.schema.ts');
  const repo = load('repositories/modules/hr/employees.repository.ts');
  await schema.createEmployeesTable();
  await load('schemas/modules/hr/payroll.schema.ts').createPayrollTables();
  const profiles = load('repositories/modules/hr/payroll_employee_profile.repository.ts');
  const accounts = load('repositories/modules/hr/payrollAccount.repository.ts');
  const fields = { firstName: 'Test', lastName: 'Employee', matricule: '1', idNum: '1', dateBirth: '1990-01-01', dateHired: '2020-01-01', role: 'Worker', department: 'Atelier', telephone: '1', address: 'Test', emergencyContact: 'Test', relationship: 'Test', contactPhone: '1', salary: 100 };
  const employee = await repo.createEmployee('a', fields);
  assert.equal(employee.accountNumber, 'cash');
  assert.equal(queued.at(-1).accountNumber, 'cash');
  db.exec('ALTER TABLE employees DROP COLUMN accountNumber');
  await schema.createEmployeesTable();
  await schema.createEmployeesTable();
  assert.equal((await repo.getEmployeeById('a', employee._id)).accountNumber, 'cash');
  for (const id of ['component', 'new-component']) {
    await adapter.run(`INSERT INTO payroll_components
      (companyId, _id, name, displayName, type, calculationType, displayOrder, createdAt, updatedAt)
      VALUES ('a', ?, ?, 'Bonus', 'EARNING', 'FIXE', 1, '2026-09-25', '2026-09-25')`, [id, id]);
  }
  const profile = await profiles.createEmployeePayrollProfile('a', employee._id, {
    componentId: 'component', name: 'BONUS', displayName: 'Bonus', displayOrder: 1, type: 'EARNING', calculationType: 'FIXE', value: 5, taxable: 1,
  });
  assert.equal(profile.accountNumber, 'cash');
  assert.equal(queued.at(-1).accountNumber, 'cash');
  await adapter.run('ALTER TABLE payroll_employee_profiles DROP COLUMN accountNumber');
  await load('schemas/modules/hr/payroll.schema.ts').createPayrollTables();
  await accounts.migratePayrollAccounts();
  const count = db.prepare('SELECT count(*) AS n FROM test_queue').get().n;
  await accounts.migratePayrollAccounts();
  assert.equal(db.prepare('SELECT count(*) AS n FROM test_queue').get().n, count);
  let updated = await repo.updateEmployee('a', employee._id, { accountNumber: ' 001234 ' });
  assert.equal(updated.accountNumber, '001234');
  assert.equal((await profiles.getEmployeePayrollProfileById('a', profile._id)).accountNumber, '001234');
  assert.equal(queued.at(-1).accountNumber, '001234');
  updated = await repo.updateEmployee('a', employee._id, { firstName: 'Changed' });
  assert.equal(updated.accountNumber, '001234');
  await assert.rejects(() => repo.updateEmployee('b', employee._id, { accountNumber: 'other' }));
  updated = await repo.updateEmployee('a', employee._id, { accountNumber: '   ' });
  assert.equal(updated.accountNumber, 'cash');
  await repo.markEmployeeSynced('a', employee._id);
  await repo.upsertEmployee({ ...updated, accountNumber: '00987', serverVersion: 2 });
  assert.equal((await repo.getEmployeeById('a', employee._id)).accountNumber, '00987');
  await repo.upsertEmployee({ ...updated, _id: 'remote', matricule: '2', accountNumber: '0001', serverVersion: 1 });
  assert.equal((await repo.getEmployeeById('a', 'remote')).accountNumber, '0001');
  await repo.upsertEmployee({ ...updated, _id: 'legacy', matricule: '3', accountNumber: undefined, serverVersion: 1 });
  assert.equal((await repo.getEmployeeById('a', 'legacy')).accountNumber, 'cash');
  // Pulls must not overwrite or acknowledge local pending edits.
  const localProfile = await profiles.getEmployeePayrollProfileById('a', profile._id);
  const remote = { ...localProfile, accountNumber: '000999', serverVersion: 10 };
  await profiles.upsertEmployeePayrollProfile(remote);
  assert.equal((await profiles.getEmployeePayrollProfileById('a', profile._id)).synced, 0);
  assert.equal((await profiles.getEmployeePayrollProfileById('a', profile._id)).accountNumber, 'cash');
  await profiles.markPayrollEmployeeProfileSynced('a', profile._id, 'older-request');
  assert.equal((await profiles.getEmployeePayrollProfileById('a', profile._id)).synced, 0);
  await profiles.markPayrollEmployeeProfileSynced('a', profile._id, localProfile.updatedAt);
  await profiles.upsertEmployeePayrollProfile(remote);
  assert.equal((await profiles.getEmployeePayrollProfileById('a', profile._id)).accountNumber, '000999');
  await profiles.upsertEmployeePayrollProfile({ ...remote, accountNumber: 'old', serverVersion: 9 });
  assert.equal((await profiles.getEmployeePayrollProfileById('a', profile._id)).accountNumber, '000999');
  await profiles.upsertEmployeePayrollProfile({ ...remote, _id: 'new-profile', componentId: 'new-component' });
  assert.equal((await profiles.getEmployeePayrollProfileById('a', 'new-profile')).accountNumber, '000999');
  // An unrelated component edit retains the pulled account in its queue payload.
  const pulled = await profiles.getEmployeePayrollProfileById('a', 'new-profile');
  await profiles.updateEmployeePayrollProfile('a', { ...pulled, displayName: 'Changed' });
  assert.equal(queued.at(-1).accountNumber, '000999');
  failQueue = true;
  const beforeFailure = await repo.getEmployeeById('a', employee._id);
  await assert.rejects(() => repo.updateEmployee('a', employee._id, { accountNumber: 'rollback' }));
  assert.equal((await repo.getEmployeeById('a', employee._id)).accountNumber, beforeFailure.accountNumber);
  failQueue = false;
  db.close();
  console.log('Employee account migration, defaults, editing, sync queue, and pull checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
