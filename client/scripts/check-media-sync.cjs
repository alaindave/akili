// Node 22+: real SQLite and temporary files; HTTP and Electron are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akili-media-'));
const database = new DatabaseSync(':memory:');
const db = {
  run: async (sql, params = []) => database.prepare(sql).run(...params),
  get: async (sql, params = []) => database.prepare(sql).get(...params) ?? null,
  all: async (sql, params = []) => database.prepare(sql).all(...params),
};
const queued = [];
const cursors = new Map([['employee', 99]]);
let downloads = 0;
let failDownload = false;
let responseBytes = Buffer.from('png photo bytes');
let remote = [];
const employee = () => db.get('SELECT * FROM employees WHERE _id = ?', ['e1']);
const directories = { getEmployeePhotoDir: () => root, getEmployeeDocumentsDir: () => root };
const auth = { getToken: async () => 'token' };
let queueId = 0;
const syncQueue = {
  getUnsyncedItems: async () => queued.map((item) => ({ ...item })),
  addToSyncQueue: async (item) => queued.push({ ...item, _id: String(++queueId) }),
  markManySynced: async (_company, ids) => {
    for (let i = queued.length - 1; i >= 0; i--) if (ids.includes(queued[i]._id)) queued.splice(i, 1);
  },
};
const http = { get: async (url, options) => {
  if (url.endsWith('/sync/pull')) {
    assert.equal(options.params.entity, 'employee');
    const items = remote.filter((item) => item.serverVersion > options.params.afterVersion);
    return { data: { items, nextVersion: items.at(-1)?.serverVersion ?? options.params.afterVersion, hasMore: false } };
  }
  downloads++;
  if (failDownload) throw new Error('temporary download failure');
  return { data: responseBytes };
} };
function load(file, overrides = {}, expose = '') {
  const filename = path.resolve(__dirname, '..', file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8') + expose, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Buffer, Date, Error, process,
    console: { log() {}, warn() {}, error() {} }, require: (name) => {
      if (name in overrides) return overrides[name];
      if (name === 'electron') return { app: { isPackaged: true } };
      if (name === 'axios') return http;
      if (name.endsWith('/db.js')) return db;
      if (name.endsWith('/auth.js')) return auth;
      if (name.endsWith('/directories.js')) return directories;
      if (name.endsWith('/sync.repository.js')) return syncQueue;
      if (name.endsWith('/syncState.repository.js')) return {
        getSyncState: async (_company, entity) => ({ lastPulledVersion: cursors.get(entity) ?? 0 }),
        updateLastPulledVersion: async (_company, entity, version) => cursors.set(entity, version),
      };
      if (name.endsWith('/employees.repository.js')) return { getEmployeeById: employee };
      if (name.startsWith('.')) return {};
      return require(name);
    },
  });
  return module.exports;
}
(async () => {
  await load('src/electron/database/schemas/modules/hr/employees.schema.ts').createEmployeesTable();
  database.exec(`INSERT INTO employees (_id, companyId, firstName, lastName, matricule, idNum,
    dateBirth, role, dateHired, department, telephone, address, emergencyContact, relationship,
    contactPhone, salary, synced) VALUES ('e1','a','A','B','1','ID','1990-01-01','Worker',
    '2026-01-01','Atelier','','','','','',500,1)`);
  const photoRepo = load('src/electron/database/repositories/modules/hr/employees_photos.repository.ts');
  const downloader = load('src/electron/util/downloadEmployeePhoto.util.ts');
  const pull = load('src/electron/services/sync/pull.service.ts', {
    '../../util/downloadEmployeePhoto.util.js': downloader,
    '../../database/repositories/modules/hr/employees_photos.repository.js': photoRepo,
  }, '\nexport { syncEmployeePhotos, syncEmployeePhotoFiles, pullEntityByVersion };');
  const hash = crypto.createHash('sha256').update(responseBytes).digest('hex');
  remote = [{ ...(await employee()), photo_filename: 'remote.png', photo_version: 1,
    photo_hash: hash, photo_mime_type: 'image/png', serverVersion: 7 }];
  const pullPhotos = () => pull.syncEmployeePhotoFiles('a');

  failDownload = true;
  await assert.rejects(pullPhotos, /CURSOR WAS NOT ADVANCED/);
  assert.equal(cursors.get('employee_photo'), undefined);
  assert.equal(cursors.get('employee'), 99);
  failDownload = false;
  await pullPhotos();
  assert.equal(cursors.get('employee_photo'), 7);
  let local = await employee();
  assert.equal(local.photo_path, 'a/e1/photo_v1.png', 'Fresh install must use remote MIME type');
  assert.deepEqual(fs.readFileSync(path.join(root, local.photo_path)), responseBytes);
  const count = downloads;
  assert.equal(await pull.syncEmployeePhotos(remote), true);
  assert.equal(downloads, count, 'Existing matching photo should not download again');
  fs.unlinkSync(path.join(root, local.photo_path));
  await pullPhotos();
  assert(fs.existsSync(path.join(root, local.photo_path)), 'Missing file must recover even after its cursor advanced');
  assert.equal(downloads, count + 1);

  responseBytes = Buffer.from('wrong cached content');
  const next = [{ ...remote[0], photo_version: 2 }];
  assert.equal(await pull.syncEmployeePhotos(next), false, 'Hash mismatch must remain retryable');
  assert.equal((await employee()).photo_version, 1);
  responseBytes = Buffer.from('png photo bytes');

  const first = await photoRepo.uploadEmployeePhoto('a', 'e1', { name: 'one.png', buffer: Buffer.from('one') });
  const second = await photoRepo.uploadEmployeePhoto('a', 'e1', { name: 'two.png', buffer: Buffer.from('two') });
  assert.notEqual(first.photo_path, second.photo_path);
  assert.equal(fs.readFileSync(path.join(root, first.photo_path)).toString(), 'one');
  await photoRepo.markEmployeePhotoSynced('a', 'e1', first.photo_hash);
  assert.equal((await employee()).photo_needs_upload, 1, 'Old acknowledgement must preserve the new upload');
  await assert.rejects(() => photoRepo.updateEmployeePhotoMetadata('a', 'e1', {
    photo_path: 'old.png', photo_filename: 'old.png', photo_version: 1,
  }), /changed during download/);
  assert.equal((await employee()).photo_path, second.photo_path);
  assert.equal(await pull.syncEmployeePhotos(remote), false, 'Pull must preserve pending upload');

  // Remaining local edits must block application and retain the entity cursor.
  queued.push({ entity: 'employee', entityId: 'e1' });
  cursors.set('employee', 0);
  let applied = false;
  await assert.rejects(() => pull.pullEntityByVersion('a', 'employee', async () => { applied = true; return true; }), /CURSOR WAS NOT ADVANCED/);
  assert.equal(applied, false);
  assert.equal(cursors.get('employee'), 0);
  queued.pop();

  // Upload only the newest queued photo, and retain changes made during HTTP.
  class Form {
    append(name, value) { this[name] = value; }
    getHeaders() { return {}; }
  }
  let rejectUpload = true;
  let editDuringPush = true;
  const push = load('src/electron/services/sync/push.service.ts', {
    'form-data': Form,
    fs: { existsSync: () => true, createReadStream: (filename) => filename },
    '../../database/repositories/modules/hr/employees_photos.repository.js': photoRepo,
    axios: { post: async (_url, form) => {
      const items = JSON.parse(form.items);
      assert.equal(items.length, 1, 'Superseded photos must not be uploaded');
      if (rejectUpload) return { data: { synced: [] } };
      if (editDuringPush) {
        await photoRepo.uploadEmployeePhoto('a', 'e1', { name: 'three.png', buffer: Buffer.from('three') });
        editDuringPush = false;
      }
      return { data: { synced: [items[0].queueId] } };
    } },
  });
  await push.pushPendingChanges('a');
  assert.equal(queued.length, 2, 'Failed replacement must preserve both photo queue entries');
  rejectUpload = false;
  await push.pushPendingChanges('a');
  assert.equal(queued.length, 1, 'Successful replacement retires older snapshots only');
  assert.equal((await employee()).photo_needs_upload, 1);
  await push.pushPendingChanges('a');
  assert.equal(queued.length, 0);
  assert.equal((await employee()).photo_needs_upload, 0);

  await load('src/electron/database/schemas/modules/hr/payroll.schema.ts').createPayrollTables();
  database.exec(`INSERT INTO payroll_components (companyId, _id, name, displayName, type,
    calculationType, displayOrder, createdAt, updatedAt)
    VALUES ('a', 'c1', 'BASE_SALARY', 'Base', 'EARNING', 'FIXE', 1, '2026-09-01', '2026-09-01')`);
  const profiles = load('src/electron/database/repositories/modules/hr/payroll_employee_profile.repository.ts');
  const profile = { companyId: 'a', _id: 'p1', employeeId: 'e1', componentId: 'c1',
    name: 'BASE_SALARY', displayName: 'Base', displayOrder: 1, type: 'EARNING', calculationType: 'FIXE',
    value: 500, taxable: 1, enabled: 1, requiresHRApproval: 0, serverVersion: 1,
    createdAt: '2026-09-01', updatedAt: '2026-09-01', accountNumber: '00123' };
  const inserted = await profiles.upsertEmployeePayrollProfile(profile);
  assert.equal(inserted.accountNumber, '00123');
  assert.equal(inserted.synced, 1);
  assert(inserted.lastSyncedAt);
  const updated = await profiles.upsertEmployeePayrollProfile({ ...profile, value: 600, serverVersion: 2 });
  assert.equal(updated.value, 600);
  assert.equal(updated.serverVersion, 2);
  console.log('Passed: fresh-install PNG photos, failed-download retry, separate cursors, missing files, hashes, immutable uploads, acknowledgement races, pending-edit protection, and payroll profile SQL.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});
