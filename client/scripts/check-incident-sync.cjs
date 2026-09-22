// Exercise the actual push/pull services with transport and persistence adapters.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sourceRoot = path.resolve(__dirname, '../src/electron/services/sync');
let pending = [], failPush = false, failApply = false;
let acknowledged = [], applied = [], cursor = 0;
const snapshot = { _id: 'incident-1', companyId: 'company-a', updatedAt: '2026-09-22T09:00:00.000Z' };
let confirmed = ['queue-1'];
const transport = {
  post: async (url) => {
    assert(url.endsWith('/sync/push'));
    if (failPush) throw new Error('offline');
    return { status: 200, data: { synced: confirmed } };
  },
  get: async (_url, options) => {
    assert.equal(options.headers['x-company-id'], 'company-a');
    const { entity, afterVersion } = options.params;
    if (entity !== 'incident' || afterVersion >= 2) return { data: { items: [], hasMore: false } };
    return { data: { items: [{ ...snapshot, serverVersion: afterVersion + 1 }], nextVersion: afterVersion + 1,
      hasMore: afterVersion === 0, serverTime: '2026-09-22T10:00:00.000Z' } };
  },
};
const queue = {
  getUnsyncedItems: async () => pending,
  markManySynced: async (_company, ids) => { pending = pending.filter((item) => !ids.includes(item._id)); },
};
function load(filename) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(sourceRoot, filename), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (name) => {
    if (name === 'axios') return transport;
    if (name === 'electron') return { app: { isPackaged: false } };
    if (name.endsWith('/auth.js')) return { getToken: async () => 'token' };
    if (name.endsWith('/sync.repository.js')) return queue;
    if (name.endsWith('/incidents.repository.js')) return {
      markIncidentSynced: async (...args) => acknowledged.push(args),
      upsertIncident: async (company, incident) => { assert.equal(company, 'company-a'); if (failApply) throw new Error('pending edit'); applied.push(incident); },
    };
    if (name.endsWith('/syncState.repository.js')) return {
      getSyncState: async (_company, entity) => ({ lastPulledVersion: entity === 'incident' ? cursor : 0 }),
      updateLastPulledVersion: async (_company, entity, version) => { if (entity === 'incident') cursor = version; },
    };
    if (name.startsWith('.')) return new Proxy({}, { get: () => async () => undefined });
    return require(name);
  };
  vm.runInNewContext(code, { require: localRequire, module, exports: module.exports, process, console: { log() {}, warn() {}, error() {} } });
  return module.exports;
}
(async () => {
  const { pushPendingChanges } = load('push.service.ts');
  const { pullLatestChanges } = load('pull.service.ts');
  const entry = (id) => ({ _id: id, companyId: 'company-a', entity: 'incident', operation: 'update', payload: JSON.stringify(snapshot) });
  pending = [entry('queue-1'), entry('queue-2')];
  await pushPendingChanges('company-a');
  assert.equal(pending.length, 1);
  assert.equal(pending[0]._id, 'queue-2');
  assert.deepEqual(acknowledged[0], ['company-a', snapshot._id, snapshot.updatedAt]);
  failPush = true;
  await assert.rejects(() => pushPendingChanges('company-a'));
  assert.equal(pending.length, 1);
  failPush = false;
  confirmed = ['queue-2'];
  await pushPendingChanges('company-a');
  assert.equal(pending.length, 0);
  failApply = true;
  await assert.rejects(() => pullLatestChanges('company-a'));
  assert.equal(cursor, 0, 'Failed batch must not advance cursor');
  failApply = false;
  await pullLatestChanges('company-a');
  assert.equal(cursor, 2);
  assert.deepEqual(applied.map((item) => item.serverVersion), [1, 2]);
  await pullLatestChanges('company-a');
  assert.equal(applied.length, 2, 'Completed cursor must not reapply old changes');
  console.log('Passed: incident push routing, partial acknowledgements, offline retry, paginated pull and failed-batch cursor retention.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
