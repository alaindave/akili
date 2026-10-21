import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import fs from 'node:fs';
import sqlite3 from 'sqlite3';
import load from './time-off-migration-loader.mjs';
const { migrateTimeOff } = load(path.resolve(__dirname, '../src/electron/database/migrations/timeOff.migration.ts'));
const [databasePath, companyId, maintenance] = process.argv.slice(2);
if (!databasePath || !companyId || maintenance !== '--maintenance-confirmed') {
  console.error('Usage: node scripts/migrate-time-off.mjs /absolute/company/Akili_db COMPANY_ID --maintenance-confirmed');
  process.exit(1);
}
if (!path.isAbsolute(databasePath) || !fs.statSync(databasePath).isFile()) throw new Error('Select an existing absolute database path');
const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(databasePath), 'company.json'), 'utf8'));
if (path.basename(databasePath) !== 'Akili_db' || manifest.companyId !== companyId) {
  throw new Error('Database path/company manifest does not match the selected company');
}
const db = new sqlite3.Database(databasePath, sqlite3.OPEN_READWRITE);
const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(error) { if (error) reject(error); else resolve(this); }));
const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
const get = async (sql, params) => (await all(sql, params))[0] ?? null;
(async () => {
  await run('PRAGMA foreign_keys=ON');
  await run('PRAGMA busy_timeout=5000');
  const result = await migrateTimeOff({ run, all, get, transaction: async (callback) => {
    await run('BEGIN IMMEDIATE');
    try { const result = await callback(); await run('COMMIT'); return result; }
    catch (error) { await run('ROLLBACK'); throw error; }
  } }, companyId);
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
