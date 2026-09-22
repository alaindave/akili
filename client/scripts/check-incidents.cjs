// Run with Node 22.13+: node scripts/check-incidents.cjs
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
    if (name === './sync.repository.js') return load('repositories/shared/sync.repository.ts');
    if (name === 'electron') return { BrowserWindow: { getAllWindows: () => [] } };
    return require(name);
  };
  vm.runInNewContext(code, { require: localRequire, module, exports: module.exports }, { filename });
  return module.exports;
}

(async () => {
  const { createIncidentsTable } = load('schemas/shared/incidents.schema.ts');
  const repo = load('repositories/shared/incidents.repository.ts');
  await load('schemas/shared/sync.schema.ts').createSyncTable();
  await createIncidentsTable();
  await createIncidentsTable();
  const input = {
    reporterName: '  Alice  ', reporterContact: '+257 12345678',
    occurredAt: '2026-09-22T09:00:00+02:00', location: 'Atelier',
    notes: "Déversement à 100% près de l'entrée", preventiveActions: '', remedialActions: 'Nettoyage',
  };
  const first = await repo.createIncident('company-a', input);
  const second = await repo.createIncident('company-a', { ...input, occurredAt: '2026-09-23T00:00:00Z', location: 'Entrepôt' });
  await repo.createIncident('company-b', { ...input, location: 'Confidentiel' });
  assert.match(first.incidentNumber, /^INC-\d{6}-\d{4}-([1-9]\d{0,2}|1000)$/);
  assert.equal((await repo.getIncidentById('company-a', first._id)).incidentNumber, first.incidentNumber);
  assert.equal((await repo.getIncidents('company-a', { search: first.incidentNumber }))[0]._id, first._id);
  assert.equal(first.reporterName, 'Alice');
  assert.equal(first.occurredAt, '2026-09-22T07:00:00.000Z');
  assert.equal((await repo.getIncidentById('company-a', first._id)).notes, input.notes);
  assert.equal(await repo.getIncidentById('company-b', first._id), null);
  assert.deepEqual((await repo.getIncidents('company-a')).map((row) => row._id), [second._id, first._id]);
  assert.equal((await repo.getIncidents('company-b')).length, 1);
  assert.equal((await repo.getIncidents('company-a', { search: 'alice', location: 'Atelier' })).length, 1);
  assert.equal((await repo.getIncidents('company-a', { search: 'nettoyage' })).length, 2);
  assert.equal((await repo.getIncidents('company-a', { search: '%' })).length, 2);
  assert.equal((await repo.getIncidents('company-a', { search: '_' })).length, 0);
  assert.equal((await repo.getIncidents('company-a', { search: "' OR 1=1 --" })).length, 0);
  const day = await repo.getIncidents('company-a', { from: '2026-09-22T00:00:00Z', to: '2026-09-22T23:59:59.999Z' });
  assert.equal(day.length, 1);
  assert.equal(day[0]._id, first._id);
  assert.equal((await repo.getIncidents('company-a', { from: first.occurredAt, to: first.occurredAt })).length, 1);
  assert.equal(JSON.stringify(await repo.getIncidentLocations('company-a')), JSON.stringify(['Atelier', 'Entrepôt']));
  for (const invalid of [{ reporterName: ' ' }, { reporterContact: '' }, { notes: '' }, { location: ' ' }, { occurredAt: 'invalid' }, { notes: 'a'.repeat(10001) }]) {
    await assert.rejects(() => repo.createIncident('company-a', { ...input, ...invalid }));
  }
  await assert.rejects(() => repo.createIncident('', input));
  await assert.rejects(() => repo.getIncidents('company-a', { from: '2026-09-23T00:00:00Z', to: '2026-09-22T00:00:00Z' }));
  assert.equal((await repo.getIncidents('company-a')).length, 2);
  const sync = load('repositories/shared/sync.repository.ts');
  assert.equal((await sync.getUnsyncedItems('company-a')).length, 2);
  const updated = await repo.updateIncident('company-a', first._id, { ...input, notes: 'Updated locally' });
  assert.equal(updated.incidentNumber, first.incidentNumber);
  assert(updated.updatedAt > first.updatedAt);
  const pending = await sync.getUnsyncedItems('company-a');
  assert.equal(pending.length, 3);
  assert.equal(pending[2].operation, 'update');
  assert.equal(JSON.parse(pending[2].payload).notes, 'Updated locally');
  await assert.rejects(() => repo.updateIncident('company-b', first._id, input));
  await repo.markIncidentSynced('company-a', first._id, first.updatedAt);
  assert.equal((await repo.getIncidentById('company-a', first._id)).synced, 0);
  const remote = { ...updated, serverVersion: 5, notes: 'From server' };
  await assert.rejects(() => repo.upsertIncident('company-a', remote));
  await repo.markIncidentSynced('company-a', first._id, updated.updatedAt);
  await repo.upsertIncident('company-a', remote);
  assert.equal((await repo.getIncidentById('company-a', first._id)).notes, 'From server');
  await repo.upsertIncident('company-a', { ...remote, serverVersion: 4, notes: 'Stale' });
  assert.equal((await repo.getIncidentById('company-a', first._id)).notes, 'From server');
  await assert.rejects(() => repo.upsertIncident('company-b', remote));

  // Queue failure rolls back both create and update.
  db.exec("CREATE TRIGGER fail_incident_queue BEFORE INSERT ON sync_queue BEGIN SELECT RAISE(ABORT, 'queue failure'); END");
  await assert.rejects(() => repo.createIncident('company-a', input));
  await assert.rejects(() => repo.updateIncident('company-a', first._id, { ...input, notes: 'Must roll back' }));
  assert.equal((await repo.getIncidents('company-a')).length, 2);
  assert.equal((await repo.getIncidentById('company-a', first._id)).notes, 'From server');
  db.exec('DROP TRIGGER fail_incident_queue');

  // Existing local-only installations gain metadata and one queue item per report.
  db.exec("DELETE FROM sync_queue; UPDATE incidents SET synced = 0, serverVersion = 0");
  for (const column of ['updatedAt', 'serverVersion', 'synced', 'lastSyncedAt', 'isDeleted']) {
    db.exec(`ALTER TABLE incidents DROP COLUMN ${column}`);
  }
  await createIncidentsTable();
  await repo.queueExistingIncidents();
  await repo.queueExistingIncidents();
  assert.equal((await sync.getUnsyncedItems('company-a')).length, 2);
  assert.equal((await sync.getUnsyncedItems('company-b')).length, 1);
  assert.equal((await repo.getIncidentById('company-a', first._id)).updatedAt, first.createdAt);
  console.log('Passed: incident schema, round-trip persistence, company isolation, ordering, search, combined filters, date boundaries validation, atomic queue writes, acknowledgements, pull conflicts and schema upgrades.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
