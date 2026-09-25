const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
function load(file, resolve) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: resolve });
  return module.exports;
}
(async () => {
  const helpers = load('../src/common/types/attendance/WeeklyAttendanceReport.ts', require);
  assert.equal(helpers.attendanceWeekDates('2026-09-27')[0], '2026-09-21');
  assert.equal(helpers.attendanceWeekDates('2027-01-01')[0], '2026-12-28');
  assert.throws(() => helpers.attendanceWeekDates('2026-02-30'));
  assert.throws(() => helpers.attendanceWeekDates('bad'));
  assert.equal(helpers.attendanceDayLabel({ clockIn: '08:12:00', status: 'RETARD' }), '08:12');
  assert.equal(helpers.attendanceDayLabel({ clockIn: '2026-09-21T06:12:00Z' }), new Date('2026-09-21T06:12:00Z').toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE employees (companyId TEXT, _id TEXT, matricule TEXT, firstName TEXT, lastName TEXT, department TEXT, dateHired TEXT, status TEXT, isDeleted INTEGER);
    CREATE TABLE attendances (companyId TEXT, _id TEXT, employeeId TEXT, date TEXT, clockIn TEXT, status TEXT, updatedAt TEXT, createdAt TEXT, isDeleted INTEGER);
    CREATE TABLE leaves (companyId TEXT, employeeId TEXT, startDate TEXT, endDate TEXT, status TEXT, isDeleted INTEGER);
    INSERT INTO employees VALUES ('a','e1','001','Test','Employee','Atelier','2020-01-01','ACTIF',0),
      ('b','e2','002','Other','Tenant','Atelier','2020-01-01','ACTIF',0),
      ('a','e3','003','New','Hire','Atelier','2026-09-23','ACTIF',0),
      ('a','e4','004','Deleted','Employee','Atelier','2020-01-01','ACTIF',1);
    INSERT INTO attendances VALUES ('a','1','e1','2026-09-21','08:10','RETARD','1','1',0),
      ('a','2','e1','2026-09-22',NULL,'ABSENT','1','1',0),
      ('a','3','e1','2026-09-24',NULL,'CONGÉ','1','1',0),
      ('a','4','e1','2026-09-25',NULL,'ABSENT','1','1',1),
      ('b','5','e1','2026-09-25',NULL,'ABSENT','1','1',0);
    INSERT INTO leaves VALUES ('a','e1','2026-09-23','2026-09-23','APPROUVÉ',0),
      ('a','e1','2026-09-25','2026-09-25','REFUSÉ',0),
      ('b','e1','2026-09-25','2026-09-25','APPROUVÉ',0);`);
  const repo = load('../src/electron/database/repositories/modules/hr/weeklyAttendanceReport.repository.ts', (name) => {
    if (name.endsWith('/db.js')) return { all: async (sql, params) => db.prepare(sql).all(...params) };
    if (name.endsWith('/WeeklyAttendanceReport.js')) return helpers;
    return require(name);
  });
  const report = await repo.getWeeklyAttendanceReport('a', '2026-09-25');
  assert.equal(report.employees.length, 2);
  assert.deepEqual(Array.from(report.employees.find((e) => e.employeeId === 'e1').days), ['08:10', 'Absent', 'Congé', 'Congé', '—']);
  assert.equal(report.employees.find((e) => e.employeeId === 'e3').days[0], '—');
  assert.equal((await repo.getWeeklyAttendanceReport('b', '2026-09-25')).employees.length, 1);
  await assert.rejects(() => repo.getWeeklyAttendanceReport('', '2026-09-25'));
  const renderer = await import('@react-pdf/renderer');
  const document = load('../src/electron/reports/attendance/weekly-attendance-report.tsx', (name) => name === '@react-pdf/renderer' ? renderer : name.endsWith('/WeeklyAttendanceReport.js') ? helpers : require(name));
  const React = require('react');
  const pdf = await renderer.renderToBuffer(React.createElement(document.WeeklyAttendanceReportDocument, { report, companyName: 'Test company' }));
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  db.close();
  console.log('Weekly attendance: dates, statuses, approved leave, tenant isolation, deleted records, and PDF rendering passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
