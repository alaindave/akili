import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import load from './time-off-migration-loader.mjs';
const { migrateTimeOff } = load(path.resolve(__dirname, '../src/electron/database/migrations/timeOff.migration.ts'));
const { TIME_OFF_MIGRATION } = load(path.resolve(__dirname, '../src/common/migrations/timeOffLegacy.ts'));
function fixture({ subject = false, empty = false, file = ":memory:" } = {}) {
  const sql = new DatabaseSync(file);
  sql.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE employees (_id TEXT PRIMARY KEY,companyId TEXT,remainingLeave REAL);
    INSERT INTO employees VALUES ('e','a',17),('e-b','b',9);
    CREATE TABLE sync_state(companyId TEXT,entity TEXT,lastPulledVersion INTEGER,updatedAt TEXT,PRIMARY KEY(companyId,entity));
    INSERT INTO sync_state VALUES ('a','leave',19,'unchanged'),('b','leave',99,'other-company');
    CREATE TABLE sync_queue(_id INTEGER PRIMARY KEY,companyId TEXT,entity TEXT,entityId TEXT,operation TEXT,payload TEXT,synced INTEGER);
    INSERT INTO sync_queue VALUES (1,'a','leave','l0','update','{"status":"APPROUVÉ","subject":"pending legacy"}',0);
    CREATE TABLE payroll_results(_id TEXT PRIMARY KEY,companyId TEXT,payload TEXT);
    INSERT INTO payroll_results VALUES ('p','a','{"leaveId":"l0","netSalary":12000,"status":"PAYÉ"}');`);
  if (!empty) {
    sql.exec(`CREATE TABLE leaves (_id TEXT PRIMARY KEY,companyId TEXT NOT NULL,employeeId TEXT NOT NULL,
      ${subject ? 'subject' : 'motif'} TEXT,notes TEXT,additionalNotes TEXT,
      startDate TEXT,endDate TEXT,submittedAt TEXT,submittedMonth TEXT,status TEXT,
      approvedBy TEXT,approvedAt TEXT,rejectionReason TEXT,serverVersion INTEGER,createdAt TEXT,
      updatedAt TEXT,lastSyncedAt TEXT,synced INTEGER,isDeleted INTEGER,customHistoricalField TEXT,
      FOREIGN KEY(employeeId) REFERENCES employees(_id));
      CREATE INDEX legacy_leave_company ON leaves(companyId);
      CREATE TABLE historical_adjustment(_id TEXT PRIMARY KEY,leaveId TEXT REFERENCES leaves(_id),amount REAL);`);
    for (const [i, status] of ['ATTENTE_APPROBATION','APPROUVÉ','REFUSÉ','ANNULÉ'].entries()) {
      sql.prepare('INSERT INTO leaves VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
        `l${i}`, 'a', 'e', 'Motif libre sans politique connue', 'Notes', 'Historique',
        '2026-10-01','2026-10-02','2026-09-20','2026-09',status,
        i === 1 ? 'manager' : null,i === 1 ? '2026-09-21' : null,i === 2 ? 'Refus' : null,
        15+i,'created','updated','synced-at',i%2,i===3?1:0,'preserve me');
    }
    sql.exec("INSERT INTO historical_adjustment VALUES ('h','l0',-100)");
  }
  const db = {
    run: async (query, params=[]) => sql.prepare(query).run(...params),
    all: async (query, params=[]) => sql.prepare(query).all(...params),
    get: async (query, params=[]) => sql.prepare(query).get(...params) ?? null,
    transaction: async (fn) => {
      sql.exec('BEGIN IMMEDIATE');
      try { const result = await fn(); sql.exec('COMMIT'); return result; }
      catch(error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  return { sql, db };
}
const rows = (sql, table) => JSON.stringify(sql.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
(async () => {
  for (const subject of [false,true]) {
    const {sql,db}=fixture({subject});
    try {
      const original = rows(sql,'leaves');
      const untouched = Object.fromEntries(['employees','sync_queue','payroll_results','historical_adjustment'].map(t=>[t,rows(sql,t)]));
      assert.equal((await migrateTimeOff(db,'a')).migrated,4);
      assert.equal(rows(sql,'leaves_legacy_time_off_v1'),original);
      for (const [table,before] of Object.entries(untouched)) assert.equal(rows(sql,table),before);
      assert.deepEqual(sql.prepare('SELECT status FROM time_off ORDER BY _id').all().map(r=>r.status),['PENDING','APPROVED','REJECTED','CANCELLED']);
      for (const row of sql.prepare('SELECT * FROM time_off').all()) {
        const old=JSON.parse(row.legacyData);
        assert.equal(row._id,old._id); assert.equal(row.motifId,null); assert.equal(row.motifSnapshot,null);
        assert.equal(row.legacyNeedsReview,1); assert.equal(row.serverVersion,old.serverVersion);
        assert.equal(row.isDeleted,old.isDeleted); assert.equal(row.lastSyncedAt,old.lastSyncedAt);
      }
      assert.equal(sql.prepare("SELECT lastPulledVersion FROM sync_state WHERE entity='time_off' AND companyId='a'").get().lastPulledVersion,19);
      assert.equal(sql.prepare("SELECT COUNT(*) n FROM sync_state WHERE entity='time_off' AND companyId='b'").get().n,0);
      assert.equal(sql.prepare('SELECT COUNT(*) n FROM time_off_motifs').get().n,0);
      const migrated=rows(sql,'time_off');
      assert.equal((await migrateTimeOff(db,'a')).alreadyApplied,true);
      assert.equal(rows(sql,'time_off'),migrated);
      assert.equal(sql.prepare('SELECT COUNT(*) n FROM migrations WHERE name=?').get(TIME_OFF_MIGRATION).n,1);
      assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
      // Historical FK still resolves to the preserved source; IDs are also canonical.
      assert.equal(sql.prepare('SELECT count(*) n FROM historical_adjustment h JOIN time_off t ON t._id=h.leaveId').get().n,1);
      sql.exec(`INSERT INTO time_off_motifs (_id,companyId,code,label,category,payrollTreatment,
        deductFromLeaveBalance,requiresApproval,requiresJustification,requiresSupportingDocument,isSystemDefault,isActive)
        VALUES ('m-b','b','CUSTOM','Custom','ABSENCE','UNPAID',0,1,1,0,0,1)`);
      assert.throws(()=>sql.exec("UPDATE time_off SET motifId='m-b' WHERE _id='l0'"),/FOREIGN KEY/);
      assert.throws(()=>sql.exec("UPDATE time_off SET employeeId='e-b' WHERE _id='l0'"),/FOREIGN KEY/);
      assert.throws(()=>sql.exec("UPDATE time_off SET legacyNeedsReview=0 WHERE _id='l0'"),/CHECK/);
      assert.throws(()=>sql.exec("UPDATE time_off SET status='INVALID' WHERE _id='l0'"),/CHECK/);
    } finally { sql.close(); }
  }
  for (const failure of ['company','status','employee','late','partial','trigger']) {
    const {sql,db}=fixture();
    try {
      if(failure==='status') sql.exec("UPDATE leaves SET status='UNKNOWN' WHERE _id='l0'");
      if(failure==='employee') sql.exec("UPDATE leaves SET employeeId='e-b' WHERE _id='l0'");
      if(failure==='partial') sql.exec('CREATE TABLE time_off(_id TEXT)');
      if(failure==='trigger') sql.exec('CREATE TRIGGER custom_leave AFTER UPDATE ON leaves BEGIN SELECT 1; END');
      if(failure==='late') { const run=db.run; db.run=async (q,p)=> {if(q.startsWith('CREATE INDEX idx_time_off_company_version')) throw new Error('Injected failure');return run(q,p);}; }
      const before=rows(sql,'leaves');
      await assert.rejects(()=>migrateTimeOff(db,failure==='company'?'wrong':'a'));
      assert.equal(rows(sql,'leaves'),before);
      assert.equal(sql.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='leaves_legacy_time_off_v1'").get().n,0);
      assert.equal(sql.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='time_off_motifs'").get().n,0);
    } finally {sql.close();}
  }
  const {sql,db}=fixture({empty:true});
  try { assert.equal((await migrateTimeOff(db,'a')).migrated,0); assert.equal((await migrateTimeOff(db,'a')).alreadyApplied,true); }
  finally {sql.close();}
  // Exercise the actual maintenance CLI and sqlite3 driver on a disposable file.
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'akili-timeoff-sqlite-'));
  try {
    const file=path.join(directory,'Akili_db');
    const disk=fixture({file}); disk.sql.close();
    fs.writeFileSync(path.join(directory,'company.json'),JSON.stringify({companyId:'a'}));
    for(let i=0;i<2;i++) {
      const result=spawnSync(process.execPath,[path.join(__dirname,'migrate-time-off.mjs'),file,'a','--maintenance-confirmed'],{encoding:'utf8'});
      assert.equal(result.status,0,result.stderr);
      assert.equal(JSON.parse(result.stdout).alreadyApplied,i===1);
    }
    const wrong=spawnSync(process.execPath,[path.join(__dirname,'migrate-time-off.mjs'),file,'b','--maintenance-confirmed'],{encoding:'utf8'});
    assert.notEqual(wrong.status,0);
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
  console.log('PASS SQLite: subject/motif legacy data, all statuses, approval metadata, tombstones, payroll links, queue/cursors, idempotency, company constraints, empty initialization and transactional failure rollback.');
})().catch(error=>{console.error(error);process.exitCode=1;});
