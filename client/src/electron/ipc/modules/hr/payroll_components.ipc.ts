import { ipcMain } from "electron";

import {
  createPayrollComponent,
  getPayrollComponents,
  getEnabledPayrollComponents,
  getPayrollComponentById,
  updatePayrollComponents,
  deletePayrollComponent,
  enablePayrollComponent,
  disablePayrollComponent,
  upsertPayrollComponent,
  getUnsyncedPayrollComponents,
  markPayrollComponentSynced,
} from "../../../database/repositories/modules/hr/payroll_components.repository.js";

export function registerPayrollComponentIPC() {
  console.log("REGISTERING PAYROLL COMPONENT IPC");

  //Get all
  ipcMain.handle(
    "payroll-components:getAll",
    async (_, companyId: string, type?: "EARNING" | "DEDUCTION") => {
      return await getPayrollComponents(companyId, type);
    }
  );

  //Get enabled
  ipcMain.handle(
    "payroll-components:getEnabled",
    async (_, companyId, type?: "EARNING" | "DEDUCTION") => {
      return await getEnabledPayrollComponents(companyId, type);
    }
  );

  //Get by ID
  ipcMain.handle(
    "payroll-components:getById",
    async (_, companyId: string, _id: string) => {
      return await getPayrollComponentById(companyId, _id);
    }
  );

  //Create
  ipcMain.handle(
    "payroll-components:create",
    async (_, companyId, component) => {
      return await createPayrollComponent(companyId, component);
    }
  );

  //Update
  ipcMain.handle(
    "payroll-components:update",
    async (_, companyId: string, components) => {
      await updatePayrollComponents(companyId, components);

      return await getPayrollComponents(companyId);
    }
  );

  //Delete
  ipcMain.handle(
    "payroll-components:delete",
    async (_, companyId: string, id: string) => {
      await deletePayrollComponent(companyId, id);

      return true;
    }
  );

  //Enable
  ipcMain.handle(
    "payroll-components:enable",
    async (_, companyId: string, _id: string) => {
      await enablePayrollComponent(companyId, _id);

      return await getPayrollComponentById(companyId, _id);
    }
  );

  //Disable
  ipcMain.handle(
    "payroll-components:disable",
    async (_, companyId: string, _id: string) => {
      await disablePayrollComponent(companyId, _id);

      return await getPayrollComponentById(companyId, _id);
    }
  );

  //Upsert
  ipcMain.handle(
    "payroll-components:upsert",
    async (_, companyId, component) => {
      await upsertPayrollComponent(component);

      return await getPayrollComponentById(companyId, component._id);
    }
  );

  //Get unsynced
  ipcMain.handle("payroll-components:getUnsynced", async (_, companyId) => {
    return await getUnsyncedPayrollComponents(companyId);
  });

  //Mark synced
  ipcMain.handle(
    "payroll-components:markSynced",
    async (_, companyId: string, _id: string) => {
      await markPayrollComponentSynced(companyId, _id);

      return await getPayrollComponentById(companyId, _id);
    }
  );
}
