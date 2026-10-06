// Node 22+: verify migration, independent notes, and pull/push fields in SQLite.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const database = new DatabaseSync(':memory:');
const queued = [];
const adapter = {
  run: async (sql, params = []) => database.prepare(sql).run(...params),
  all: async (sql, params = []) => database.prepare(sql).all(...params),
  get: async (sql, params = []) => database.prepare(sql).get(...params) ?? null,
};
function load(relative) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/electron/database', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console: { log() {}, warn() {} }, require: (name) => {
    if (name.endsWith('/db.js')) return adapter;
    if (name.endsWith('/sync.repository.js')) return { addToSyncQueue: async (item) => queued.push(JSON.parse(item.payload)) };
    if (name.endsWith('/employees.repository.js')) return {};
    return require(name);
  } });
  return module.exports;
}
(async () => {
  database.exec(`CREATE TABLE employees (_id TEXT PRIMARY KEY, companyId TEXT, firstName TEXT,
    lastName TEXT, department TEXT, role TEXT, remainingLeave INTEGER, isDeleted INTEGER);
    INSERT INTO employees VALUES ('e1', 'a', 'Test', 'Employee', 'Atelier', 'Worker', 20, 0);`);
  const schema = load('schemas/modules/hr/leaves.schema.ts');
  const repo = load('repositories/modules/hr/leaves.repository.ts');
  await schema.createLeavesTable();
  database.exec('ALTER TABLE leaves DROP COLUMN additionalNotes');
  const remote = { _id: 'l1', companyId: 'a', employeeId: 'e1', submittedAt: '2026-09-01',
    submittedMonth: '2026-09', startDate: '2026-10-01', endDate: '2026-10-02',
    subject: 'Congé', notes: 'Raison familiale', status: 'ATTENTE_APPROBATION', serverVersion: 1,
    createdAt: '2026-09-01', updatedAt: '2026-09-01' };
  database.prepare(`INSERT INTO leaves (_id, companyId, employeeId, submittedAt, submittedMonth,
    startDate, endDate, subject, notes) VALUES ('l1','a','e1','2026-09-01','2026-09',
    '2026-10-01','2026-10-02','Congé','Raison familiale')`).run();
  await schema.createLeavesTable();
  await schema.createLeavesTable();
  assert.equal((await repo.getLeaveById('a', 'l1')).notes, remote.notes);
  assert.equal((await repo.getLeaveById('a', 'l1')).additionalNotes, '');
  const updated = await repo.updateLeave('a', 'l1', { additionalNotes: 'Manager — justificatif reçu' });
  assert.equal(updated.notes, remote.notes);
  assert.equal(updated.additionalNotes, queued.at(-1).additionalNotes);
  assert.equal(queued.at(-1).notes, undefined, 'Adding a note must not overwrite the motif');
  await repo.upsertLeave({ ...remote, serverVersion: 2 });
  assert.equal((await repo.getLeaveById('a', 'l1')).additionalNotes, updated.additionalNotes,
    'Older payloads without additionalNotes must preserve the saved notes');
  await repo.upsertLeave({ ...remote, serverVersion: 3, additionalNotes: 'Note synchronisée' });
  assert.equal((await repo.getLeaveById('a', 'l1')).additionalNotes, 'Note synchronisée');
  assert.equal((await repo.getLeaveById('a', 'l1')).notes, remote.notes);
  await repo.upsertLeave({ ...remote, serverVersion: 4, additionalNotes: '' });
  assert.equal((await repo.getLeaveById('a', 'l1')).additionalNotes, '');
  console.log('Passed: leave migration, separate motif and notes, queued update, and compatible pull sync.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => database.close());
