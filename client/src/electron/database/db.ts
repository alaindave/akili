import sqlite3 from "sqlite3";
import path from "path";
import { requireCompanyStorage, withCompanyStorage } from "../storage/companyStorage.js";
import { AsyncLocalStorage } from "node:async_hooks";

// =====================
// TYPES
// =====================
type Params = any[];

type RunResult = sqlite3.RunResult;

type Migration = {
  name: string;
  up: () => Promise<void> | void;
};

// Connections are lazy and isolated per company; no root database is opened.
interface ConnectionState {
  connection: sqlite3.Database;
  queue: Promise<unknown>;
  ready: Promise<void>;
}
const connections = new Map<string, ConnectionState>();

function connectionState(): ConnectionState {
  const company = requireCompanyStorage();
  const dbPath = path.join(company.directory, "Akili_db");
  const existing = connections.get(dbPath);
  if (existing) return existing;
  let connection: sqlite3.Database;
  const ready = new Promise<void>((resolve, reject) => {
    connection = new sqlite3.Database(dbPath, (error) => {
      if (error) { reject(error); return; }
      connection.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;", (pragmaError) => {
        if (pragmaError) reject(pragmaError);
        else resolve();
      });
    });
  });
  const state = { connection: connection!, queue: ready, ready };
  connections.set(dbPath, state);
  return state;
}

// Preserve the existing sqlite3 interface for repositories using direct statements.
export const db = new Proxy({} as sqlite3.Database, {
  get(_target, property) {
    const connection = connectionState().connection;
    const value = Reflect.get(connection, property);
    return typeof value === "function" ? value.bind(connection) : value;
  },
});

export async function closeCompanyDatabases(): Promise<void> {
  for (const state of connections.values()) {
    await state.queue;
    await new Promise<void>((resolve, reject) => state.connection.close((error) => error ? reject(error) : resolve()));
  }
  connections.clear();
}

const transactionContext = new AsyncLocalStorage<{ afterCommit: Array<() => void> }>();

export function afterCommit(callback: () => void): void {
  const current = transactionContext.getStore();
  if (current) current.afterCommit.push(callback);
  else callback();
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  // Nested repository calls share the transaction that already owns the queue.
  // Other asynchronous callers still queue behind it.
  if (transactionContext.getStore()) return task();
  const company = requireCompanyStorage();
  const state = connectionState();
  const next = state.queue
    .catch(() => {}) // prevent chain break
    .then(() => withCompanyStorage(company, async () => {
      await state.ready;
      return task();
    }));

  state.queue = next.catch(() => {}); // keep queue alive even if failure

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
  if (transactionContext.getStore()) return callback();
  const context = { afterCommit: [] as Array<() => void> };
  const result = await enqueue(
    () =>
      new Promise<T>((resolve, reject) => {
        db.serialize(() => {
          db.run("BEGIN TRANSACTION", (beginErr) => {
            if (beginErr) {
              reject(beginErr);
              return;
            }

            transactionContext.run(context, callback)
              .then((result) => {
                db.run("COMMIT", (commitErr) => {
                  if (commitErr) {
                    db.run("ROLLBACK", () => reject(commitErr));
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
  for (const notify of context.afterCommit) notify();
  return result as T;
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

// For multi-row reads inside a transaction that already owns the queue.
export function allDirect<T>(sql: string, params: Params = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error: Error | null, rows: T[]) => {
      if (error) reject(error);
      else resolve(rows ?? []);
    });
  });
}
