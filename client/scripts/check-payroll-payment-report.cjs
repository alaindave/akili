const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, resolve) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: resolve });
  return module.exports;
}
(async () => {
  const helpers = load('../src/common/types/payroll/payrollPayment.ts', require);
  const { getPayrollPaymentMethod: method, matchesPayrollFilters: matches } = helpers;
  for (const account of [undefined, null, '', '   ', 'cash', ' CASH ']) assert.equal(method(account), 'cash');
  assert.equal(method('001234'), 'bank');
  const rows = [
    { _id: '1', firstName: 'Bank', department: 'Atelier', accountNumber: '001234', baseSalary: 100, totalEarnings: 10, totalDeductions: 5, netSalary: 105 },
    { _id: '2', firstName: 'Cash', department: 'Atelier', accountNumber: 'cash', baseSalary: 200, totalEarnings: 20, totalDeductions: 10, netSalary: 210 },
    { _id: '3', firstName: 'Legacy', department: 'Usine', baseSalary: 300, totalEarnings: 30, totalDeductions: 15, netSalary: 315 },
  ];
  assert.equal(rows.filter((r) => matches(r, null, 'all')).length, 3);
  assert.equal(rows.filter((r) => matches(r, null, 'cash')).length, 2);
  assert.equal(rows.filter((r) => matches(r, 'Atelier', 'bank'))[0]._id, '1');
  assert.equal(rows.filter((r) => matches(r, 'Usine', 'bank')).length, 0);
  const renderer = await import('@react-pdf/renderer');
  const document = load('../src/electron/reports/payroll/monthly-payroll-report.tsx', (name) => {
    if (name === '@react-pdf/renderer') return renderer;
    if (name.endsWith('/payrollPayment.js')) return helpers;
    return require(name);
  });
  let captured, destination, written;
  const service = load('../src/electron/services/modules/hr/payroll/monthlyPayrollReport.service.tsx', (name) => {
    if (name.endsWith('/payrollPayment.js')) return helpers;
    if (name.endsWith('/monthly-payroll-report.js')) return document;
    if (name.endsWith('/companies.repository.js')) return { getCompanyById: async () => ({ name: 'Test Company' }) };
    if (name.endsWith('/payroll_run.repository.js')) return {
      getPayrollRunById: async () => ({ month: 9, year: 2026, status: 'BROUILLON' }), getPayrollResults: async () => rows,
    };
    if (name.endsWith('/payroll_settings.repository.js')) return { getPayrollSettings: async () => ({ currency: 'BIF' }) };
    if (name === 'electron') return { dialog: { showSaveDialog: async (options) => {
      destination = options.defaultPath; return { canceled: false, filePath: '/tmp/akili-payment-report-test.pdf' };
    } } };
    if (name === 'fs/promises') return { default: { writeFile: async (_file, buffer) => { written = buffer; } } };
    if (name === '@react-pdf/renderer') return { renderToBuffer: async (element) => {
      captured = element.props; return renderer.renderToBuffer(element);
    } };
    return require(name);
  });
  await service.saveMonthlyPayrollReport('a', 'run', 'Atelier', 'bank');
  assert.equal(captured.results.length, 1);
  assert.equal(captured.results[0]._id, '1');
  assert.equal(captured.paymentMethod, 'bank');
  assert.ok(destination.endsWith('-bank.pdf'));
  assert.equal(written.subarray(0, 4).toString(), '%PDF');
  await service.saveMonthlyPayrollReport('a', 'run', null, 'cash');
  assert.equal(captured.results.length, 2);
  await service.saveMonthlyPayrollReport('a', 'run', null);
  assert.equal(captured.results.length, 3);
  await assert.rejects(() => service.saveMonthlyPayrollReport('a', 'run', null, 'invalid'));
  console.log('Payment classification, combined filters, PDF export selection, and real PDF rendering passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
