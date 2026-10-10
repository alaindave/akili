// Run with Node 22+: node scripts/check-sync-reliability.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, resolve, expose = "") {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), 'utf8') + expose, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: resolve, Date, Error,
    console: { log() {}, warn() {}, error() {} }, process: { env: { VITE_API_URL: 'http://test' } } });
  return module.exports;
}
(async () => {
  const item = (id, entityId, data) => ({ _id: id, entityId, companyId: 'a', entity: 'payroll_result', operation: 'update', payload: JSON.stringify({ companyId: 'a', updatedAt: '2026-09-28', ...data }) });
  let pending = [item('legacy', 'slip', {}), item('conflict', 'bad', { _id: 'bad' }), item('later', 'bad', { _id: 'bad' }), item('invalid', 'invalid', { _id: 'different' })];
  let calls = 0;
  const acknowledged = [];
  class Form { append(key, value) { this[key] = value; } getHeaders() { return {}; } }
  const push = load('../src/electron/services/shared/sync/push.service.ts', (name) => {
    if (name.endsWith('/InventorySync.js')) return { isInventorySyncEntity: () => false };
    if (name === 'electron') return { app: { isPackaged: false } };
    if (name === 'form-data') return { default: Form };
    if (name.endsWith('/auth.js')) return { getToken: async () => 'token' };
    if (name.endsWith('/sync.repository.js')) return {
      getUnsyncedItems: async () => pending.map((entry) => ({ ...entry })),
      markManySynced: async (_company, ids) => { pending = pending.filter((entry) => !ids.includes(entry._id)); },
    };
    if (name.endsWith('/payrollRun.repository.js')) return {
      markPayrollResultSynced: async (_company, id) => {
        assert(!pending.some((entry) => entry.entityId === id));
        acknowledged.push(id);
      },
    };
    if (name === 'axios') return { default: { post: async (_url, form) => {
      calls++;
      const items = JSON.parse(form.items);
      if (calls === 1) assert.equal(items[0].data._id, 'slip'); // Repair legacy verification payload.
      assert.equal(items.length, 3);
      if (calls === 2) assert.deepEqual(items.map((entry) => entry.queueId), ['conflict', 'later', 'newer']);
      return { status: 200, data: { synced: ['legacy'], failed: [
        { queueId: 'conflict', message: 'Parent mismatch', retryable: false },
        { queueId: 'later', message: 'Earlier update failed', retryable: true },
      ] } };
    } } };
    return {};
  });
  await assert.rejects(() => push.pushPendingChanges('a'), /Queued payroll ID/);
  assert.equal(calls, 0, 'Invalid IDs must fail validation before sending');
  assert.equal(pending.length, 4, 'Validation failure preserves queued edits');
  pending = pending.filter((entry) => entry._id !== 'invalid');
  let result = await push.pushPendingChanges('a');
  assert.equal(result.pendingChanges, 2);
  assert.deepEqual(acknowledged, ['slip']);
  pending.push(item('newer', 'bad', { _id: 'bad' }));
  result = await push.pushPendingChanges('a');
  assert.equal(calls, 2, 'Failed items and later edits must be retried');
  assert.equal(result.pendingChanges, 3, 'Unacknowledged edits remain stored');

  // Pending payroll edits must keep the cursor unchanged until a later pull can apply them.
  let pendingEdit = true;
  const cursors = new Map();
  const pull = load('../src/electron/services/shared/sync/pull.service.ts', (name) => {
    if (name.endsWith('/sync.repository.js')) return { getUnsyncedItems: async () => [] };
    if (name === 'electron') return { app: { isPackaged: false } };
    if (name.endsWith('/auth.js')) return { getToken: async () => 'token' };
    if (name.endsWith('/db.js')) return { get: async () => ({ _id: 'run' }) };
    if (name.endsWith('/syncState.repository.js')) return {
      getSyncState: async (_company, entity) => ({ lastPulledVersion: cursors.get(entity) ?? 0 }),
      updateLastPulledVersion: async (_company, entity, version) => cursors.set(entity, version),
    };
    if (name.endsWith('/payrollRun.repository.js')) return {
      upsertPayrollRun: async () => !pendingEdit,
      upsertPayrollResult: async () => !pendingEdit,
      upsertPayrollItem: async () => !pendingEdit,
    };
    if (name === 'axios') return { default: { get: async () => ({ data: {
      items: [{ _id: 'record', companyId: 'a', payrollRunId: 'run' }], nextVersion: 5, hasMore: false,
    } }) } };
    return {};
  }, '\nexport { pullEntityByVersion, syncPayrollRuns, syncPayrollResults, syncPayrollItems };');
  for (const [entity, apply] of [['payroll_run', pull.syncPayrollRuns],
    ['payroll_result', pull.syncPayrollResults], ['payroll_item', pull.syncPayrollItems]]) {
    pendingEdit = true;
    await assert.rejects(() => pull.pullEntityByVersion('a', entity, apply), /CURSOR WAS NOT ADVANCED/);
    assert.equal(cursors.get(entity), undefined);
    pendingEdit = false;
    await pull.pullEntityByVersion('a', entity, apply);
    assert.equal(cursors.get(entity), 5);
  }

  const operations = [];
  let failIndex = false;
  const migration = load('../../server/utils/migratePayrollIndex.ts', () => ({ default: { collection: {
    createIndex: async (keys, options) => {
      operations.push('create');
      assert.equal(keys.companyId, 1);
      assert.equal(options.unique, true);
      if (failIndex) throw new Error('duplicate active period');
    },
    indexes: async () => [
      { name: 'old', unique: true, key: { month: 1, year: 1 } },
      { name: 'keep', unique: true, key: { companyId: 1, month: 1, year: 1 } },
    ],
    dropIndex: async (name) => operations.push(`drop:${name}`),
  } } }));
  await migration.migratePayrollIndex();
  assert.deepEqual(operations, ['create', 'drop:old']);
  operations.length = 0;
  failIndex = true;
  await assert.rejects(() => migration.migratePayrollIndex(), /duplicate active period/);
  assert.deepEqual(operations, ['create'], 'Failed replacement must retain the existing constraint');
  console.log('Passed: legacy IDs, partial acknowledgements, failed-item retries, payroll cursor retention, and safe index migration.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
