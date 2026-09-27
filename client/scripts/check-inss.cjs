const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sqlite = require('sqlite3');
function load(file, overrides = {}, transform = (s) => s) {
  const source = transform(fs.readFileSync(file, 'utf8'));
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, console: { log() {}, error() {} }, require: (name) => {
    if (overrides[name]) return overrides[name];
    return load(path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts')), overrides);
  } });
  return module.exports;
}
const root = path.resolve(__dirname, '../src/electron');
const payrollPath = path.join(root, 'services/modules/hr/payroll');
const { calculateComponent } = load(path.join(payrollPath, 'calculateComponent.ts'));
const { calculatePayroll } = load(path.join(payrollPath, 'calculatePayroll.ts'));
const { validatePayroll } = load(path.join(payrollPath, 'validatePayroll.ts'));
const component = { _id: 'inss', companyId: 'company', name: 'SOCIAL_SECURITY', displayName: 'INSS', displayOrder: 1, type: 'DEDUCTION', calculationType: 'FORMULE_INSS', enabled: 1, value: 99 };
for (const [grossSalary, expected] of [[0, 0], [100000, 4000], [449999, 17999.96], [450000, 18000], [450001, 18000], [900000, 18000]]) {
  assert.equal(calculateComponent(component, { grossSalary }), expected);
}
const db = new sqlite.Database(':memory:');
const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (error) { error ? reject(error) : resolve(this); }));
const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
const database = { run, all, runDirect: run, allDirect: all, transaction: async (fn) => {
  await run('BEGIN');
  try { const result = await fn(); await run('COMMIT'); return result; }
  catch (error) { await run('ROLLBACK'); throw error; }
} };
(async () => {
  const ipr = { ...component, _id: 'ipr', name: 'IPR', calculationType: 'FORMULE_IPR' };
  for (const components of [[component, ipr], [ipr, component]]) {
    const employee = { employeeId: 'employee', baseSalary: 900000, components };
    assert.equal(validatePayroll(employee).valid, true);
    const result = await calculatePayroll('company', employee, { _id: 'admin' }, {});
    assert.equal(result.deductions.find((item) => item.name === 'SOCIAL_SECURITY').amount, 18000);
    assert.equal(result.deductions.find((item) => item.name === 'IPR').amount, 204600);
    assert.equal(result.netSalary, 677400);
  }
  await run('PRAGMA foreign_keys = ON');
  await run('CREATE TABLE employees (_id TEXT PRIMARY KEY)');
  await run('CREATE TABLE admin_users (_id TEXT PRIMARY KEY)');
  const schemaPath = path.join(root, 'database/schemas/modules/hr/payroll.schema.ts');
  const overrides = { '../../../db.js': database };
  // Create a legacy database with existing profile data and an extra index.
  const legacy = load(schemaPath, overrides, (s) => s.replaceAll("            'FORMULE_INSS',\n", '').replace('  await migrateInssCalculationType();', ''));
  await legacy.createPayrollTables();
  await run("INSERT INTO employees VALUES ('employee')");
  await run(`INSERT INTO payroll_components (companyId, _id, name, displayName, type, calculationType, displayOrder, createdAt, updatedAt)
    VALUES ('company', 'inss', 'SOCIAL_SECURITY', 'INSS', 'DEDUCTION', 'POURCENTAGE_BRUT', 1, 'now', 'now')`);
  await run(`INSERT INTO payroll_employee_profiles (companyId, _id, employeeId, componentId, name, displayName, displayOrder, type, calculationType, value, accountNumber, createdAt, updatedAt)
    VALUES ('company', 'profile', 'employee', 'inss', 'SOCIAL_SECURITY', 'INSS', 1, 'DEDUCTION', 'POURCENTAGE_BRUT', 4, '00123', 'now', 'now')`);
  await run('CREATE INDEX custom_profile_index ON payroll_employee_profiles(accountNumber)');
  const schema = load(schemaPath, overrides);
  await schema.createPayrollTables();
  await schema.createPayrollTables(); // Idempotent startup.
  await run("UPDATE payroll_components SET calculationType = 'FORMULE_INSS'");
  await run("UPDATE payroll_employee_profiles SET calculationType = 'FORMULE_INSS'");
  const [profile] = await all('SELECT * FROM payroll_employee_profiles');
  assert.equal(profile.accountNumber, '00123');
  assert.equal(profile.value, 4);
  assert.equal(profile.componentId, 'inss');
  assert.equal((await all("SELECT name FROM sqlite_master WHERE name = 'custom_profile_index'")).length, 1);
  assert.equal((await all('PRAGMA foreign_keys'))[0].foreign_keys, 1);
  assert.equal((await all('PRAGMA foreign_key_check')).length, 0);
  console.log('INSS checks passed: threshold, cap, validation, IPR ordering, net pay, and legacy database migration.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
