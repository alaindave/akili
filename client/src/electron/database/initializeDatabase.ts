import { createEmployeesTable } from "./schemas/employees.schema.js";
import { createAdminUsersTable } from "./schemas/admin_users.schema.js";
import { createAttendancesTable } from "./schemas/attendances.schema.js";
import { createLeavesTable } from "./schemas/leaves.schema.js";
import { createTasksTables } from "./schemas/tasks.schema.js";
import { createOfflineUsersTable } from "./schemas/offline_users.schema.js";
import { createSyncTable } from "./schemas/sync.schema.js";
import { createSettingsTable } from "./schemas/settings.schema.js";
import { createEmployeesDocumentsTable } from "./schemas/employees_documents.schema.js";
import { createPayrollTables } from "./schemas/payroll.schema.js";
import { createCompanyTable } from "./schemas/companies.schema.js";
import { createAuditLogsTable } from "./schemas/audit_logs.schema.js";
import { createNotificationTable } from "./schemas/notification_queue.schema.js";

export async function initializeDatabase() {
  await createCompanyTable();
  await createOfflineUsersTable();
  await createEmployeesTable();
  await createEmployeesDocumentsTable();
  await createAttendancesTable();
  await createLeavesTable();
  await createTasksTables();
  await createAdminUsersTable();
  await createSyncTable();
  await createSettingsTable();
  await createPayrollTables();
  await createAuditLogsTable();
  await createNotificationTable();
  console.log("DATABASE INITIALIZED");
}
