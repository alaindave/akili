const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

(async () => {
  let pending = 0;
  let statusListener, pendingListener, companyListener;
  let companyId = 'a';
  let resolveCount;
  let unsubscribed = 0;
  const store = {
    setPendingChanges: (count) => { pending = count; },
    setSyncing() {}, setOffline() {}, setSyncError() {},
    setSyncCompleted() {}, resetSyncStatus() {},
  };
  const api = {
    getPendingCount: () => new Promise((resolve) => { resolveCount = resolve; }),
    onSyncStatus: (callback) => { statusListener = callback; return () => unsubscribed++; },
    onPendingChanges: (callback) => { pendingListener = callback; return () => unsubscribed++; },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, '../src/renderer/services/syncManager.service.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, console,
    window: { electron: { sync: api } },
    require: (name) => ({ default: name.includes('auth.store') ? {
      getState: () => ({ adminUser: { companyId } }),
      subscribe: (callback) => { companyListener = callback; return () => unsubscribed++; },
    } : { getState: () => store } }),
  });
  const manager = module.exports;
  manager.initializeRendererSync();
  resolveCount(2);
  await new Promise(setImmediate);
  assert.equal(pending, 2, 'Existing unpushed items must load on startup');
  for (const status of ['OFFLINE', 'ERROR', 'SYNCING']) {
    statusListener({ status, pendingChanges: 2 });
    assert.equal(pending, 2, `${status} must retain unpushed items`);
  }
  statusListener({ status: 'SYNCING' });
  assert.equal(pending, 2, 'A status without a count must not clear it');
  pendingListener({ companyId: 'other', pendingChanges: 10 });
  assert.equal(pending, 2);
  companyId = 'b';
  companyListener({ adminUser: { companyId } }, { adminUser: { companyId: 'a' } });
  pendingListener({ companyId: 'b', pendingChanges: 3 });
  resolveCount(1);
  await new Promise(setImmediate);
  assert.equal(pending, 3, 'A stale startup read must not overwrite a newer event');
  statusListener({ status: 'IDLE', pendingChanges: 0 });
  assert.equal(pending, 0, 'Successful push clears the count');
  manager.destroyRendererSync();
  assert.equal(unsubscribed, 3);
  console.log('Passed: startup count, failed/offline sync, company scope, stale reads, and cleanup.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
