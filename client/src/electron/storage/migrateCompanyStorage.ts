import sqlite3 from "sqlite3";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { companyFolderName, findCompanyStorage, getUserDataRoot, legacyDefaultUserData,
  validateCompanyId, writeCompanyManifest } from "./companyStorage.js";

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
const read = <T>(db: sqlite3.Database, sql: string, args: unknown[] = []): Promise<T[]> =>
  new Promise((resolve, reject) => db.all(sql, args, (error, rows: T[]) => error ? reject(error) : resolve(rows)));
const execute = (db: sqlite3.Database, sql: string, args: unknown[] = []): Promise<void> =>
  new Promise((resolve, reject) => db.run(sql, args, (error) => error ? reject(error) : resolve()));
const close = (db: sqlite3.Database): Promise<void> =>
  new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
const open = (file: string, mode: number): Promise<sqlite3.Database> =>
  new Promise((resolve, reject) => {
    const db = new sqlite3.Database(file, mode, (error) => error ? reject(error) : resolve(db));
  });

async function exists(file: string): Promise<boolean> {
  try { await fs.access(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

async function copyTree(source: string, destination: string): Promise<void> {
  if (!await exists(source)) return;
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink()) throw new Error(`Cannot migrate a symbolic link: ${source}`);
  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    for (const name of await fs.readdir(source)) await copyTree(path.join(source, name), path.join(destination, name));
  } else if (stat.isFile()) {
    if (await exists(destination)) {
      const hash = async (file: string) => createHash("sha256").update(await fs.readFile(file)).digest("hex");
      if (await hash(source) !== await hash(destination)) throw new Error(`Conflicting legacy files: ${source} and ${destination}`);
    } else await fs.copyFile(source, destination);
  }
}

/** Split snapshots, never the originals. Staging folders become visible only after validation. */
export async function migrateCompanyStorage(): Promise<void> {
  const root = getUserDataRoot();
  const legacyRoots = new Set([root, legacyDefaultUserData]);
  const installationConfig = path.join(root, "installation.json");
  if (await exists(installationConfig)) {
    const config = JSON.parse(await fs.readFile(installationConfig, "utf8")) as { installationId?: string };
    if (config.installationId) {
      validateCompanyId(config.installationId);
      legacyRoots.add(path.join(root, config.installationId));
    }
  }
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith(".") &&
        !await exists(path.join(root, entry.name, "company.json")) &&
        await exists(path.join(root, entry.name, "Akili_db"))) legacyRoots.add(path.join(root, entry.name));
  }
  for (const legacyRoot of legacyRoots) {
    const sourcePath = path.join(legacyRoot, "Akili_db");
    if (!await exists(sourcePath)) continue;
    const source = await open(sourcePath, sqlite3.OPEN_READONLY);
    try {
      const tables = await read<{ name: string }>(source, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'companies'");
      if (!tables.length) continue;
      const companies = await read<{ companyId: string; name: string }>(source, "SELECT companyId, name FROM companies");
      for (const company of companies) {
        validateCompanyId(company.companyId);
        const previous = findCompanyStorage(company.companyId);
        if (previous) {
          if (previous.migratedFrom === sourcePath) continue;
          throw new Error(`Company ${company.companyId} exists in multiple legacy databases. Resolve the duplicate before migration: ${sourcePath}`);
        }
        const destination = path.join(root, companyFolderName(company.name, company.companyId));
        if (await exists(destination)) throw new Error(`Company destination already exists: ${destination}`);
        const staging = path.join(root, `.company-migration-${randomUUID()}`);
        await fs.mkdir(staging);
        const snapshotPath = path.join(staging, "Akili_db");
        // VACUUM INTO reads committed WAL contents through SQLite; never copy a live DB file.
        await execute(source, "VACUUM INTO ?", [snapshotPath]);
        const snapshot = await open(snapshotPath, sqlite3.OPEN_READWRITE);
        try {
          const priorViolations = new Set((await read(snapshot, "PRAGMA foreign_key_check")).map((row) => JSON.stringify(row)));
          await execute(snapshot, "PRAGMA foreign_keys = OFF");
          await execute(snapshot, "PRAGMA secure_delete = ON");
          await execute(snapshot, "BEGIN");
          const allTables = await read<{ name: string }>(snapshot, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
          for (const table of allTables) {
            const columns = await read<{ name: string }>(snapshot, `PRAGMA table_info(${quote(table.name)})`);
            if (columns.some((column) => column.name === "companyId")) {
              await execute(snapshot, `DELETE FROM ${quote(table.name)} WHERE companyId IS NULL OR companyId <> ?`, [company.companyId]);
            } else if (table.name === "app_settings") {
              for (const other of companies.filter((item) => item.companyId !== company.companyId)) {
                await execute(snapshot, "DELETE FROM app_settings WHERE key = ?", [`attendance.clockIn.${other.companyId}`]);
              }
            } else if (table.name !== "migrations" && (await read(snapshot, `SELECT 1 FROM ${quote(table.name)} LIMIT 1`)).length) {
              throw new Error(`Cannot safely assign legacy table ${table.name} to a company.`);
            }
          }
          const violations = await read(snapshot, "PRAGMA foreign_key_check");
          if (violations.some((row) => !priorViolations.has(JSON.stringify(row)))) throw new Error("Company migration would break foreign-key relationships.");
          await execute(snapshot, "COMMIT");
          await execute(snapshot, "VACUUM");
          const integrity = await read<{ integrity_check: string }>(snapshot, "PRAGMA integrity_check");
          if (integrity.some((row) => row.integrity_check !== "ok")) throw new Error("Migrated database failed integrity validation.");
        } finally { await close(snapshot); }
        for (const kind of ["employees_documents", "employees_photos", "company_logo"]) {
          // Preserve snapshot paths here; ensureCompanyDatabase subsequently flattens
          // media and rewrites SQLite/queued paths together through migrateMediaLayout.
          const target = path.join(staging, "files", kind, company.companyId);
          await fs.mkdir(target, { recursive: true });
          for (const mediaRoot of legacyRoots) await copyTree(path.join(mediaRoot, kind, company.companyId), target);
        }
        writeCompanyManifest({ ...company, directory: staging, migratedFrom: sourcePath });
        await fs.rename(staging, destination);
      }
    } finally { await close(source); }
  }
}
