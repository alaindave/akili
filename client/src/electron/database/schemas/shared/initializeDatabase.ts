import { migratePayrollAccounts } from "../../repositories/modules/hr/payrollAccount.repository.js";
import { migrateAttendanceClockInSettings } from "../../repositories/modules/hr/attendanceSettings.repository.js";
import { queueExistingIncidents } from "../../repositories/shared/incidents.repository.js";
import { createEmployeesTable } from "../modules/hr/employees.schema.js";
import { createIncidentsTable } from "./incidents.schema.js";
import { createAdminUsersTable } from "./admin_users.schema.js";
import { createAttendancesTable } from "../modules/hr/attendances.schema.js";
import { createLeavesTable } from "../modules/hr/leaves.schema.js";
import { createTasksTables } from "./tasks.schema.js";
import { createOfflineUsersTable } from "./offline_users.schema.js";
import { createSyncTable } from "./sync.schema.js";
import { createSettingsTable } from "./settings.schema.js";
import { createEmployeesDocumentsTable } from "../modules/hr/employees_documents.schema.js";
import { createPayrollTables } from "../modules/hr/payroll.schema.js";
import { createCompanyTable } from "./companies.schema.js";
import { createAuditLogsTable } from "./audit_logs.schema.js";
import { createNotificationTable } from "./notification_queue.schema.js";
import { createInventoryWarehouseTable } from "../modules/inventory/inventory_warehouses.schema.js";
import { createInventoryItemsTable } from "../modules/inventory/inventory_items.schema.js";
import { createInventoryMovementsTables } from "../modules/inventory/inventory_movements.schema.js";
import { initializeInventorySync } from "../modules/inventory/inventory_sync.schema.js";

export async function initializeDatabase() {
  // Shared tables
  await createCompanyTable();
  await createOfflineUsersTable();
  await createTasksTables();
  await createIncidentsTable();
  await createAdminUsersTable();
  await createSyncTable();
  await queueExistingIncidents();
  await createSettingsTable();
  await createAuditLogsTable();
  await createNotificationTable();
  // HR tables
  await createEmployeesTable();
  await createEmployeesDocumentsTable();
  await createAttendancesTable();
  await createLeavesTable();
  await migrateAttendanceClockInSettings();
  await createPayrollTables();
  await migratePayrollAccounts();
  // Inventory tables
  await createInventoryItemsTable();
  await createInventoryMovementsTables();
  await createInventoryWarehouseTable();
  await initializeInventorySync();

  console.log("DATABASE INITIALIZED");
}
