import { historicalTimeOffBalance } from "../../../common/migrations/timeOffLegacy.js";
import type { TimeOffMigrationDatabase } from "./timeOff.migration.js";

// Split CREATE TABLE definitions without splitting commas in CHECK/FK expressions.
function definitions(sql: string): string[] {
  const body = sql.slice(sql.indexOf("(") + 1, sql.lastIndexOf(")"));
  const parts: string[] = [];
  let depth = 0, start = 0, quote = "";
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (quote) {
      if (char === quote) {
        if (body[i + 1] === quote) i++;
        else quote = "";
      }
    } else if (["'", '"', "`"].includes(char)) quote = char;
    else if (char === "[") quote = "]";
    else if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) { parts.push(body.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(body.slice(start).trim());
  return parts;
}
const removed = /\b(?:legacyNeedsReview|legacyData)\b/i;
const quoteId = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** Run before normal database use. Rebuild atomically to remove the old cross-column CHECK. */
export async function removeTimeOffReviewFields(db: TimeOffMigrationDatabase, companyId: string) {
  const table = await db.get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type='table' AND name='time_off'");
  if (!table || !removed.test(table.sql)) return;
  if (await db.get("SELECT _id FROM time_off WHERE companyId<>? LIMIT 1", [companyId]))
    throw new Error("TimeOff database belongs to another company");
  const columns = await db.all<{ name: string; hidden: number }>("PRAGMA table_xinfo(time_off)");
  const retained = columns.filter(column => !removed.test(column.name) && !column.hidden).map(column => quoteId(column.name));
  const retainedDefinitions = definitions(table.sql).filter(part => !removed.test(part));
  const hasBalance = columns.some(column => column.name === "balanceDaysDeducted");
  if (!hasBalance) retainedDefinitions.push("balanceDaysDeducted REAL NOT NULL DEFAULT 0");
  const objects = await db.all<{ type: string; name: string; sql: string }>(
    "SELECT type,name,sql FROM sqlite_master WHERE tbl_name='time_off' AND type IN ('index','trigger') AND sql IS NOT NULL");
  const views = await db.all<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type='view'");
  if (views.some(view => /\btime_off\b/i.test(view.sql) && removed.test(view.sql)))
    throw new Error("A custom TimeOff view references removed columns");
  const foreignKeys = await db.get<{ foreign_keys: number }>("PRAGMA foreign_keys");
  const alterTable = await db.get<{ legacy_alter_table: number }>("PRAGMA legacy_alter_table");
  // Disabling FK actions before BEGIN avoids cascading deletion of referencing rows during rebuild.
  await db.run("PRAGMA foreign_keys=OFF");
  try {
    await db.run("PRAGMA legacy_alter_table=ON");
    if ((await db.get<{ foreign_keys: number }>("PRAGMA foreign_keys"))?.foreign_keys !== 0)
      throw new Error("TimeOff schema upgrade must run outside a transaction");
    await db.transaction(async () => {
      if ((await db.all("PRAGMA foreign_key_check")).length) throw new Error("Existing foreign-key violations must be resolved first");
      await db.run(`CREATE TABLE time_off_without_review (${retainedDefinitions.join(",\n")})`);
      await db.run(`INSERT INTO time_off_without_review (${retained.join(",")}) SELECT ${retained.join(",")} FROM time_off`);
      const historical = await db.all<Record<string, string | number | null>>(
        "SELECT * FROM time_off WHERE motifId IS NULL AND status='APPROVED'");
      for (const row of historical) await db.run(
        "UPDATE time_off_without_review SET balanceDaysDeducted=? WHERE companyId=? AND _id=?",
        [historicalTimeOffBalance(row), row.companyId, row._id]);
      await db.run("DROP TABLE time_off");
      await db.run("ALTER TABLE time_off_without_review RENAME TO time_off");
      for (const object of objects) if (!removed.test(object.sql)) await db.run(object.sql);
      if ((await db.all("PRAGMA foreign_key_check")).length) throw new Error("TimeOff upgrade introduced foreign-key violations");
      if ((await db.get<{ integrity_check: string }>("PRAGMA integrity_check"))?.integrity_check !== "ok")
        throw new Error("TimeOff upgrade failed its integrity check");
    });
  } finally {
    await db.run(`PRAGMA legacy_alter_table=${alterTable?.legacy_alter_table === 1 ? "ON" : "OFF"}`);
    await db.run(`PRAGMA foreign_keys=${foreignKeys?.foreign_keys === 1 ? "ON" : "OFF"}`);
  }
}
