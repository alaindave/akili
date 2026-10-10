// No live database or storage: exercise the real handlers with model adapters.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
function load(file, overrides = {}, expose = '') {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8') + expose, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Buffer, Date, Error,
    console: { log() {}, warn() {}, error() {} }, require: (name) => {
      if (name in overrides) return overrides[name];
      return name.startsWith('.') ? {} : require(name);
    },
  });
  return module.exports;
}
(async () => {
  let stored = { _id: 'e1', companyId: 'a', firstName: 'Before', serverVersion: 1,
    updatedAt: '2026-09-01', photo_path: 'a/e1/photo_v1.png', photo_hash: 'old',
    photo_mime_type: 'image/png', photo_version: 1 };
  let version = 1;
  const events = [];
  let failSave = false;
  const model = {
    findOne: () => {
      const document = { ...stored, save: async function () {
        events.push('save');
        if (failSave) throw new Error('database unavailable');
        stored = { ...this };
      } };
      return Object.assign(Promise.resolve(document), { lean: async () => ({ ...stored }) });
    },
    updateOne: async (_filter, update) => {
      assert(!Object.keys(update.$set).some((key) => key.startsWith('photo_')));
      stored = { ...stored, ...update.$set };
      return { matchedCount: 1 };
    },
  };
  const storage = { storage: { from: () => ({
    upload: async () => { events.push('upload'); return {}; },
    remove: async () => { events.push('remove'); return {}; },
  }) } };
  const sync = load('sync.ts', {
    './models/modules/hr/employee.model.js': model,
    './services/supabase.service.js': storage,
    './utils/syncVersion.js': { getNextSyncVersion: async () => ++version },
  });
  await sync.syncEmployee('update', { _id: 'e1', companyId: 'a', updatedAt: '2026-09-02',
    firstName: 'After', photo_path: 'local-only.png', photo_hash: null, photo_version: 0 });
  assert.equal(stored.firstName, 'After');
  assert.equal(stored.photo_path, 'a/e1/photo_v1.png');
  assert.equal(stored.photo_hash, 'old');
  const photo = { employeeId: 'e1', companyId: 'a', photo_filename: 'photo.png',
    photo_version: 2, photo_mime_type: 'image/png', photo_hash: crypto.createHash('sha256').update('photo').digest('hex'), updatedAt: '2026-09-03' };
  const file = { buffer: Buffer.from('photo'), originalname: 'photo.png', mimetype: 'image/png' };
  failSave = true;
  await assert.rejects(() => sync.syncEmployeePhoto(photo, file), /database unavailable/);
  assert.deepEqual(events, ['upload', 'save'], 'Failed database save must retain the old cloud file');
  failSave = false;
  events.length = 0;
  await sync.syncEmployeePhoto(photo, file);
  assert.deepEqual(events, ['upload', 'save', 'remove']);
  assert.equal(stored.photo_path, 'a/e1/photo_v2.png');
  events.length = 0;
  await sync.syncEmployeePhoto(photo, file);
  assert.deepEqual(events, [], 'Retry must not upload or allocate a new version');
  await sync.syncEmployeePhoto({ ...photo, photo_version: 1, updatedAt: '2026-09-02' }, file);
  assert.deepEqual(events, [], 'An older photo must not replace the newer server photo');
  await assert.rejects(() => sync.syncEmployeePhoto({ ...photo, photo_version: 3, photo_hash: 'wrong' }, file), /QUEUED HASH/);

  const route = load('routes/shared/sync.route.ts', {
    '../../middlewares/authorize.js': (_req, _res, next) => next(),
    '../../middlewares/sync_upload.js': { fields: () => (_req, _res, next) => next() },
  }, '\nexport { pullVersionedCollection };');
  const records = [{ serverVersion: 1, isDeleted: 0 }, { serverVersion: 2, isDeleted: 1 }, { serverVersion: 3, isDeleted: 1 }];
  const collection = {
    find: (filter) => {
      let limit = Infinity;
      const chain = { sort: () => chain, limit: (n) => { limit = n; return chain; },
        lean: async () => records.filter((r) => r.serverVersion > filter.serverVersion.$gt).slice(0, limit) };
      return chain;
    },
    exists: async (filter) => records.some((r) => r.serverVersion > filter.serverVersion.$gt &&
      (filter.isDeleted === undefined || r.isDeleted === filter.isDeleted)),
  };
  const first = await route.pullVersionedCollection(collection, 'a', 0, 1);
  assert.equal(first.hasMore, true, 'Deleted records must count towards pagination');
  const second = await route.pullVersionedCollection(collection, 'a', first.nextVersion, 1);
  assert.equal(second.items[0].isDeleted, 1);
  assert.equal(second.hasMore, true);
  const third = await route.pullVersionedCollection(collection, 'a', second.nextVersion, 1);
  assert.equal(third.nextVersion, 3);
  assert.equal(third.hasMore, false);

  const requested = [];
  const photos = load('routes/modules/hr/employees_photos.route.ts', {
    '../../../models/modules/hr/employee.model.js': { findById: async () => ({ ...stored, photo_path: 'local.png' }) },
    '../../../services/supabase.service.js': { storage: { from: () => ({ download: async (name) => {
      requested.push(name);
      return name === 'local.png' ? { error: new Error('missing') } : {
        data: { type: 'image/png', arrayBuffer: async () => Buffer.from('recovered') },
      };
    } }) } },
  }).default;
  const handler = photos.stack.find((layer) => layer.route).route.stack.at(-1).handle;
  let status, bytes;
  const res = { status: (value) => { status = value; return res; }, setHeader() {},
    send: (value) => { bytes = value; return res; }, json: () => res };
  await handler({ params: { employeeId: 'e1' } }, res);
  assert.equal(status, 200);
  assert.equal(bytes.toString(), 'recovered');
  assert.deepEqual(requested, ['local.png', 'a/e1/photo_v2.png']);
  console.log('Passed: cloud photo metadata protection, upload/save/delete order, deletion pagination, and legacy photo-path recovery.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
