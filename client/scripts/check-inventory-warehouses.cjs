// Run with Node 22+: node scripts/check-inventory-warehouses.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

const database = new DatabaseSync(':memory:');
const db = {
  run: async (sql, params = []) => {
    try { return database.prepare(sql).run(...params); }
    catch (error) {
      // node:sqlite and the application's sqlite3 driver use different codes.
      if (error.errcode === 2067) error.code = 'SQLITE_CONSTRAINT';
      throw error;
    }
  },
  get: async (sql, params = []) => database.prepare(sql).get(...params),
  all: async (sql, params = []) => database.prepare(sql).all(...params),
};

function load(relative) {
  const filename = path.resolve(__dirname, '../src/electron/database', relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, console,
    require: name => name.endsWith('/db.js') ? db : require(name),
  }, { filename });
  return module.exports;
}

(async () => {
  try {
    await load('schemas/modules/inventory/inventory_warehouses.schema.ts').createInventoryWarehouseTable();
    const { InventoryWarehouseRepository } = load('repositories/modules/inventory/inventoryWarehouse.repository.ts');
    const repository = new InventoryWarehouseRepository();
    const input = { code: ' ent-001 ', name: ' Principal ', type: 'GENERAL', isActive: true };
    const created = await repository.create('company-a', input);
    const saved = await repository.getById('company-a', created._id);
    assert.equal(saved.code, 'ENT-001');
    assert.equal(saved.name, 'Principal');
    assert.equal(saved.isActive, true);
    assert.equal(saved.synced, false);
    assert.equal(saved.isDeleted, false);
    assert.equal(await repository.getById('company-b', created._id), null);
    await assert.rejects(repository.create('company-a', input), /Un entrepôt avec ce code existe déjà/);
    await repository.create('company-b', input);
    await repository.create('company-a', { ...input, code: 'ENT-002', isActive: false });
    assert.equal(await repository.count('company-a'), 2);
    assert.equal(await repository.count('company-a', { isActive: true }), 1);
    assert.equal((await repository.list('company-a', { search: 'ENT-002' })).length, 1);
    assert.equal((await repository.list('company-a', { limit: 1, offset: 1 })).length, 1);
    for (const invalid of [{ code: ' ' }, { name: ' ' }, { type: 'INVALID' }, { isActive: 1 }]) {
      await assert.rejects(repository.create('company-a', { ...input, ...invalid }));
    }
    await db.run('UPDATE inventory_warehouses SET isDeleted = 1 WHERE _id = ?', [created._id]);
    assert.equal(await repository.count('company-a'), 1);
    await assert.rejects(repository.create('company-a', input), /Un entrepôt avec ce code existe déjà/);
    console.log('Passed: warehouse persistence, validation, duplicate codes, company isolation, filters, pagination and soft deletion.');
  } finally { database.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
