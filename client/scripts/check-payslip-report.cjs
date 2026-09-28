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
  const helpers = load('../src/common/types/payroll/PayslipDocument.ts', require);
  const renderer = await import('@react-pdf/renderer');
  const document = load('../src/electron/reports/payroll/payslip-report.tsx', (name) => {
    if (name === '@react-pdf/renderer') return renderer;
    if (name.endsWith('/PayslipDocument.js')) return helpers;
    return require(name);
  });
  const employee = { _id: 'employee', companyId: 'company', firstName: 'Élodie', lastName: 'Ndayishimiye', matricule: 'EMP-0042', department: 'Administration', role: 'Comptable' };
  const payroll = { _id: 'payslip', companyId: 'company', payrollRunId: 'run', employeeId: 'employee', month: 9, year: 2026, status: 'APPROUVÉ',
    baseSalary: 450000, totalEarnings: 50000, grossSalary: 500000, totalDeductions: 75000, netSalary: 425000,
    createdAt: '2026-09-28T08:00:00Z', approvedAt: '2026-09-28T09:00:00Z' };
  let items = [{ name: 'transport', displayName: 'Indemnité de transport', type: 'EARNING', amount: 50000 },
    { name: 'IPR', type: 'DEDUCTION', amount: 57000 }, { name: 'INSS', type: 'DEDUCTION', amount: 18000 }];
  let captured, written, canceled = false, missing = false, failWrite = false, destination;
  const service = load('../src/electron/services/modules/hr/payroll/payslipReport.service.tsx', (name) => {
    if (name.endsWith('/payslip-report.js')) return document;
    if (name.endsWith('/companies.repository.js')) return { getCompanyById: async (id) => id === 'company' ? { name: 'Entreprise Démonstration', address: 'Avenue du Commerce, 12', city: 'Bujumbura', country: 'Burundi', email: 'contact@example.com' } : null };
    if (name.endsWith('/employees.repository.js')) return { getEmployeeById: async (companyId, id) => companyId === 'company' && id === employee._id ? employee : null };
    if (name.endsWith('/payroll_run.repository.js')) return {
      getEmployeePayrollResults: async (companyId, id, run) => companyId === 'company' && id === employee._id && run === 'run' && !missing ? payroll : null,
      getPayrollItems: async (companyId, resultId, employeeId) => {
        assert.equal(companyId, 'company'); assert.equal(resultId, 'payslip'); assert.equal(employeeId, 'employee'); return items;
      },
    };
    if (name.endsWith('/payroll_settings.repository.js')) return { getPayrollSettings: async () => ({ currency: 'BIF' }) };
    if (name === 'electron') return { dialog: { showSaveDialog: async (options) => {
      destination = options.defaultPath; return { canceled, filePath: '/tmp/akili-payslip-preview.pdf' };
    } } };
    if (name === 'fs/promises') return { default: { writeFile: async (_file, buffer) => {
      if (failWrite) throw new Error('disk full'); written = buffer;
    } } };
    if (name === '@react-pdf/renderer') return { renderToBuffer: async (element) => {
      captured = element.props.data; return renderer.renderToBuffer(element);
    } };
    return require(name);
  });
  const data = await service.getPayslipDocumentData('company', 'employee', 'run');
  assert.equal(data.employee.matricule, 'EMP-0042');
  assert.equal(helpers.payslipRows(data).reduce((sum, row) => sum + (row.earning ?? 0), 0), payroll.grossSalary);
  assert.equal(helpers.payslipRows(data).reduce((sum, row) => sum + (row.deduction ?? 0), 0), payroll.totalDeductions);
  assert.equal(helpers.payslipRows(data)[2].label, 'IPR');
  assert(helpers.payslipMoney(12.5, 'USD').includes('12,50'));
  assert(helpers.payslipPeriod(2, 2024).startsWith('1 au 29'));
  await service.savePayslipReport('company', 'employee', 'run');
  assert.equal(captured.currency, 'BIF');
  assert.equal(written.subarray(0, 4).toString(), '%PDF');
  assert.equal((written.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
  assert.equal(destination, 'bulletin-paie-EMP-0042-2026-09.pdf');
  fs.writeFileSync('/tmp/akili-payslip-preview.pdf', written);
  canceled = true; written = null;
  assert.equal((await service.savePayslipReport('company', 'employee', 'run')).canceled, true);
  assert.equal(written, null);
  canceled = false;
  await assert.rejects(() => service.savePayslipReport('', 'employee', 'run'));
  await assert.rejects(() => service.savePayslipReport('other-company', 'employee', 'run'));
  await assert.rejects(() => service.savePayslipReport('company', 'other-employee', 'run'));
  missing = true;
  await assert.rejects(() => service.savePayslipReport('company', 'employee', 'run'));
  missing = false; failWrite = true;
  await assert.rejects(() => service.savePayslipReport('company', 'employee', 'run'), /disk full/);
  failWrite = false;
  items = Array.from({ length: 80 }, (_, i) => ({ name: `Ligne ${i + 1} avec une description détaillée`, type: 'EARNING', amount: 625 }));
  await service.savePayslipReport('company', 'employee', 'run');
  assert((written.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 1);
  fs.writeFileSync('/tmp/akili-payslip-multipage.pdf', written);
  console.log('Payslip data, identity, totals, tenant isolation, save cancellation/errors, real PDF output, and pagination passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
