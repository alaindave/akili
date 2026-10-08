// Node 22.13+: exercise the real schema, repository, service, IPC and preload in memory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');
const handlers = new Map();
const adapter = {
  run: async (sql, params = []) => db.prepare(sql).run(...params),
  all: async (sql, params = []) => db.prepare(sql).all(...params),
  get: async (sql, params = []) => db.prepare(sql).get(...params) ?? null,
};
adapter.getDirect = adapter.get;
adapter.runDirect = adapter.run;
let transactions = Promise.resolve();
adapter.transaction = callback => {
  const result = transactions.then(async () => {
    db.exec('BEGIN');
    try { const value = await callback(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  });
  transactions = result.catch(() => {});
  return result;
};
let authenticatedCompany = 'company-a';
const root = path.resolve(__dirname, '../src/electron');
const cache = new Map();
const randomDigits = [];
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const localRequire = name => {
    if (name === 'node:crypto') return { ...require(name), randomInt: (...args) => randomDigits.length ? randomDigits.shift() : require(name).randomInt(...args) };
    if (name.endsWith('/db.js')) return adapter;
    if (name.endsWith('/auth.js')) return { getToken: async () => authenticatedCompany ? `header.${Buffer.from(JSON.stringify({ companyId: authenticatedCompany })).toString('base64url')}.signature` : null };
    if (name === 'electron') return {
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
      ipcRenderer: { invoke: (channel, ...args) => handlers.get(channel)({}, ...args) },
    };
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name.replace(/\.cjs$/, '.cts').replace(/\.js$/, '.ts'))));
    return require(name);
  };
  vm.runInNewContext(code, { require: localRequire, module, exports: module.exports, Buffer, console }, { filename });
  return module.exports;
}
(async () => {
  await load('database/schemas/modules/inventory/inventory_items.schema.ts').createInventoryItemsTable();
  load('ipc/modules/inventory/inventoryItem.ipc.ts').registerInventoryItemIpc();
  const api = load('preload/inventory/inventoryItem.preload.cts').inventoryItemApi;
  const options = await api.getCatalogOptions('company-a');
  assert.equal(options.units.length, 0);
  const unit = await api.createUnit('company-a', { code: ' kg ', name: 'Kilogramme', category: 'WEIGHT', decimalPlaces: 3 });
  assert.equal(unit.code, 'KG');
  assert.equal((await api.getCatalogOptions('company-a')).units[0]._id, unit._id);
  await assert.rejects(() => api.createUnit('company-a', { code: 'KG', name: 'Duplicate', category: 'WEIGHT', decimalPlaces: 0 }));
  await assert.rejects(() => api.createUnit('company-a', { code: 'X', name: 'Invalid', category: 'WEIGHT', decimalPlaces: 11 }));
  const input = { sku: ' mat-001 ', name: ' Cuir ', itemType: 'RAW_MATERIAL', baseUnitId: unit._id, trackingMethod: 'LOT', reorderPoint: 0, reorderQuantity: 5, customFields: { finish: 'mat' } };
  const item = await api.create('company-a', input);
  assert.equal(item.sku, 'MAT-001');
  assert.equal(item.name, 'Cuir');
  assert.equal(item.isActive, true);
  const persisted = await api.getById('company-a', item._id);
  assert.equal(persisted.baseUnitId, unit._id);
  assert.equal(persisted.isActive, true);
  assert.equal(persisted.synced, false);
  assert.equal(persisted.customFields.finish, 'mat');
  assert.equal(persisted.reorderPoint, 0);
  await assert.rejects(() => api.create('company-a', input), /référence/);
  for (const change of [{ name: ' ' }, { sku: '' }, { baseUnitId: 'missing' }, { categoryId: 'missing' }, { itemType: 'INVALID' }, { trackingMethod: 'INVALID' }, { reorderPoint: -1 }, { reorderQuantity: 0 }, { isActive: 'yes' }]) {
    await assert.rejects(() => api.create('company-a', { ...input, sku: 'TEST', ...change }));
  }
  await api.create('company-a', { ...input, sku: 'STOCK-002', name: 'Boucle', itemType: 'COMPONENT', isActive: false });
  assert.equal(await api.count('company-a'), 2);
  assert.equal((await api.list('company-a', { search: 'cuir' }))[0]._id, item._id);
  assert.equal((await api.list('company-a', { itemType: 'RAW_MATERIAL', isActive: true })).length, 1);
  assert.equal(await api.count('company-a', { isActive: false }), 1);
  const firstPage = await api.list('company-a', { limit: 1, offset: 0 });
  const secondPage = await api.list('company-a', { limit: 1, offset: 1 });
  assert.equal(firstPage.length, 1); assert.equal(secondPage.length, 1);
  assert.notEqual(firstPage[0]._id, secondPage[0]._id);
  await assert.rejects(() => api.list('company-b'), /Access denied/);
  await assert.rejects(() => api.createUnit('company-b', { code: 'KG', name: 'Kilogramme', category: 'WEIGHT', decimalPlaces: 0 }), /Access denied/);
  authenticatedCompany = 'company-b';
  assert.equal(await api.count('company-b'), 0);
  assert.equal((await api.getCatalogOptions('company-b')).units.length, 0);
  await assert.rejects(() => api.create('company-b', input), /unité valide/);
  assert.equal(await api.getById('company-b', item._id), null);
  authenticatedCompany = 'company-a';
  load('ipc/modules/inventory/stockSettings.ipc.ts').registerStockSettingsIpc();
  const settings = load('preload/inventory/stockSettings.preload.cts').stockSettingsApi;
  assert.equal((await settings.get('company-a')).numbering.enabled, false);
  await settings.saveCategory('company-a', { name: 'Matières', code: 'mat', isActive: true });
  let catalog = await settings.get('company-a');
  const category = catalog.categories[0];
  assert.equal(category.code, 'MAT');
  await assert.rejects(() => settings.saveCategory('company-a', { name: 'Matières', isActive: true }), /existe déjà/);
  await settings.saveCategory('company-a', { id: category._id, name: 'Matières premières', code: 'MAT', isActive: false });
  assert.equal((await api.getCatalogOptions('company-a')).categories.length, 0);
  await settings.saveCategory('company-a', { id: category._id, name: 'Matières premières', code: 'MAT', isActive: true });
  assert.equal((await api.getCatalogOptions('company-a')).categories.length, 1);
  await settings.saveUnit('company-a', { id: unit._id, code: 'KG', name: 'Kilogrammes', category: 'WEIGHT', decimalPlaces: 2 });
  assert.equal((await api.getCatalogOptions('company-a')).units[0].name, 'Kilogrammes');
  await assert.rejects(() => settings.saveUnit('company-a', { id: unit._id, code: 'KG', name: 'Kilogrammes', category: 'LENGTH', decimalPlaces: 2 }), /utilisée/);
  await assert.rejects(() => settings.archiveUnit('company-a', unit._id), /utilisé/);
  await assert.rejects(() => api.create('company-a', { ...input, sku: '', autoGenerateSku: true }), /pas activée/);
  const config = { enabled: true };
  await settings.saveNumbering('company-a', config);
  await assert.rejects(() => settings.saveNumbering('company-a', { enabled: 'yes' }));
  await assert.rejects(() => api.create('company-a', { ...input, sku: '', autoGenerateSku: true }), /catégorie/);
  await api.create('company-a', { ...input, sku: 'MAT-00001' });
  const autoInput = { ...input, sku: '', autoGenerateSku: true, categoryId: category._id };
  // Force both a collision with a manual reference and a collision between generated references.
  randomDigits.push(1, 42, 42, 8342);
  const generated = await Promise.all([api.create('company-a', autoInput), api.create('company-a', autoInput)]);
  assert.equal(generated[0].sku, 'MAT-00042');
  assert.equal(generated[1].sku, 'MAT-08342');
  for (const row of generated) assert.match(row.sku, /^MAT-\d{5}$/);
  const numberingRepo = load('database/repositories/modules/inventory/stockSettings.repository.ts');
  await assert.rejects(() => numberingRepo.withGeneratedSku('company-a', category._id, async sku => {
    await adapter.runDirect("UPDATE inventory_items SET name = 'rolled back' WHERE _id = ?", [item._id]);
    throw new Error('Simulated insert failure');
  }));
  assert.equal((await api.getById('company-a', item._id)).name, 'Cuir');
  const { categorySkuPrefix } = load('../common/types/inventory/sku.ts');
  assert.equal(categorySkuPrefix(' Équipements '), 'EQU');
  assert.equal(categorySkuPrefix('Cuir'), 'CUI');
  await settings.saveCategory('company-a', { name: 'Équipements', code: 'EQ', isActive: true });
  const equipment = (await settings.get('company-a')).categories.find(row => row.code === 'EQ');
  randomDigits.push(0);
  const equipmentItem = await api.create('company-a', { ...autoInput, categoryId: equipment._id });
  assert.equal(equipmentItem.sku, 'EQU-00000');
  await settings.saveCategory('company-a', { name: 'AB', isActive: true });
  const shortCategory = (await settings.get('company-a')).categories.find(row => row.name === 'AB');
  await assert.rejects(() => api.create('company-a', { ...autoInput, categoryId: shortCategory._id }), /trois lettres/);
  await assert.rejects(() => settings.archiveCategory('company-a', category._id), /utilisé/);
  await settings.saveCategory('company-a', { name: 'Unused', isActive: true });
  const unused = (await settings.get('company-a')).categories.find(row => row.name === 'Unused');
  await settings.archiveCategory('company-a', unused._id);
  assert(!(await settings.get('company-a')).categories.some(row => row._id === unused._id));
  await settings.saveUnit('company-a', { code: 'M', name: 'Mètre', category: 'LENGTH', decimalPlaces: 2 });
  const unusedUnit = (await settings.get('company-a')).units.find(row => row.code === 'M');
  await settings.archiveUnit('company-a', unusedUnit._id);
  assert(!(await api.getCatalogOptions('company-a')).units.some(row => row._id === unusedUnit._id));
  await assert.rejects(() => settings.get('company-b'), /Access denied/);
  authenticatedCompany = 'company-b';
  assert.equal((await settings.get('company-b')).numbering.enabled, false);
  await assert.rejects(() => settings.saveCategory('company-b', { id: category._id, name: 'Hijack', isActive: true }), /introuvable/);
  await assert.rejects(() => settings.archiveUnit('company-b', unit._id), /introuvable/);
  authenticatedCompany = null;
  await assert.rejects(() => api.list('company-a'), /Authentication required/);
  console.log('Passed: inventory item/unit creation through preload and authenticated IPC, SQLite persistence, validation, duplicate references, company isolation, search, filters, pagination, stock settings CRUD, archive guards, atomic SKU generation, concurrent numbering and rollback.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
