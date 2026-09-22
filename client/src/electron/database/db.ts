import sqlite3 from "sqlite3";
import path from "path";
import { app } from "electron";

// =====================
// TYPES
// =====================
type Params = any[];

type RunResult = sqlite3.RunResult;

type Migration = {
  name: string;
  up: () => Promise<void> | void;
};

// =====================
// DB PATH
// =====================
const dbPath: string = path.join(app.getPath("userData"), "Akili_db");

console.log("DATABASE PATH:", dbPath);

// =====================
// CONNECTION
// =====================
export const db = new sqlite3.Database(dbPath, (err: Error | null) => {
  if (err) {
    console.error("DB error:", err);
    return;
  }

  console.log("SQLite CONNECTED");

  db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA synchronous = NORMAL");
    db.run("PRAGMA busy_timeout = 5000");
  });
});

// =====================
//  UNIFIED QUEUE (READ + WRITE)
// =====================
let queue: Promise<any> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue
    .catch(() => {}) // prevent chain break
    .then(task);

  queue = next.catch(() => {}); // keep queue alive even if failure

  return next;
}

// =====================
// RETRY HELPER
// =====================
function withRetry<T>(
  fn: () => Promise<T>,
  retries = 5,
  delay = 120
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (n: number) => {
      fn()
        .then(resolve)
        .catch((err) => {
          if (err?.code === "SQLITE_BUSY" && n > 0) {
            setTimeout(() => attempt(n - 1), delay);
          } else {
            reject(err);
          }
        });
    };

    attempt(retries);
  });
}

// =====================
//  RUN (WRITE OPERATIONS)
// =====================
export const run = (sql: string, params: Params = []): Promise<RunResult> => {
  return enqueue(() =>
    withRetry(
      () =>
        new Promise<RunResult>((resolve, reject) => {
          db.run(sql, params, function (this: RunResult, err: Error | null) {
            if (err) return reject(err);
            resolve(this);
          });
        })
    )
  );
};

// =====================
//  RUN DIRECT (WRITE OPERATIONS)
// =====================

export const runDirect = (
  sql: string,
  params: Params = []
): Promise<RunResult> => {
  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve(this);
        });
      })
  );
};

// =====================
// GET (READ SINGLE)
// =====================
//prettier-ignore
export const get = <T = unknown,>(
  sql: string,
  params: Params = []
): Promise<T | null> => {
  return enqueue(() =>
    withRetry(
      () =>
        new Promise<T | null>((resolve, reject) => {
          db.get(sql, params, (err: Error | null, row: T) => {
            if (err) return reject(err);
            resolve(row ?? null);
          });
        })
    )
  );
};

// =====================
//  ALL (READ MULTIPLE)
// =====================
//prettier-ignore
export const all = <T = unknown,>(
  sql: string,
  params: Params = []
): Promise<T[]> => {
  return enqueue(() =>
    withRetry(
      () =>
        new Promise<T[]>((resolve, reject) => {
          db.all(sql, params, (err: Error | null, rows: T[]) => {
            if (err) return reject(err);
            resolve(rows ?? []);
          });
        })
    )
  );
};

// =====================
//  TRANSACTIONS
// =====================
export async function transaction<T>(callback: () => Promise<T>): Promise<T> {
  return enqueue(
    () =>
      new Promise<T>((resolve, reject) => {
        db.serialize(() => {
          db.run("BEGIN TRANSACTION", (beginErr) => {
            if (beginErr) {
              reject(beginErr);
              return;
            }

            callback()
              .then((result) => {
                db.run("COMMIT", (commitErr) => {
                  if (commitErr) {
                    reject(commitErr);
                    return;
                  }

                  resolve(result);
                });
              })
              .catch((err) => {
                db.run("ROLLBACK", () => {
                  reject(err);
                });
              });
          });
        });
      })
  );
}

// =====================
//  MIGRATIONS
// =====================
async function createMigrationsTable(): Promise<void> {
  await run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      runAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function migrate(migrations: Migration[] = []): Promise<void> {
  await createMigrationsTable();

  for (const migration of migrations) {
    const exists = await get<{ name: string }>(
      "SELECT name FROM migrations WHERE name = ?",
      [migration.name]
    );

    if (!exists) {
      console.log("Running migration:", migration.name);

      await transaction(async () => {
        await migration.up();
      });

      await run("INSERT INTO migrations (name) VALUES (?)", [migration.name]);
    }
  }
}

// For reads inside transaction(), whose callback already owns the database queue.
export function getDirect<T>(sql: string, params: Params = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error: Error | null, row: T) => {
      if (error) reject(error);
      else resolve(row ?? null);
    });
  });
}
