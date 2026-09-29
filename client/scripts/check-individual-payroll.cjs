// Run with Node 22+: node scripts/check-individual-payroll.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const database = new DatabaseSync(':memory:');
let queue = Promise.resolve();
let failQueue = false;
let failQueueAfter = Infinity;
function enqueue(fn) {
  const next = queue.catch(() => {}).then(fn);
  queue = next.catch(() => {});
  return next;
}
const runDirect = async (sql, params = []) => {
  if (sql.includes('INSERT INTO sync_queue') && (failQueue || failQueueAfter-- === 0)) throw new Error('queue failure');
  const result = database.prepare(sql).run(...params);
  return { changes: Number(result.changes), lastID: Number(result.lastInsertRowid) };
};
const getDirect = async (sql, params = []) => database.prepare(sql).get(...params) ?? null;
const allDirect = async (sql, params = []) => database.prepare(sql).all(...params);
const db = {
  runDirect, getDirect, allDirect,
  run: (sql, params) => enqueue(() => runDirect(sql, params)),
  get: (sql, params) => enqueue(() => getDirect(sql, params)),
  all: (sql, params) => enqueue(() => allDirect(sql, params)),
  transaction: (callback) => enqueue(async () => {
    database.exec('BEGIN');
    try { const result = await callback(); database.exec('COMMIT'); return result; }
    catch (error) { database.exec('ROLLBACK'); throw error; }
  }),
};
function load(file, resolver) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports,
    require: resolver, console: { log() {}, warn() {}, error() {} }, Date, process });
  return module.exports;
}
const cache = new Map();
function local(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const result = load(file, (name) => {
    if (name.endsWith('/db.js')) return db;
    if (name === 'crypto') return require('node:crypto');
    if (name === 'electron') return { BrowserWindow: { getAllWindows: () => [] } };
    return local(path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts')));
  });
  cache.set(file, result);
  return result;
}
const root = path.resolve(__dirname, '../src/electron');
const repo = local(`${root}/database/repositories/modules/hr/payroll_run.repository.ts`);
const admin = { _id: 'manager', companyId: 'a', role: 'MANAGER', firstName: 'A', lastName: 'Manager' };
const row = (id) => database.prepare('SELECT * FROM payroll_results WHERE _id = ?').get(id);
const run = () => database.prepare("SELECT * FROM payroll_runs WHERE _id = 'run'").get();
const countQueue = () => database.prepare('SELECT COUNT(*) AS n FROM sync_queue').get().n;
(async () => {
  await local(`${root}/database/schemas/modules/hr/payroll.schema.ts`).createPayrollTables();
  await local(`${root}/database/schemas/modules/hr/payroll.schema.ts`).createPayrollTables(); // migration is idempotent
  await local(`${root}/database/schemas/shared/sync.schema.ts`).createSyncTable();
  database.exec(`CREATE TABLE admin_users (_id TEXT PRIMARY KEY);
    INSERT INTO admin_users VALUES ('manager');
    CREATE TABLE employees (_id TEXT PRIMARY KEY);
    INSERT INTO employees VALUES ('e1'), ('e2'), ('e3');
    CREATE TABLE audit_logs (_id TEXT, companyId TEXT, userId TEXT, userName TEXT,
    action TEXT, entity TEXT, entityId TEXT, description TEXT, changes TEXT, createdAt TEXT);
    INSERT INTO payroll_runs (companyId, _id, year, month, employeeCount, generatedBy, status, createdAt, updatedAt, synced)
      VALUES ('a', 'run', 2026, 9, 2, 'manager', 'VERIFICATION', '2026-09-01', '2026-09-01', 1);
    INSERT INTO payroll_results (companyId, _id, payrollRunId, employeeId, month, year, status, createdAt, updatedAt, synced)
      VALUES ('a', 'one', 'run', 'e1', 9, 2026, 'VERIFICATION', '2026-09-01', '2026-09-01', 1),
             ('a', 'two', 'run', 'e2', 9, 2026, 'VERIFICATION', '2026-09-01', '2026-09-01', 1);`);
  await assert.rejects(() => repo.payPayslip('a', 'one', admin), /approuvé/);
  await assert.rejects(() => repo.approvePayslip('a', 'one', { ...admin, role: 'ADMIN' }));
  await assert.rejects(() => repo.approvePayslip('b', 'one', admin));
  await assert.rejects(() => repo.approvePayslip('a', 'missing', admin));
  assert.equal(countQueue(), 0);
  failQueue = true;
  await assert.rejects(() => repo.approvePayslip('a', 'one', admin), /queue failure/);
  failQueue = false;
  assert.equal(row('one').status, 'VERIFICATION');
  assert.equal(run().status, 'VERIFICATION');
  await Promise.all([repo.approvePayslip('a', 'one', admin), repo.approvePayslip('a', 'one', admin)]);
  assert.equal(countQueue(), 1);
  assert.equal(row('one').approvedBy, admin._id);
  assert.equal(row('two').status, 'VERIFICATION');
  assert.equal(run().status, 'VERIFICATION');
  await repo.payPayslip('a', 'one', admin);
  assert.equal(row('one').status, 'PAYÉ');
  assert.equal(run().status, 'VERIFICATION');
  await assert.rejects(() => repo.cancelPayrollRun('a', 'run', admin));
  await assert.rejects(() => repo.verifyPayrollRun('a', 'email', 'run', admin));
  await assert.rejects(() => repo.updatePayrollStatus('a', 'run', 'BROUILLON'));
  await assert.rejects(() => repo.deletePayrollRun('a', 'run'));
  await repo.approvePayslip('a', 'two', admin);
  assert.equal(run().status, 'APPROUVÉ');
  assert.equal(run().paidAt, null);
  await repo.payPayslip('a', 'two', admin);
  assert.equal(run().status, 'PAYÉ');
  assert.equal(run().paidBy, admin._id);
  assert.equal(countQueue(), 4);
  await repo.payPayslip('a', 'two', admin);
  assert.equal(countQueue(), 4);
  const payloads = database.prepare('SELECT entity, payload FROM sync_queue').all();
  assert(payloads.every((r) => r.entity === 'payroll_result'));
  assert.equal(JSON.parse(payloads.at(-1).payload).paidBy, admin._id);
  await repo.markPayrollResultSynced('a', 'two', 'outdated');
  assert.equal(row('two').synced, 0);
  await repo.markPayrollResultSynced('a', 'two', row('two').updatedAt);
  assert.equal(row('two').synced, 0); // Acknowledging one snapshot must not hide queued edits.
  database.exec("UPDATE sync_queue SET synced = 1 WHERE entityId = 'two'");
  await repo.markPayrollResultSynced('a', 'two', row('two').updatedAt);
  assert.equal(row('two').synced, 1);
  const pendingSnapshot = { ...row('one'), status: 'ANNULÉ', serverVersion: 50 };
  await repo.upsertPayrollResult('a', pendingSnapshot);
  assert.equal(row('one').status, 'PAYÉ');
  assert.equal(row('one').synced, 0);
  assert.equal(database.prepare('SELECT serverVersion FROM sync_deferred WHERE entityId = ?').get('one').serverVersion, 50);
  await repo.upsertPayrollResult('a', { ...pendingSnapshot, serverVersion: 49 });
  assert.equal(database.prepare('SELECT serverVersion FROM sync_deferred WHERE entityId = ?').get('one').serverVersion, 50);
  database.exec("UPDATE sync_queue SET synced = 1 WHERE entityId = 'one'");
  await repo.markPayrollResultSynced('a', 'one', row('one').updatedAt);
  await repo.upsertPayrollResult('a', pendingSnapshot);
  assert.equal(row('one').status, 'ANNULÉ');
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM sync_deferred').get().n, 0);
  // Exercise real INSERT and UPDATE SQL for pulled actor fields.
  const remote = { ...row('two'), _id: 'remote', employeeId: 'e3', serverVersion: 5 };
  await repo.upsertPayrollResult('a', remote);
  assert.equal(row('remote').approvedBy, admin._id);
  await repo.upsertPayrollResult('a', { ...remote, paidBy: 'other', serverVersion: 6 });
  assert.equal(row('remote').paidBy, 'other');
  database.exec("UPDATE payroll_results SET status = 'VERIFICATION', approvedAt = NULL, paidAt = NULL WHERE _id = 'remote'");
  await repo.refreshPayrollRunStatuses('a');
  assert.equal(run().status, 'VERIFICATION');
  assert.equal(run().paidAt, null);
  for (const status of ['APPROUVÉ', 'PAYÉ']) {
    const id = status === 'PAYÉ' ? 'cancel-paid' : 'cancel-approved';
    database.prepare(`INSERT INTO payroll_runs (companyId, _id, year, month, employeeCount, generatedBy,
      status, createdAt, updatedAt, synced) VALUES ('a', ?, 2026, 10, 1, 'manager', ?, '2026-09-01', '2026-09-01', 1)`)
      .run(id, status);
    database.prepare(`INSERT INTO payroll_results (companyId, _id, payrollRunId, employeeId, year, month,
      status, approvedAt, paidAt, createdAt, updatedAt, synced)
      VALUES ('a', ?, ?, 'e1', 2026, 10, ?, '2026-09-02', ?, '2026-09-01', '2026-09-01', 1)`)
      .run(id + '-slip', id, status, status === 'PAYÉ' ? '2026-09-03' : null);
    assert((await repo.getProcessedPayrollRuns('a')).some((r) => r._id === id));
    assert.equal((await repo.getProcessedPayrollRuns('b')).length, 0);
    await assert.rejects(() => repo.cancelProcessedPayrollRun('a', id, { ...admin, role: 'VIEWER' }));
    await assert.rejects(() => repo.cancelProcessedPayrollRun('b', id, admin));
    failQueue = true;
    await assert.rejects(() => repo.cancelProcessedPayrollRun('a', id, admin), /queue failure/);
    failQueue = false;
    assert.equal(row(id + '-slip').status, status);
    await repo.cancelProcessedPayrollRun('a', id, { ...admin, role: 'ADMIN' });
    assert.equal(row(id + '-slip').status, 'ANNULÉ');
    assert.equal(row(id + '-slip').approvedAt, '2026-09-02');
    assert.equal(row(id + '-slip').paidAt, status === 'PAYÉ' ? '2026-09-03' : null);
    assert(!(await repo.getProcessedPayrollRuns('a')).some((r) => r._id === id));
    const queued = countQueue();
    await repo.cancelProcessedPayrollRun('a', id, admin);
    assert.equal(countQueue(), queued);
    await assert.rejects(() => repo.approvePayslip('a', id + '-slip', admin));
    await assert.rejects(() => repo.verifyPayrollRun('a', 'email', id, admin));
  }
  // Failure between a local write and any queue insertion must roll back both.
  const batch = { employeeCount: 1, totalBasicSalary: 100, totalEarnings: 0,
    totalDeductions: 0, totalNetSalary: 100 };
  const dto = { companyId: 'a', month: 12, year: 2026, admin, managerEmail: 'manager@example.test' };
  const beforeCreate = countQueue();
  failQueue = true;
  await assert.rejects(() => repo.createPayrollRun(batch, dto), /queue failure/);
  failQueue = false;
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM payroll_runs WHERE month = 12').get().n, 0);
  assert.equal(countQueue(), beforeCreate);
  const atomicRun = await repo.createPayrollRun(batch, dto);
  database.exec(`INSERT INTO payroll_components (companyId, _id, name, displayName, type, calculationType, displayOrder, createdAt, updatedAt)
    VALUES ('a', 'base', 'Base', 'Base', 'EARNING', 'FIXE', 1, '2026-09-01', '2026-09-01')`);
  const generated = { employeeId: 'e1', baseSalary: 100, grossSalary: 100,
    totalEarnings: 0, totalDeductions: 0, netSalary: 100, status: 'BROUILLON',
    earnings: [{ componentId: 'base', name: 'Base', displayName: 'Base', type: 'EARNING', amount: 100 }], deductions: [] };
  failQueueAfter = 1; // Result queued successfully, item queue insertion fails.
  await assert.rejects(() => repo.savePayrollResult('a', atomicRun._id, generated), /queue failure/);
  failQueueAfter = Infinity;
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM payroll_results WHERE payrollRunId = ?').get(atomicRun._id).n, 0);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM payroll_items').get().n, 0);
  assert.equal(countQueue(), beforeCreate + 1);
  const atomicSlip = await repo.savePayrollResult('a', atomicRun._id, generated);
  const beforeVerify = countQueue();
  failQueueAfter = 1; // Run queued successfully, result queue insertion fails.
  await assert.rejects(() => repo.verifyPayrollRun('a', dto.managerEmail, atomicRun._id, admin), /queue failure/);
  failQueueAfter = Infinity;
  assert.equal(row(atomicSlip).status, 'BROUILLON');
  assert.equal(database.prepare('SELECT status FROM payroll_runs WHERE _id = ?').get(atomicRun._id).status, 'BROUILLON');
  assert.equal(countQueue(), beforeVerify);
  await repo.verifyPayrollRun('a', dto.managerEmail, atomicRun._id, admin);
  await repo.approvePayslip('a', atomicSlip, admin);
  await repo.payPayslip('a', atomicSlip, admin);
  const ordered = database.prepare('SELECT operation, payload FROM sync_queue WHERE entityId = ? ORDER BY _id').all(atomicSlip);
  assert.deepEqual(ordered.map((entry) => [entry.operation, JSON.parse(entry.payload).status]),
    [['create', 'BROUILLON'], ['update', 'VERIFICATION'], ['update', 'APPROUVÉ'], ['update', 'PAYÉ']]);

  console.log('SQLite checks passed: individual transitions, totals status, roles, isolation, retries, atomic rollback, migration, pull fields, sync acknowledgements, settings cancellation.');

  // Exercise the real Mongoose schema so strict casting cannot silently drop audit fields.
  const PayrollResultModel = load(path.resolve(__dirname, '../../server/models/payrollResult.model.ts'),
    (name) => require(require.resolve(name, { paths: [path.resolve(__dirname, '../../server')] }))).default;
  const mongoSlip = new PayrollResultModel({
    _id: 'schema-slip', companyId: 'a', payrollRunId: 'schema-run', employeeId: 'e1',
    month: 9, year: 2026, status: 'PAYÉ', approvedBy: 'approver', paidBy: 'payer',
    approvedAt: '2026-09-02', paidAt: '2026-09-03', createdAt: '2026-09-01', updatedAt: '2026-09-03',
  });
  await mongoSlip.validate();
  const storedSlip = JSON.parse(JSON.stringify(mongoSlip.toObject()));
  assert.equal(storedSlip.approvedBy, 'approver');
  assert.equal(storedSlip.paidBy, 'payer');
  assert.equal(storedSlip.approvedAt, '2026-09-02T00:00:00.000Z');
  assert.equal(storedSlip.paidAt, '2026-09-03T00:00:00.000Z');
  mongoSlip.status = 'INVALID';
  await assert.rejects(() => mongoSlip.validate(), /status/);

  // Execute the actual server sync functions against an in-memory Mongo adapter.
  const runs = new Map();
  const results = new Map();
  const items = new Map();
  const matches = (doc, filter) => Object.entries(filter).every(([key, val]) =>
    val && typeof val === 'object' && '$in' in val ? val.$in.includes(doc[key]) : doc[key] === val);
  const key = (doc) => `${doc.companyId}:${doc._id}`;
  function model(store) {
    return {
      findOne: (filter) => ({ lean: async () => structuredClone([...store.values()].find((r) => matches(r, filter)) ?? null) }),
      find: (filter) => ({ lean: async () => structuredClone([...store.values()].filter((r) => matches(r, filter))) }),
      exists: async (filter) => [...store.values()].some((r) => matches(r, filter)),
      updateOne: async (filter, update, options = {}) => {
        const existing = [...store.values()].find((r) => matches(r, filter));
        if (!existing && !options.upsert) return { matchedCount: 0, upsertedCount: 0 };
        const next = { ...(existing ?? update.$setOnInsert), ...update.$set };
        store.set(key(next), next);
        return { matchedCount: existing ? 1 : 0, upsertedCount: existing ? 0 : 1 };
      },
    };
  }
  let version = 0;
  const server = load(path.resolve(__dirname, '../../server/sync.ts'), (name) => {
    if (name.endsWith('/adminUser.model.js')) return { default: { findOne: ({ companyId, _id }) => ({ lean: async () => companyId === 'a' && _id === 'manager' ? { role: 'MANAGER' } : null }) } };
    if (name.endsWith('/payrollRun.model.js')) return { default: model(runs) };
    if (name.endsWith('/payrollItem.model.js')) return { default: model(items) };
    if (name.endsWith('/payrollResult.model.js')) return { default: model(results) };
    if (name.endsWith('/syncVersion.js')) return { getNextSyncVersion: async () => ++version };
    return { default: {} };
  });
  const initialRun = { _id: 'run', companyId: 'a', employeeCount: 2, status: 'VERIFICATION', isDeleted: 0, updatedAt: '2026-09-01' };
  await server.syncPayrollRun('create', initialRun);
  const initial = { netSalary: 100, companyId: 'a', payrollRunId: 'run', status: 'VERIFICATION', isDeleted: 0, updatedAt: '2026-09-01' };
  await server.syncPayrollResult('create', { ...initial, _id: 'one' });
  items.set('a:item', { _id: 'item', companyId: 'a', payrollResultId: 'one', amount: 100, updatedAt: '2026-09-01', serverVersion: 1 });
  await server.syncPayrollItem('update', { _id: 'item', companyId: 'a', payrollResultId: 'one', amount: 999, updatedAt: '2026-09-02' });
  assert.equal(items.get('a:item').amount, 100);
  await assert.rejects(() => server.syncPayrollItem('update', { _id: 'item', companyId: 'a', payrollResultId: 'other', updatedAt: '2026-09-03' }), (error) => error.code === 'PAYROLL_PARENT_CONFLICT');

  await server.syncPayrollResult('update', { ...initial, _id: 'one', status: 'APPROUVÉ', approvedBy: 'manager', approvedAt: '2026-09-02' });
  assert.equal(runs.get('a:run').status, 'VERIFICATION'); // second result not downloaded yet
  await server.syncPayrollResult('create', { ...initial, _id: 'two' });
  await server.syncPayrollResult('update', { ...initial, _id: 'two', status: 'APPROUVÉ', approvedBy: 'manager2', approvedAt: '2026-09-03' });
  assert.equal(runs.get('a:run').status, 'APPROUVÉ');
  assert.equal(runs.get('a:run').approvedBy, 'manager2');
  await Promise.all(['one', 'two'].map((_id) => server.syncPayrollResult('update', {
    ...initial, _id, status: 'PAYÉ', paidAt: '2026-09-04', paidBy: 'manager',
  })));
  assert.equal(runs.get('a:run').status, 'PAYÉ');
  await server.syncPayrollResult('update', { ...initial, _id: 'one', status: 'APPROUVÉ' });
  await server.syncPayrollRun('update', initialRun); // stale batch snapshot
  assert.equal(results.get('a:one').status, 'PAYÉ');
  assert.equal(runs.get('a:run').status, 'PAYÉ');
  await server.syncPayrollResult('update', { ...initial, _id: 'one', netSalary: 999 });
  assert.equal(results.get('a:one').netSalary, 100);
  await assert.rejects(() => server.syncPayrollResult('update', { ...initial, _id: 'absent' }), (error) => error.code === 'MISSING_RECORD' && error.retryable === false);
  await assert.rejects(() => server.syncPayrollResult('update', { ...initial }), (error) => error.code === 'INVALID_ID');
  await assert.rejects(() => server.syncPayrollRun('update', { ...initialRun, status: 'ANNULÉ' }));
  await assert.rejects(() => server.syncPayrollResult('delete', { ...initial, _id: 'one', isDeleted: 1 }));
  await assert.rejects(() => server.syncPayrollResult('update', { ...initial, companyId: 'b', _id: 'one' }));
  await server.syncPayrollRun('create', { ...initialRun, _id: 'reset', employeeCount: 1 });
  await server.syncPayrollResult('create', { ...initial, _id: 'reset-slip', payrollRunId: 'reset' });
  await server.syncPayrollRun('update', { ...initialRun, _id: 'reset', employeeCount: 1, status: 'BROUILLON' });
  await server.syncPayrollResult('update', { ...initial, _id: 'reset-slip', payrollRunId: 'reset', status: 'BROUILLON' });
  assert.equal(runs.get('a:reset').status, 'BROUILLON');
  await assert.rejects(() => server.syncPayrollResult('update', { ...initial, _id: 'one', payrollRunId: 'reset' }), (error) => error.code === 'PAYROLL_PARENT_CONFLICT' && error.retryable === false);
  await assert.rejects(() => server.syncPayrollRun('update', { ...initialRun, status: 'ANNULÉ',
    cancellationFromSettings: true, cancelledBy: 'viewer', cancelledAt: '2026-09-05' }));
  const paidAt = results.get('a:one').paidAt;
  await server.syncPayrollRun('update', { ...initialRun, status: 'ANNULÉ',
    cancellationFromSettings: true, cancelledBy: 'manager', cancelledAt: '2026-09-05' });
  assert.equal(runs.get('a:run').status, 'ANNULÉ');
  assert.equal(results.get('a:one').status, 'ANNULÉ');
  assert.equal(results.get('a:two').status, 'ANNULÉ');
  assert.equal(results.get('a:one').paidAt, paidAt);
  await server.syncPayrollRun('update', initialRun);
  await server.syncPayrollResult('update', { ...initial, _id: 'one', status: 'PAYÉ' });
  assert.equal(runs.get('a:run').status, 'ANNULÉ');
  assert.equal(results.get('a:one').status, 'ANNULÉ');
  assert.equal(results.get('a:one').paidAt, paidAt);
  assert(results.get('a:one').cancelledAt);
  await server.syncPayrollRun('delete', { ...initialRun, isDeleted: 1 });
  assert.equal(runs.get('a:run').isDeleted, 1);
  console.log('Server sync checks passed: aggregate completion, partial downloads, concurrent payments, stale replays, audit actors, tenant isolation, terminal cancellation and deletion.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => database.close());
