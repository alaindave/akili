// Repository validation checks without opening the user's database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const rows = new Map();
let writes = 0;
const database = {
  get: async (_sql, [company, id]) => {
    const row = rows.get(id);
    return row?.companyId === company ? row : undefined;
  },
  all: async (_sql, [company, warehouse, parent]) => [...rows.values()].filter(row => row.companyId === company && row.warehouseId === warehouse && row.parentId === parent),
  run: async (sql, args) => {
    writes++;
    if (sql.startsWith('INSERT')) {
      const [_id, companyId, warehouseId, parentId, code, name, locationType, isActive, createdAt, updatedAt] = args;
      rows.set(_id, { _id, companyId, warehouseId, parentId, code, name, locationType, isActive, createdAt, updatedAt, synced: 0, isDeleted: 0, serverVersion: 0 });
    } else {
      const [code, name, locationType, parentId, isActive, updatedAt, , id] = args;
      Object.assign(rows.get(id), { code, name, locationType, parentId, isActive, updatedAt });
    }
  },
};
const file = path.join(__dirname, '../src/electron/database/repositories/modules/inventory/inventoryLocation.repository.ts');
const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleStub = { exports: {} };
vm.runInNewContext(output, {
  exports: moduleStub.exports, module: moduleStub,
  require: name => name.endsWith('/db.js') ? database : name.endsWith('inventoryWarehouse.repository.js') ? {
    InventoryWarehouseRepository: class { async getById(company, id) { return company === 'company' && id === 'warehouse' ? { _id: id } : null; } },
  } : require(name),
});
const repository = new moduleStub.exports.InventoryLocationRepository();
repository.codeExists = async (company, warehouse, code, excluded) => [...rows.values()].some(row => row.companyId === company && row.warehouseId === warehouse && row.code === code && row._id !== excluded);
const input = (code, locationType, parentId = null) => ({ warehouseId: 'warehouse', code, name: code, locationType, parentId, isActive: true });
(async () => {
  const zone = await repository.create('company', input('zone', 'ZONE'));
  assert.equal(zone.code, 'ZONE');
  assert.equal(zone.parentId, undefined);
  const rack = await repository.create('company', input('rack', 'RACK', zone._id));
  const bin = await repository.create('company', input('bin', 'BIN', rack._id));
  assert.equal(bin.parentId, rack._id);
  await repository.update('company', bin._id, { ...input('bin', 'BIN', rack._id), name: 'Renamed bin', isActive: false });
  assert.equal(rows.get(bin._id).name, 'Renamed bin');
  assert.equal(rows.get(bin._id).isActive, 0);
  const before = writes;
  await assert.rejects(repository.create('company', input('zone', 'ZONE')), /code existe/);
  await assert.rejects(repository.create('other-company', input('foreign', 'ZONE')), /introuvable/);
  await assert.rejects(repository.create('company', input('child', 'RACK', bin._id)), /Parent incompatible/);
  await assert.rejects(repository.update('company', rack._id, input('rack', 'RACK', rack._id)), /Parent incompatible/);
  await assert.rejects(repository.update('company', zone._id, input('zone', 'BIN')), /enfants/);
  await assert.rejects(repository.create('company', input('bad', 'INVALID')));
  rows.get(zone._id).parentId = rack._id;
  await assert.rejects(repository.create('company', input('cycle', 'BIN', rack._id)), /boucle/);
  rows.get(zone._id).parentId = null;
  rows.set('foreign', { ...rows.get(zone._id), _id: 'foreign', warehouseId: 'another-warehouse' });
  await assert.rejects(repository.create('company', input('cross-warehouse', 'RACK', 'foreign')), /Parent incompatible/);
  assert.equal(writes, before, 'Invalid operations must not write');
  console.log('Passed: location creation, editing, duplicate codes, tenant isolation, parent hierarchy and cycle validation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
