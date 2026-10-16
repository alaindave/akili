import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import console from 'node:console';
import process from 'node:process';
import ts from 'typescript';
import * as renderer from '@react-pdf/renderer';

const require = createRequire(import.meta.url);
function load(file, resolve) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.resolve(import.meta.dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: resolve, Error, Date });
  return module.exports;
}

const report = load('src/electron/reports/inventory/stock-movement-report.tsx', name =>
  name === '@react-pdf/renderer' ? renderer : require(name));
const document = { _id: 'entry', companyId: 'a', type: 'RECEIPT', documentNumber: 'ENT/001',
  postedAt: '2026-10-15T10:00:00Z', warehouseId: 'warehouse', postedBy: 'user', reason: 'Réception de marchandises' };
let lines = [{ _id: 'line', itemId: 'item', unitId: 'unit', quantity: 3, unitCost: 12.5 }];
let canceled = false;
let failWrite = false;
let written;
let destination;
let dialogTitle;
let renders = 0;
const paged = rows => async (companyId, { offset, limit }) => {
  assert.equal(companyId, 'a');
  return rows.slice(offset, offset + limit);
};
const service = load('src/electron/services/modules/inventory/stockMovementReport.service.tsx', name => {
  if (name.endsWith('/stock-movement-report.js')) return report;
  if (name.endsWith('/inventoryDocument.repository.js')) return { InventoryDocumentRepository: class {
    async getById(companyId, id) { return companyId === 'a' && id === 'entry' ? document : null; }
  } };
  if (name.endsWith('/inventoryDocumentLines.repository.js')) return { InventoryDocumentLineRepository: class {
    async getByDocument(companyId, id) { assert.equal(companyId, 'a'); assert.equal(id, 'entry'); return lines; }
  } };
  if (name.endsWith('/inventoryItem.repository.js')) return { InventoryItemRepository: class {
    list = paged([{ _id: 'item', sku: 'CUIR-01', name: 'Cuir de qualité' }]);
  } };
  if (name.endsWith('/inventoryWarehouse.repository.js')) return { InventoryWarehouseRepository: class {
    list = paged([{ _id: 'warehouse', name: 'Entrepôt principal' }]);
  } };
  if (name.endsWith('/stockSettings.repository.js')) return {
    getStockSettings: async companyId => { assert.equal(companyId, 'a'); return { units: [{ _id: 'unit', code: 'm²' }] }; },
  };
  if (name.endsWith('/companies.repository.js')) return {
    getCompanyById: async companyId => { assert.equal(companyId, 'a'); return { name: 'Entreprise Démonstration' }; },
  };
  if (name.endsWith('/offline_users.repository.js')) return {
    getOfflineUserById: async () => ({ companyId: 'other', firstName: 'Private', lastName: 'User' }),
  };
  if (name === 'electron') return { dialog: { showSaveDialog: async options => {
    destination = options.defaultPath;
    dialogTitle = options.title;
    return { canceled, filePath: '/tmp/stock-movement-test.pdf' };
  } } };
  if (name === 'fs/promises') return { default: { writeFile: async (_filename, bytes) => {
    if (failWrite) throw new Error('disk full');
    written = bytes;
  } } };
  if (name === '@react-pdf/renderer') return { renderToBuffer: async element => {
    renders++;
    return renderer.renderToBuffer(element);
  } };
  return require(name);
});

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return node?.props ? textContent(node.props.children) : '';
}

try {
  for (const [type, prefix, title, heading] of [
    ['RECEIPT', 'entree', 'Bon d’entrée', 'Articles réceptionnés'],
    ['ISSUE', 'sortie', 'Bon de sortie', 'Articles sortis'],
  ]) {
    document.type = type;
    document.documentNumber = type === 'RECEIPT' ? 'ENT/001' : 'SOR/002';
    lines = [{ _id: 'line', itemId: 'item', unitId: 'unit', quantity: 3, unitCost: 12.5 }];
    const data = await service.getStockMovementDocumentData('a', 'entry');
    assert.equal(data.responsible, 'Utilisateur indisponible (user)', 'Do not expose another company’s user');
    const tree = report.default({ data });
    assert.equal(tree.props.title, `${title} - ${document.documentNumber}`);
    const text = textContent(tree);
    assert(text.includes(title.toLocaleUpperCase('fr-FR')));
    assert(text.includes(heading));
    assert(text.includes(`${title} • ${document.documentNumber}`));
    assert(text.includes('37,5'), 'PDF includes the calculated total');
    const grouped = textContent(report.default({ data: {
      ...data,
      lines: [{ ...data.lines[0], quantity: 2, unitCost: 1234567.8912 }],
    } }));
    assert(grouped.includes('1 234 567,8912'), 'Unit values use ordinary thousands spaces and retain precision');
    assert.equal(grouped.split('2 469 135,7824').length - 1, 2, 'Line and grand totals use ordinary thousands spaces');
    assert(!/[\u00a0\u202f]/.test(grouped), 'Monetary values must not contain unsupported spacing glyphs');
    assert.equal((await service.saveStockMovementReport('a', 'entry')).canceled, false);
    assert.equal(destination, `bon-${prefix}-${document.documentNumber.replace('/', '-')}.pdf`);
    assert.equal(dialogTitle, `Enregistrer le ${title.toLocaleLowerCase('fr-FR')}`);
    assert.equal(written.subarray(0, 4).toString(), '%PDF');
    assert.equal((written.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
    canceled = true;
    written = undefined;
    const previousRenders = renders;
    assert.equal((await service.saveStockMovementReport('a', 'entry')).canceled, true);
    assert.equal(written, undefined);
    assert.equal(renders, previousRenders, 'Cancellation skips PDF generation');
    canceled = false;
    failWrite = true;
    await assert.rejects(() => service.saveStockMovementReport('a', 'entry'), /disk full/);
    failWrite = false;
    await assert.rejects(() => service.saveStockMovementReport('', 'entry'), /invalides/);
    await assert.rejects(() => service.saveStockMovementReport('other', 'entry'), /introuvable/);
    lines = Array.from({ length: 100 }, (_, index) => ({ _id: `line-${index}`, itemId: 'missing',
      description: `Article ${index + 1} avec une description détaillée`, quantity: 2, unitId: 'missing' }));
    await service.saveStockMovementReport('a', 'entry');
    assert((written.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 1);
    lines = [];
    await service.saveStockMovementReport('a', 'entry');
    assert.equal(written.subarray(0, 4).toString(), '%PDF');
  }
  for (const type of ['TRANSFER', 'ADJUSTMENT', 'RETURN', 'COUNT']) {
    document.type = type;
    const previousRenders = renders;
    await assert.rejects(() => service.saveStockMovementReport('a', 'entry'), /Seules les entrées et sorties/);
    assert.equal(renders, previousRenders);
  }
  console.log('Passed: receipt and issue PDFs, titles, article labels, totals, filenames, pagination, missing references/costs, empty documents, company isolation, unsupported types, cancellation, and save failures.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
