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
    if (name.startsWith('.')) return {};
    return require(name);
  };
  vm.runInNewContext(code, { require: localRequire, module, exports: module.exports, console: { log() {}, warn() {}, error() {} }, Date, process }, { filename });
  return module.exports;
}
const Incident = load('models/incident.model.ts').default;
const records = new Map();
const copy = (value) => value ? structuredClone(value) : null;
const matches = (item, query) => Object.entries(query).every(([key, value]) =>
  value && typeof value === 'object' && '$gt' in value ? item[key] > value.$gt : item[key] === value);
Incident.findById = (id) => ({ lean: async () => copy(records.get(id)) });
Incident.create = async (data) => {
  if (records.has(data._id)) throw Object.assign(new Error('duplicate'), { code: 11000 });
  records.set(data._id, copy(data));
  return copy(data);
};
Incident.findOneAndUpdate = async (query, update) => {
  const current = records.get(query._id);
  if (!current || !matches(current, query)) return null;
  const next = { ...current, ...update.$set };
  records.set(query._id, copy(next));
  return copy(next);
};
Incident.find = (query) => {
  let limit = Infinity;
  const chain = {
    sort: () => chain,
    limit: (value) => { limit = value; return chain; },
    lean: async () => [...records.values()].filter((item) => matches(item, query))
      .sort((a, b) => a.serverVersion - b.serverVersion).slice(0, limit).map(copy),
  };
  return chain;
};
Incident.exists = async (query) => [...records.values()].some((item) => matches(item, query));
let version = 0;
const broadcasts = [];
const service = load('services/incidents.service.ts', {
  '../models/incident.model.js': { default: Incident, __esModule: true },
  '../utils/syncVersion.js': { getNextSyncVersion: async () => ++version },
  './socket.service.js': { broadcastEntityChange: (event) => broadcasts.push(event) },
});
const router = load('routes/sync.route.ts', {
  '../models/incident.model.js': { default: Incident, __esModule: true },
  '../services/incidents.service.js': service,
  '../middlewares/authorize.js': { default: (_req, _res, next) => next(), __esModule: true },
  '../middlewares/sync_upload.js': { default: { fields: () => (_req, _res, next) => next() }, __esModule: true },
}).default;
async function request(method, routePath, payload, companyId = 'company-a') {
  const route = router.stack.find((layer) => layer.route?.path === routePath && layer.route.methods[method]).route;
  let body, status = 200;
  const res = { status: (value) => { status = value; return res; }, json: (value) => { body = value; return res; } };
  await route.stack.at(-1).handle({ user: { companyId }, headers: { 'x-company-id': companyId },
    body: method === 'post' ? { items: JSON.stringify(payload) } : {}, query: method === 'get' ? payload : {} }, res);
  return { status, body: JSON.parse(JSON.stringify(body)) };
}
(async () => {
  const data = {
    _id: randomUUID(), companyId: 'company-a', incidentNumber: 'INC-220926-0905-742',
    reporterName: 'Alice', reporterContact: 'alice@example.com', occurredAt: '2026-09-22T07:05:00.000Z',
    location: 'Atelier', notes: 'Original', preventiveActions: '', remedialActions: '',
    createdAt: '2026-09-22T08:00:00.000Z', updatedAt: '2026-09-22T08:00:00.000Z',
    serverVersion: 999999, synced: 1,
  };
  const item = (queueId, operation, snapshot) => ({ queueId, entity: 'incident', operation, companyId: snapshot.companyId, data: snapshot });
  let response = await request('post', '/push', [item('1', 'create', data)]);
  assert.deepEqual(response.body.synced, ['1']);
  assert.equal(records.get(data._id).serverVersion, 1);
  assert.equal(records.get(data._id).synced, undefined);
  await request('post', '/push', [item('1', 'create', data)]);
  assert.equal(version, 1, 'Retry must not generate a new version');
  const updated = { ...data, notes: 'Updated', updatedAt: '2026-09-22T09:00:00.000Z', incidentNumber: 'Attempted replacement' };
  response = await request('post', '/push', [item('2', 'update', updated)]);
  assert.deepEqual(response.body.synced, ['2']);
  assert.equal(records.get(data._id).notes, 'Updated');
  assert.equal(records.get(data._id).incidentNumber, data.incidentNumber);
  await request('post', '/push', [item('1', 'create', data)]);
  assert.equal(records.get(data._id).notes, 'Updated', 'Late create must not undo update');
  response = await request('post', '/push', [item('bad', 'create', { ...data, _id: randomUUID(), reporterName: ' ' })]);
  assert.deepEqual(response.body.synced, []);
  response = await request('post', '/push', [item('cross', 'update', { ...updated, companyId: 'company-b' })]);
  assert.deepEqual(response.body.synced, []);
  await assert.rejects(() => service.syncIncident('update', { ...updated, companyId: 'company-b' }));
  await assert.rejects(() => service.syncIncident('delete', data));
  await service.syncIncident('update', { ...updated, _id: randomUUID(), incidentNumber: data.incidentNumber });
  await service.syncIncident('create', { ...data, _id: randomUUID(), companyId: 'company-b' });
  response = await request('get', '/pull', { entity: 'incident', afterVersion: '0', limit: '1' });
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.hasMore, true);
  const cursor = response.body.nextVersion;
  response = await request('get', '/pull', { entity: 'incident', afterVersion: String(cursor), limit: '1' });
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].companyId, 'company-a');
  assert.equal(response.body.hasMore, false);
  response = await request('get', '/pull', { entity: 'incident', afterVersion: String(response.body.nextVersion), limit: '1' });
  assert.equal(response.body.items.length, 0);
  assert(broadcasts.every((event) => event.entity === 'incident' && !event.data));
  console.log('Passed: incident model validation, push acknowledgements, replay safety, updates, tenant isolation, paginated pulls and change broadcasts.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
