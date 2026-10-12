import { all, run, transaction } from "../../db.js";

const tables = {
  employee: "employees", attendance: "attendances", attendance_daily_check: "attendance_daily_checks",
  leave: "leaves", payroll_settings: "payroll_settings", payroll_component: "payroll_components",
  payroll_profile: "payroll_employee_profiles", payroll_run: "payroll_runs",
  payroll_result: "payroll_results", payroll_item: "payroll_items",
} as const;

/** Recover committed legacy edits that never reached the queue. Never delete a snapshot. */
export async function recoverUnqueuedHRChanges() {
  await transaction(async () => {
    for (const [entity, table] of Object.entries(tables)) {
      const columns = await all<{ name: string }>(`PRAGMA table_info(${table})`);
      if (!columns.some(column => column.name === "synced")) continue;
      const fields = columns.filter(column => !["synced", "lastSyncedAt"].includes(column.name));
      const payload = `json_object(${fields.map(column => `'${column.name}', source.${column.name}`).join(", ")})`;
      await run(`INSERT INTO sync_queue (companyId, entity, entityId, operation, payload)
        SELECT source.companyId, ?, source._id, 'create', ${payload} FROM ${table} source
        WHERE source.synced = 0 AND NOT EXISTS (SELECT 1 FROM sync_queue q
          WHERE q.companyId = source.companyId AND q.entity = ? AND q.entityId = source._id AND q.synced = 0)`, [entity, entity]);
    }
  });
}
