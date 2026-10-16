import { all, get, run, transaction } from "../../db.js";

const key = "storage.media-layout.v2";
export interface MediaMove { source: string; target: string }

export async function getMediaLayoutMigration(): Promise<MediaMove[] | null> {
  const row = await get<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", [key]);
  return row ? JSON.parse(row.value) as MediaMove[] : null;
}

export async function finishMediaLayoutCleanup(): Promise<void> {
  await run("UPDATE app_settings SET value = '[]' WHERE key = ?", [key]);
}

function flatten(value: unknown, companyId: string, logo = false): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.replace(/\\/g, "/");
  const prefix = logo ? `company_logo/${companyId}/` : `${companyId}/`;
  return normalized.startsWith(prefix)
    ? (logo ? "company_logo/" : "") + normalized.slice(prefix.length)
    : value;
}

/** Only local path references change; versions, dirty flags and queue identity stay intact. */
export async function migrateMediaLayoutPaths(companyId: string, moves: MediaMove[]): Promise<void> {
  await transaction(async () => {
    for (const [table, column, logo] of [
      ["companies", "logoPath", true],
      ["employees", "photo_path", false],
      ["employees_documents", "localPath", false],
    ] as const) {
      const rows = await all<{ _id: string; value: string | null }>(
        `SELECT _id, ${column} AS value FROM ${table} WHERE companyId = ?`, [companyId]);
      for (const row of rows) {
        const value = flatten(row.value, companyId, logo);
        if (value !== row.value) await run(
          `UPDATE ${table} SET ${column} = ? WHERE companyId = ? AND _id = ?`,
          [value as string, companyId, row._id]);
      }
    }
    const queue = await all<{ _id: number; entity: string; payload: string }>(
      "SELECT _id, entity, payload FROM sync_queue WHERE companyId = ? AND entity IN ('company', 'company_logo', 'employee', 'employee_photo', 'employee_document')", [companyId]);
    for (const row of queue) {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      const field = row.entity.startsWith("company") ? "logoPath"
        : row.entity === "employee_document" ? "localPath" : "photo_path";
      const value = flatten(payload[field], companyId, field === "logoPath");
      if (value !== payload[field]) {
        payload[field] = value;
        await run("UPDATE sync_queue SET payload = ? WHERE companyId = ? AND _id = ?",
          [JSON.stringify(payload), companyId, row._id]);
      }
    }
    await run("INSERT INTO app_settings (key, value) VALUES (?, ?)", [key, JSON.stringify(moves)]);
  });
}
