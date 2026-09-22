import { ipcMain } from "electron";

import {
  getPayrollSettings,
  getPayrollSettingsById,
  createPayrollSettings,
  updatePayrollSettings,
  updatePayrollSettingsFields,
  deletePayrollSettings,
  restorePayrollSettings,
  markPayrollSettingsSynced,
  getUnsyncedPayrollSettings,
} from "../../../database/repositories/modules/hr/payroll_settings.repository.js";

export function registerPayrollSettingsIPC() {
  console.log("REGISTERING PAYROLL SETTINGS IPC");

  ipcMain.handle("payroll-settings:get", async (_, companyId: string) => {
    return await getPayrollSettings(companyId);
  });

  ipcMain.handle(
    "payroll-settings:getById",
    async (_, companyId: string, _id: string) => {
      return await getPayrollSettingsById(companyId, _id);
    }
  );

  ipcMain.handle(
    "payroll-settings:create",
    async (_, companyId: string, data) => {
      return await createPayrollSettings(companyId, data);
    }
  );

  ipcMain.handle(
    "payroll-settings:update",
    async (_, companyId: string, settings) => {
      return await updatePayrollSettings(companyId, settings);
    }
  );

  ipcMain.handle(
    "payroll-settings:updateFields",
    async (_, companyId: string, _id: string, fields) => {
      return await updatePayrollSettingsFields(companyId, _id, fields);
    }
  );

  ipcMain.handle(
    "payroll-settings:delete",
    async (_, companyId: string, _id: string) => {
      await deletePayrollSettings(companyId, _id);

      return {
        success: true,
      };
    }
  );

  ipcMain.handle(
    "payroll-settings:restore",
    async (_, companyId: string, _id: string) => {
      return await restorePayrollSettings(companyId, _id);
    }
  );

  ipcMain.handle(
    "payroll-settings:markSynced",
    async (_, companyId: string, _id: string) => {
      await markPayrollSettingsSynced(companyId, _id);

      return {
        success: true,
      };
    }
  );

  ipcMain.handle(
    "payroll-settings:getUnsynced",
    async (_, companyId: string) => {
      return await getUnsyncedPayrollSettings(companyId);
    }
  );
}
