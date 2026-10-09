const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE inventory_warehouses (
  _id TEXT PRIMARY KEY, companyId TEXT, code TEXT, name TEXT,
  description TEXT, address TEXT, type TEXT, isActive INTEGER,
  createdAt TEXT, updatedAt TEXT, isDeleted INTEGER DEFAULT 0,
  UNIQUE(companyId, code)
)`);
const database = {
  get: async (sql, args) => db.prepare(sql).get(...args),
  run: async (sql, args) => {
    try { db.prepare(sql).run(...args); }
    catch (error) { if (error.errcode === 2067) error.code = 'SQLITE_CONSTRAINT'; throw error; }
  },
};
const file = path.join(__dirname, '../src/electron/database/repositories/modules/inventory/inventoryWarehouse.repository.ts');
const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleStub = { exports: {} };
vm.runInNewContext(output, {
  exports: moduleStub.exports, module: moduleStub,
  require: name => name.endsWith('/db.js') ? database : require(name),
});

(async () => {
  const repository = new moduleStub.exports.InventoryWarehouseRepository();
  const input = { name: 'Principal', type: 'GENERAL', isActive: true };
  const first = await repository.create('company', input);
  const second = await repository.create('company', { ...input, code: '  ' });
  assert.equal(first.code, 'ENT-001');
  assert.equal(second.code, 'ENT-002');
  assert.equal(db.prepare('SELECT code FROM inventory_warehouses WHERE _id = ?').get(first._id).code, first.code);
  const custom = await repository.create('company', { ...input, code: ' ent-009 ' });
  assert.equal(custom.code, 'ENT-009');
  db.prepare('UPDATE inventory_warehouses SET isDeleted = 1 WHERE _id = ?').run(custom._id);
  await repository.create('company', { ...input, code: 'ENT-123-LEGACY' });
  assert.equal((await repository.create('company', input)).code, 'ENT-010');
  assert.equal((await repository.create('other-company', input)).code, 'ENT-001');
  const concurrent = await Promise.all([repository.create('company', input), repository.create('company', input)]);
  assert.deepEqual(concurrent.map(row => row.code).sort(), ['ENT-011', 'ENT-012']);
  const count = () => db.prepare('SELECT COUNT(*) AS total FROM inventory_warehouses').get().total;
  const before = count();
  await assert.rejects(repository.create('company', { ...input, name: '' }));
  await assert.rejects(repository.update('company', first._id, input));
  assert.equal(count(), before, 'Invalid inputs must not write');
  await repository.create('full-company', { ...input, code: 'ENT-999' });
  await assert.rejects(repository.create('full-company', input), /ENT-999/);
  db.close();
  console.log('Passed: sequential codes, padding, persistence, deleted and legacy codes, tenant isolation, concurrent creation, validation and sequence limit.');
})().catch(error => { console.error(error); process.exitCode = 1; });
