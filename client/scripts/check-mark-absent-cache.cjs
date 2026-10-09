const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const events = [];
let source = 'LOCAL';
let syncSuccess = true;
let cached;
let releaseRead;
const client = {
  cancelQueries: async () => events.push('cancel'),
  invalidateQueries: async options => {
    assert.equal(options.refetchType, 'none');
    events.push('invalidate');
  },
  fetchQuery: async options => {
    assert.deepEqual(Array.from(options.queryKey), ['attendance', 'date', 'company', '2026-10-09']);
    cached = await options.queryFn();
    events.push('cached');
  },
};
const moduleStub = { exports: {} };
const file = path.join(__dirname, '../src/renderer/modules/hr/attendance/hooks/useAttendance.ts');
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: moduleStub.exports, module: moduleStub,
  require: () => ({ useQueryClient: () => client, useMutation: options => options }),
  window: { electron: {
    sync: { sync: async () => { events.push('sync'); return { success: syncSuccess, message: 'Sync failed' }; } },
    hr: { attendance: {
      markAbsent: async () => ({ source }),
      getByDate: async () => {
        events.push('read');
        await new Promise(resolve => { releaseRead = resolve; });
        return [{ _id: 'absent', status: 'ABSENT', firstName: 'Test' }];
      },
    } },
  } },
});
(async () => {
  for (source of ['LOCAL', 'AUTO_SERVER']) {
    events.length = 0;
    releaseRead = undefined;
    const mutation = moduleStub.exports.useMarkAbsent('company', '2026-10-09');
    let completed = false;
    const pending = mutation.onSuccess(await mutation.mutationFn()).then(() => { completed = true; });
    while (!releaseRead) await new Promise(resolve => setImmediate(resolve));
    assert.equal(completed, false, 'Mutation must wait for the employee list');
    releaseRead();
    await pending;
    assert.equal(cached[0].status, 'ABSENT');
    assert.deepEqual(events, source === 'LOCAL' ? ['cancel', 'invalidate', 'read', 'cached'] : ['sync', 'cancel', 'invalidate', 'read', 'cached']);
  }
  syncSuccess = false;
  events.length = 0;
  const mutation = moduleStub.exports.useMarkAbsent('company', '2026-10-09');
  await assert.rejects(mutation.onSuccess({ source: 'AUTO_SERVER' }), /Sync failed/);
  assert.deepEqual(events, ['sync']);
  console.log('Passed: local/online absence cache ordering, awaited list refresh, sync failure propagation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
