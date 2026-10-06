// Node 22+: validates real Mongoose schema and sync routes with an in-memory model adapter.
// No MongoDB connection, network listener, or production data is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (name) => {
    if (name in overrides) return overrides[name];
    if (name === './appModule.js') return load('models/appModule.ts');
    if (name.startsWith('.')) return {};
    return require(name);
  };
  vm.runInNewContext(code, { require: localRequire, module, exports: module.exports, console: { log() {}, warn() {}, error() {} }, Date, process }, { filename });
  return module.exports;
}
const { APP_MODULES } = load('models/appModule.ts');
const Task = load('models/task.model.ts').default;
const Incident = load('models/incident.model.ts').default;
const rows = {
  task: [{ _id: 'old-task', serverVersion: 1 }, { _id: 'stock-task', module: 'INVENTORY', serverVersion: 2 }],
  incident: [{ _id: 'old-incident', module: null, serverVersion: 3 }, { _id: 'sales-incident', module: 'SALES', serverVersion: 4 }],
};
const versions = { task: 10, incident: 10 };
const model = entity => ({ collection: {
  find: () => (async function* () {
    for (const row of rows[entity]) if (row.module == null) yield { _id: row._id };
  })(),
  updateOne: async (filter, update) => {
    assert.equal(filter.module, null);
    const row = rows[entity].find(row => row._id === filter._id && row.module == null);
    if (row) Object.assign(row, update.$set);
  },
} });
const { migrateTaskIncidentModules } = load('utils/migrateTaskIncidentModules.ts', {
  '../models/task.model.js': { default: model('task'), __esModule: true },
  '../models/incident.model.js': { default: model('incident'), __esModule: true },
  './syncVersion.js': { getNextSyncVersion: async entity => ++versions[entity] },
});
(async () => {
  for (const Model of [Task, Incident]) {
    assert.equal(new Model().module, 'HR');
    for (const module of APP_MODULES) {
      const document = new Model({ module });
      await document.validate(['module']);
      assert.equal(document.toObject().module, module);
    }
    await assert.rejects(() => new Model({ module: 'INVALID' }).validate(['module']));
    await assert.rejects(() => new Model({ module: null }).validate(['module']));
  }
  await migrateTaskIncidentModules();
  assert.equal(rows.task[0].module, 'HR');
  assert.equal(rows.incident[0].module, 'HR');
  assert.equal(rows.task[0].serverVersion, 11);
  assert.equal(rows.incident[0].serverVersion, 11);
  assert.equal(rows.task[1].module, 'INVENTORY');
  assert.equal(rows.incident[1].module, 'SALES');
  assert.equal(rows.task[1].serverVersion, 2);
  assert.equal(rows.incident[1].serverVersion, 4);
  await migrateTaskIncidentModules();
  assert.deepEqual(versions, { task: 11, incident: 11 });
  console.log('Passed: task/incident module enums, defaults, serialized documents, legacy migration and repeat-run safety.');
})().catch(error => { console.error(error); process.exitCode = 1; });
