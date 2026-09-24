import { migratePayrollAccounts } from "./repositories/modules/hr/payrollAccount.repository.js";
import { migrateAttendanceClockInSettings } from "./repositories/modules/hr/attendanceSettings.repository.js";
import { queueExistingIncidents } from "./repositories/shared/incidents.repository.js";
import { createEmployeesTable } from "./schemas/modules/hr/employees.schema.js";
import { createIncidentsTable } from "./schemas/shared/incidents.schema.js";
import { createAdminUsersTable } from "./schemas/shared/admin_users.schema.js";
import { createAttendancesTable } from "./schemas/modules/hr/attendances.schema.js";
import { createLeavesTable } from "./schemas/modules/hr/leaves.schema.js";
import { createTasksTables } from "./schemas/shared/tasks.schema.js";
import { createOfflineUsersTable } from "./schemas/shared/offline_users.schema.js";
import { createSyncTable } from "./schemas/shared/sync.schema.js";
import { createSettingsTable } from "./schemas/shared/settings.schema.js";
import { createEmployeesDocumentsTable } from "./schemas/modules/hr/employees_documents.schema.js";
import { createPayrollTables } from "./schemas/modules/hr/payroll.schema.js";
import { createCompanyTable } from "./schemas/shared/companies.schema.js";
import { createAuditLogsTable } from "./schemas/shared/audit_logs.schema.js";
import { createNotificationTable } from "./schemas/shared/notification_queue.schema.js";

export async function initializeDatabase() {
  await createCompanyTable();
  await createOfflineUsersTable();
  await createEmployeesTable();
  await createEmployeesDocumentsTable();
  await createAttendancesTable();
  await createLeavesTable();
  await createTasksTables();
  await createIncidentsTable();
  await createAdminUsersTable();
  await createSyncTable();
  await queueExistingIncidents();
  await createSettingsTable();
  await migrateAttendanceClockInSettings();
  await createPayrollTables();
  await migratePayrollAccounts();
  await createAuditLogsTable();
  await createNotificationTable();
  console.log("DATABASE INITIALIZED");
}
