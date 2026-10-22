import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import load from './time-off-migration-loader.mjs';

const { removeTimeOffReviewFields } = load(fileURLToPath(new URL('../src/electron/database/migrations/removeTimeOffReview.migration.ts', import.meta.url)));
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE employees(_id TEXT PRIMARY KEY,companyId TEXT,remainingLeave REAL,UNIQUE(companyId,_id));
    INSERT INTO employees VALUES ('e','a',18);
    CREATE TABLE time_off_motifs(_id TEXT PRIMARY KEY,companyId TEXT,UNIQUE(companyId,_id));
    CREATE TABLE time_off(
      _id TEXT PRIMARY KEY,companyId TEXT,employeeId TEXT,motifId TEXT,status TEXT,startDate TEXT,endDate TEXT,
      balanceDaysDeducted REAL DEFAULT 0,serverVersion INTEGER,updatedAt TEXT,synced INTEGER,
      customField TEXT DEFAULT 'value,with,commas',
      legacyNeedsReview INTEGER NOT NULL DEFAULT 0 CHECK(legacyNeedsReview IN(0,1)),
      legacyData TEXT CHECK(legacyData IS NULL OR json_valid(legacyData)),
      CHECK(motifId IS NOT NULL OR (legacyNeedsReview=1 AND legacyData IS NOT NULL)),
      FOREIGN KEY(companyId,employeeId) REFERENCES employees(companyId,_id),
      FOREIGN KEY(companyId,motifId) REFERENCES time_off_motifs(companyId,_id));
    CREATE INDEX time_off_company_version ON time_off(companyId,serverVersion);
    INSERT INTO time_off VALUES ('r','a','e',NULL,'APPROVED','2026-10-19','2026-10-20',0,42,'unchanged',0,'preserved',1,'{"source":"old"}');
    CREATE TABLE payroll_link(id TEXT PRIMARY KEY,timeOffId TEXT REFERENCES time_off(_id) ON DELETE CASCADE,amount REAL);
    INSERT INTO payroll_link VALUES ('p','r',100);
    CREATE VIEW time_off_report AS SELECT _id,companyId,status FROM time_off;
    CREATE TRIGGER preserve_custom AFTER UPDATE OF status ON time_off BEGIN SELECT 1; END;
    CREATE TABLE sync_queue(id INTEGER PRIMARY KEY,payload TEXT);
    INSERT INTO sync_queue VALUES (1,'{"reviewLegacy":true,"syncMutationId":"original-retry"}');`);
  const db = {
    run: async (query, values=[]) => sql.prepare(query).run(...values),
    get: async (query, values=[]) => sql.prepare(query).get(...values) ?? null,
    all: async (query, values=[]) => sql.prepare(query).all(...values),
    transaction: async fn => { sql.exec('BEGIN'); try { const result=await fn(); sql.exec('COMMIT'); return result; }
      catch(error) { sql.exec('ROLLBACK'); throw error; } },
  };
  return {sql,db};
}
for (const fail of [false,true]) {
  const {sql,db} = fixture();
  try {
    const queueBefore=sql.prepare('SELECT payload FROM sync_queue').get().payload;
    if (fail) {
      const run=db.run;
      db.run=async (query,values) => { if(query.startsWith('ALTER TABLE time_off_without_review')) throw new Error('Injected rebuild failure'); return run(query,values); };
      await assert.rejects(()=>removeTimeOffReviewFields(db,'a'),/Injected rebuild failure/);
      assert(sql.prepare('PRAGMA table_info(time_off)').all().some(row=>row.name==='legacyData'));
      assert.equal(sql.prepare('SELECT balanceDaysDeducted FROM time_off').get().balanceDaysDeducted,0);
    } else {
      await assert.rejects(()=>removeTimeOffReviewFields(db,'b'),/another company/);
      await removeTimeOffReviewFields(db,'a');
      const row=sql.prepare('SELECT * FROM time_off').get();
      assert.equal('legacyData' in row,false); assert.equal('legacyNeedsReview' in row,false);
      assert.equal(row.balanceDaysDeducted,2); assert.equal(row.motifId,null); assert.equal(row.customField,'preserved');
      assert.equal(row.serverVersion,42); assert.equal(row.updatedAt,'unchanged'); assert.equal(row.synced,0);
      assert.equal(sql.prepare('SELECT remainingLeave FROM employees').get().remainingLeave,18);
      assert.equal(sql.prepare("SELECT count(*) n FROM sqlite_master WHERE name IN ('time_off_company_version','preserve_custom')").get().n,2);
      assert.equal(sql.prepare('SELECT count(*) n FROM time_off_report').get().n,1);
      await removeTimeOffReviewFields(db,'a');
      assert.equal(sql.prepare('SELECT balanceDaysDeducted FROM time_off').get().balanceDaysDeducted,2);
    }
    assert.equal(sql.prepare('SELECT count(*) n FROM payroll_link').get().n,1,'Rebuilding the parent must not cascade-delete payroll links');
    assert.equal(sql.prepare('SELECT payload FROM sync_queue').get().payload,queueBefore,'Pending retry fingerprints remain valid');
    assert.equal(sql.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
    assert.equal(sql.prepare('PRAGMA legacy_alter_table').get().legacy_alter_table,0);
    assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
    assert.equal(sql.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  } finally {sql.close();}
}
console.log('PASS: existing SQLite columns removed; history, balances, custom columns, indexes, views, triggers, inbound foreign keys and queued retries preserved; idempotency and rollback verified.');
