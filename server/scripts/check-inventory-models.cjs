const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(name) {
  const file = path.resolve(__dirname, `../models/modules/inventory/inventory${name}.model.ts`);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInThisContext(`(function (module, exports, require) { ${code}\n})`, { filename: file })(module, module.exports, require);
  return module.exports.default;
}

const names = ['Item', 'Category', 'Unit', 'Movement', 'Balance', 'Document', 'DocumentLine', 'Warehouse', 'Location', 'SkuSettings'];
const models = Object.fromEntries(names.map((name) => [name, load(name)]));
const base = { _id: 'local-id', companyId: 'company', createdAt: new Date(), updatedAt: new Date() };
const valid = (name, fields) => {
  const doc = new models[name]({ ...base, ...fields });
  assert.equal(doc.validateSync(), undefined, `${name} should accept valid data`);
  return doc;
};
const invalid = (name, fields, key) => {
  const error = new models[name]({ ...base, ...fields }).validateSync();
  assert(error?.errors[key], `${name} should reject invalid ${key}`);
};
const item = { sku: 'SKU', name: 'Item', itemType: 'RAW_MATERIAL', baseUnitId: 'unit', trackingMethod: 'NONE' };
valid('Item', item);
invalid('Item', { ...item, reorderQuantity: 0 }, 'reorderQuantity');
invalid('Item', { ...item, reorderPoint: -1 }, 'reorderPoint');
invalid('Item', { ...item, isActive: 2 }, 'isActive');
valid('Category', { name: 'Category', code: null });
valid('Unit', { code: 'KG', name: 'Kilogram', category: 'WEIGHT' });
invalid('Unit', { decimalPlaces: 1.5 }, 'decimalPlaces');
invalid('Unit', { decimalPlaces: 11 }, 'decimalPlaces');
const movement = { movementId: 'move', documentId: 'doc', documentLineId: 'line', itemId: 'item', warehouseId: 'warehouse', quantity: 1, unitId: 'unit', direction: 'IN', movementType: 'RECEIPT', occurredAt: new Date() };
valid('Movement', movement);
invalid('Movement', { ...movement, quantity: 0 }, 'quantity');
invalid('Movement', { ...movement, direction: 'OTHER' }, 'direction');
invalid('Movement', { ...movement, unitCost: -1 }, 'unitCost');
const balance = valid('Balance', { itemId: 'item', warehouseId: 'warehouse', locationId: null });
assert.equal(balance.locationId, '');
assert.equal(balance.lotId, '');
invalid('Balance', { quantityOnHand: 1, quantityReserved: 2 }, 'quantityReserved');
valid('Document', { documentNumber: 'DOC', type: 'RECEIPT', status: 'DRAFT', documentDate: new Date() });
valid('DocumentLine', { documentId: 'doc', lineNumber: 1, itemId: 'item', quantity: 1, unitId: 'unit' });
invalid('DocumentLine', { lineNumber: 1.5 }, 'lineNumber');
valid('Warehouse', { code: 'WH', name: 'Warehouse' });
invalid('Warehouse', { code: '  ', name: 'Warehouse' }, 'code');
valid('Location', { warehouseId: 'warehouse', code: 'A', name: 'Shelf', locationType: 'SHELF' });
invalid('Location', { locationType: ' ' }, 'locationType');
valid('SkuSettings', {});
invalid('SkuSettings', { digits: 13 }, 'digits');
invalid('SkuSettings', { nextNumber: 0 }, 'nextNumber');
for (const [name, model] of Object.entries(models)) {
  assert(model.schema.indexes().some(([keys, options]) => keys.companyId === 1 && options.unique), `${name} needs company-scoped uniqueness`);
  if (name !== 'SkuSettings') {
    assert.equal(model.schema.path('_id').instance, 'String');
    assert(model.schema.indexes().some(([keys]) => keys.companyId === 1 && keys.serverVersion === 1));
    assert.equal(model.schema.path('synced'), undefined);
  }
}
const categoryIndex = models.Category.schema.indexes().find(([, options]) => options.unique);
assert.equal(categoryIndex[1].partialFilterExpression.code.$type, 'string');
console.log('Passed: 10 inventory models, defaults, constraints, stock bucket normalization, and index definitions (no database required).');
