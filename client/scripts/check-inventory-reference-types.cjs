// Run with Node 22+.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const expected = ['PURCHASE_ORDER', 'SUPPLIER_DELIVERY', 'SALES_ORDER', 'SALES_RETURN', 'PRODUCTION_ORDER',
  'STOCK_COUNT', 'INVENTORY_ADJUSTMENT', 'STOCK_TRANSFER_REQUEST', 'OPENING_STOCK', 'MANUAL'];
const schemaFile = path.resolve(__dirname, '../src/electron/database/schemas/modules/inventory/inventory_movements.schema.ts');
function load(file, sql) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console: { log() {} },
    require: name => name.endsWith('/db.js') ? { run: async query => sql.exec(query) } :
      name.startsWith('.') ? load(path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts')), sql) : require(name),
  });
  return module.exports;
}
(async () => {
  const sql = new DatabaseSync(':memory:');
  const client = load(path.resolve(__dirname, '../src/common/types/inventory/InventoryDocument.ts'), sql);
  const server = load(path.resolve(__dirname, '../../server/models/modules/inventory/inventoryReferenceType.ts'), sql);
  assert.deepEqual(Array.from(client.INVENTORY_REFERENCE_TYPES), expected);
  assert.deepEqual(Array.from(server.INVENTORY_REFERENCE_TYPES), expected);
  const initialize = load(schemaFile, sql).createInventoryMovementsTables;
  await initialize();
  for (const legacy of [false, true]) {
    if (legacy) {
      // Recreate the original unconstrained schema, then exercise startup migration.
      const definitions = sql.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table'").all();
      for (const { name } of definitions) sql.exec(`DROP TABLE ${name}`);
      for (const { sql: definition } of definitions) sql.exec(definition.replace(/referenceType TEXT CHECK \(referenceType IS NULL OR referenceType IN \([^)]*\)\)/g, 'referenceType TEXT'));
    }
    const records = {
      inventory_documents: { _id: 'doc', companyId: 'company', documentNumber: 'DOC', type: 'RECEIPT', status: 'POSTED', documentDate: '2026-01-01', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      inventory_movements: { _id: 'move', companyId: 'company', movementId: 'move', documentId: 'doc', documentLineId: 'line', itemId: 'item', warehouseId: 'warehouse', quantity: 1, unitId: 'unit', direction: 'IN', movementType: 'RECEIPT', occurredAt: '2026-01-01', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    };
    const insert = (table, row, referenceType) => sql.prepare(`INSERT INTO ${table} (${Object.keys(row).join(',')}, referenceType) VALUES (${Object.keys(row).map(() => '?').join(',')}, ?)`).run(...Object.values(row), referenceType);
    if (legacy) for (const [table, row] of Object.entries(records)) insert(table, row, 'LEGACY');
    await initialize();
    await initialize();
    for (const [table, row] of Object.entries(records)) {
      if (legacy) {
        assert.equal(sql.prepare(`SELECT referenceType FROM ${table}`).get().referenceType, 'LEGACY');
        sql.exec(`UPDATE ${table} SET referenceType = referenceType, updatedAt = '2026-01-02'`);
        assert.throws(() => sql.exec(`UPDATE ${table} SET referenceType = 'INVALID'`));
        sql.exec(`DELETE FROM ${table}`);
      }
      for (const referenceType of [...expected, null]) {
        insert(table, row, referenceType);
        assert.throws(() => sql.exec(`UPDATE ${table} SET referenceType = 'INVALID'`));
        sql.exec(`UPDATE ${table} SET referenceType = 'MANUAL'`);
        sql.exec(`DELETE FROM ${table}`);
      }
      for (const value of ['INVALID', '', 'manual']) assert.throws(() => insert(table, row, value));
    }
  }
  sql.close();
  console.log('Passed: reference type parity, all allowed values, NULL, invalid inserts/updates, legacy preservation, and repeatable SQLite migration.');
})().catch(error => { console.error(error); process.exitCode = 1; });
