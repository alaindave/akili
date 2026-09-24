const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('../../server/node_modules/mongoose');
function load(file, resolve) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console: { log() {}, warn() {} }, process: { env: { VITE_API_URL: "http://test" } }, require: resolve });
  return module.exports;
}
const Model = load('../../server/models/payrollEmployeeProfile.model.ts', () => mongoose).default;
const stored = new Map();
let version = 0;
const key = ({ companyId, _id }) => `${companyId}:${_id}`;
const profileModel = {
  updateOne: async (filter, update) => {
    const previous = stored.get(key(filter));
    const doc = new Model({ ...previous, ...update.$setOnInsert, ...update.$set });
    stored.set(key(filter), doc.toObject());
  },
  findOne: (filter) => {
    const record = stored.get(key(filter)) ?? null;
    return { lean: async () => record, then: (resolve) => Promise.resolve(record).then(resolve) };
  },
};
const employeeModel = { findOne: ({ companyId }) => ({ lean: async () => ({ accountNumber: companyId === 'a' ? '00123' : 'cash' }) }) };
const server = load('../../server/sync.ts', (name) => {
  if (name.endsWith('/payrollEmployeeProfile.model.js')) return { default: profileModel };
  if (name.endsWith('/employee.model.js')) return { default: employeeModel };
  if (name.endsWith('/syncVersion.js')) return { getNextSyncVersion: async () => ++version };
  return { default: {} };
});
(async () => {
  const payload = { _id: 'profile', companyId: 'a', employeeId: 'employee', updatedAt: '2026-09-25T00:00:00Z' };
  let response = await server.syncPayrollProfile('create', { ...payload, accountNumber: ' 000456 ' });
  assert.equal(response.profile.accountNumber, '000456');
  assert.equal(response.serverVersion, 1);
  response = await server.syncPayrollProfile('update', payload); // Old queue item.
  assert.equal(response.profile.accountNumber, '000456');
  response = await server.syncPayrollProfile('update', { ...payload, accountNumber: '  ' });
  assert.equal(response.profile.accountNumber, 'cash');
  response = await server.syncPayrollProfile('create', { ...payload, _id: 'legacy' });
  assert.equal(response.profile.accountNumber, '00123');
  response = await server.syncPayrollProfile('create', { ...payload, companyId: 'b' });
  assert.equal(response.profile.accountNumber, 'cash');
  assert.equal(stored.get('a:legacy').accountNumber, '00123');
  assert.equal(new Model().accountNumber, 'cash');
  assert.equal(new Model({ accountNumber: '' }).accountNumber, 'cash');
  await assert.rejects(() => server.syncPayrollProfile('update', { ...payload, companyId: '' }));
  let pending = [{ _id: 'queue-1', companyId: 'a', entity: 'payroll_profile', operation: 'update',
    payload: JSON.stringify({ ...payload, accountNumber: '007700' }) }];
  let failRequest = true;
  const acknowledgements = [];
  class Form {
    append(name, value) { this[name] = value; }
    getHeaders() { return {}; }
  }
  const push = load('../src/electron/services/sync/push.service.ts', (name) => {
    if (name === 'electron') return { app: { isPackaged: false } };
    if (name === 'form-data') return { default: Form };
    if (name.endsWith('/auth.js')) return { getToken: async () => 'test-token' };
    if (name.endsWith('/sync.repository.js')) return {
      getUnsyncedItems: async () => pending,
      markManySynced: async (companyId, ids) => {
        assert.equal(companyId, 'a');
        pending = pending.filter((item) => !ids.includes(item._id));
      },
    };
    if (name.endsWith('/payroll_employee_profile.repository.js')) return {
      markPayrollEmployeeProfileSynced: async (...args) => acknowledgements.push(args),
    };
    if (name === 'axios') return { default: { post: async (url, form, options) => {
      if (failRequest) throw new Error('offline');
      assert.equal(options.headers['x-company-id'], 'a');
      const items = JSON.parse(form.items);
      assert.equal(items[0].data.accountNumber, '007700');
      for (const item of items) await server.syncPayrollProfile(item.operation, item.data);
      return { status: 200, data: { synced: items.map((item) => item.queueId) } };
    } } };
    return { default: {} };
  });
  await assert.rejects(() => push.pushPendingChanges('a'));
  assert.equal(pending.length, 1);
  assert.equal(acknowledgements.length, 0);
  failRequest = false;
  const result = await push.pushPendingChanges('a');
  assert.equal(result.syncedCount, 1);
  assert.equal(pending.length, 0);
  assert.equal(stored.get('a:profile').accountNumber, '007700');
  assert.equal(acknowledgements[0][2], payload.updatedAt);
  console.log('Payroll MongoDB schema, push transport, and sync handler checks passed: normalization, versions, legacy payloads, tenant isolation.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
