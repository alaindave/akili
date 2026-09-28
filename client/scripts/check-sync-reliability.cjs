// Run with Node 22+: node scripts/check-sync-reliability.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, resolve) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), 'utf8'), {
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
  const push = load('../src/electron/services/sync/push.service.ts', (name) => {
    if (name === 'electron') return { app: { isPackaged: false } };
    if (name === 'form-data') return { default: Form };
    if (name.endsWith('/auth.js')) return { getToken: async () => 'token' };
    if (name.endsWith('/sync.repository.js')) return {
      getUnsyncedItems: async () => pending.map((entry) => ({ ...entry })),
      blockSyncItem: async (_company, id, reason) => { pending.find((entry) => entry._id === id).blockedReason = reason; },
      markManySynced: async (_company, ids) => { pending = pending.filter((entry) => !ids.includes(entry._id)); },
    };
    if (name.endsWith('/payroll_run.repository.js')) return {
      markPayrollResultSynced: async (_company, id) => {
        assert(!pending.some((entry) => entry.entityId === id));
        acknowledged.push(id);
      },
    };
    if (name === 'axios') return { default: { post: async (_url, form) => {
      calls++;
      const items = JSON.parse(form.items);
      assert.equal(items[0].data._id, 'slip'); // Repair legacy verification payload.
      assert.equal(items.length, 3); // Contradictory IDs never leave the client.
      return { status: 200, data: { synced: ['legacy'], failed: [
        { queueId: 'conflict', message: 'Parent mismatch', retryable: false },
        { queueId: 'later', message: 'Earlier update failed', retryable: true },
      ] } };
    } } };
    return {};
  });
  let result = await push.pushPendingChanges('a');
  assert.equal(result.pendingChanges, 3);
  assert.equal(result.retryablePending, 0);
  assert.deepEqual(acknowledged, ['slip']);
  assert(pending.every((entry) => entry.blockedReason));
  pending.push(item('newer', 'bad', { _id: 'bad' }));
  result = await push.pushPendingChanges('a');
  assert.equal(calls, 1, 'Permanent conflicts and later edits to the same record must not retry');
  assert.equal(result.retryablePending, 0);
  assert.equal(result.pendingChanges, 4, 'Conflicting edits remain stored');

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
  console.log('Passed: legacy IDs, partial acknowledgements, persistent conflicts, ordered retries, and safe index migration.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
