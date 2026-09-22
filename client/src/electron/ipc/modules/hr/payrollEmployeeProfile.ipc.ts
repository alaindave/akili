import { IpcMainInvokeEvent, ipcMain } from "electron";

import EmployeePayrollProfile, {
  CreatePayrollProfileDto,
} from "../../../../common/types/payroll/PayrollEmployeeProfile.js";

import {
  createEmployeePayrollProfile,
  updateManyEmployeePayrollProfiles,
  upsertEmployeePayrollProfile,
  upsertManyEmployeePayrollProfiles,
  getEmployeePayrollProfile,
  getEmployeePayrollProfilesByEmployee,
  getEmployeePayrollProfileByComponent,
  getAllEmployeePayrollProfiles,
  getUnsyncedEmployeePayrollProfiles,
  markPayrollEmployeeProfileSynced,
  markManyPayrollEmployeeProfileSynced,
  deleteEmployeePayrollProfile,
  restoreEmployeePayrollProfile,
  permanentlyDeleteEmployeePayrollProfile,
  employeePayrollProfileExists,
  countEmployeePayrollProfiles,
  createManyEmployeePayrollProfiles,
} from "../../../database/repositories/modules/hr/payroll_employee_profile.repository.js";

import {
  initializeEmployeePayrollProfiles,
  initializeEmployeePayrollProfilesForEmployee,
  addPayrollComponentToAllEmployees,
  resetEmployeePayrollProfileToDefaults,
} from "../../../services/modules/hr/payroll/payrollProfile.service.js";

/* -------------------------------------------------------------------------- */
/*                         PAYROLL EMPLOYEE PROFILE IPC                       */
/* -------------------------------------------------------------------------- */

export function registerPayrollEmployeeProfileIPC() {
  console.log("REGISTERING PAYROLL EMPLOYEE PROFILE IPC");

  /* ------------------------------------------------------------------------ */
  /*                              Repository                                   */
  /* ------------------------------------------------------------------------ */

  ipcMain.handle(
    "payrollEmployeeProfiles:create",
    async (
      _: IpcMainInvokeEvent,
      companyId: string,
      employeeID: string,
      profile: CreatePayrollProfileDto
    ) => {
      return await createEmployeePayrollProfile(companyId, employeeID, profile);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:createMany",
    async (
      _: IpcMainInvokeEvent,
      companyId: string,
      employeeID: string,
      profiles: CreatePayrollProfileDto[]
    ) => {
      return await createManyEmployeePayrollProfiles(
        companyId,
        employeeID,
        profiles
      );
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:update",
    async (
      _: IpcMainInvokeEvent,
      companyId: string,
      profiles: EmployeePayrollProfile[]
    ) => {
      return await updateManyEmployeePayrollProfiles(companyId, profiles);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:updateMany",
    async (
      _: IpcMainInvokeEvent,
      companyId: string,
      profiles: EmployeePayrollProfile[]
    ) => {
      return await updateManyEmployeePayrollProfiles(companyId, profiles);
    }
  );

  /*
   * Upsert receives the complete profile.
   *
   * The repository derives companyId from profile.companyId.
   */
  ipcMain.handle(
    "payrollEmployeeProfiles:upsert",
    async (_: IpcMainInvokeEvent, profile: EmployeePayrollProfile) => {
      return await upsertEmployeePayrollProfile(profile);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:upsertMany",
    async (_: IpcMainInvokeEvent, profiles: EmployeePayrollProfile[]) => {
      return await upsertManyEmployeePayrollProfiles(profiles);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:get",
    async (_: IpcMainInvokeEvent, companyId: string, _id: string) => {
      return await getEmployeePayrollProfile(companyId, _id);
    }
  );

  /* ------------------------------------------------------------------------ */
  /*                                Get All                                    */
  /* ------------------------------------------------------------------------ */

  ipcMain.handle(
    "payrollEmployeeProfiles:getAll",
    async (
      _: IpcMainInvokeEvent,
      companyId: string,
      employeeID?: string,
      type?: "EARNING" | "DEDUCTION"
    ) => {
      return await getAllEmployeePayrollProfiles(companyId, employeeID, type);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:getByEmployee",
    async (_: IpcMainInvokeEvent, companyId: string, employeeId: string) => {
      return await getEmployeePayrollProfilesByEmployee(companyId, employeeId);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:getByComponent",
    async (
      _: IpcMainInvokeEvent,
      companyId: string,
      employeeId: string,
      componentId: string
    ) => {
      return await getEmployeePayrollProfileByComponent(
        companyId,
        employeeId,
        componentId
      );
    }
  );

  /* ------------------------------------------------------------------------ */
  /*                               Sync                                        */
  /* ------------------------------------------------------------------------ */

  ipcMain.handle(
    "payrollEmployeeProfiles:getUnsynced",
    async (_: IpcMainInvokeEvent, companyId: string) => {
      return await getUnsyncedEmployeePayrollProfiles(companyId);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:markSynced",
    async (_: IpcMainInvokeEvent, companyId: string, id: string) => {
      return await markPayrollEmployeeProfileSynced(companyId, id);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:markManySynced",
    async (_: IpcMainInvokeEvent, companyId: string, ids: string[]) => {
      return await markManyPayrollEmployeeProfileSynced(companyId, ids);
    }
  );

  /* ------------------------------------------------------------------------ */
  /*                              Delete                                       */
  /* ------------------------------------------------------------------------ */

  ipcMain.handle(
    "payrollEmployeeProfiles:delete",
    async (_: IpcMainInvokeEvent, companyId: string, id: string) => {
      return await deleteEmployeePayrollProfile(companyId, id);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:restore",
    async (_: IpcMainInvokeEvent, companyId: string, id: string) => {
      return await restoreEmployeePayrollProfile(companyId, id);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:permanentlyDelete",
    async (_: IpcMainInvokeEvent, companyId: string, id: string) => {
      return await permanentlyDeleteEmployeePayrollProfile(companyId, id);
    }
  );

  /* ------------------------------------------------------------------------ */
  /*                              Existence                                    */
  /* ------------------------------------------------------------------------ */

  ipcMain.handle(
    "payrollEmployeeProfiles:exists",
    async (
      _: IpcMainInvokeEvent,
      companyId: string,
      employeeId: string,
      componentId: string
    ) => {
      return await employeePayrollProfileExists(
        companyId,
        employeeId,
        componentId
      );
    }
  );

  /* ------------------------------------------------------------------------ */
  /*                                Count                                      */
  /* ------------------------------------------------------------------------ */

  ipcMain.handle(
    "payrollEmployeeProfiles:count",
    async (_: IpcMainInvokeEvent, companyId: string) => {
      return await countEmployeePayrollProfiles(companyId);
    }
  );

  /* -------------------------------------------------------------------------- */
  /*                                  Services                                  */
  /* -------------------------------------------------------------------------- */

  ipcMain.handle(
    "payrollEmployeeProfiles:initialize",
    async (_: IpcMainInvokeEvent, companyId: string) => {
      return await initializeEmployeePayrollProfiles(companyId);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:initializeForEmployee",
    async (_: IpcMainInvokeEvent, companyId: string, employeeId: string) => {
      return await initializeEmployeePayrollProfilesForEmployee(
        companyId,
        employeeId
      );
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:addComponentToEmployees",
    async (_: IpcMainInvokeEvent, companyId: string, component) => {
      return await addPayrollComponentToAllEmployees(companyId, component);
    }
  );

  ipcMain.handle(
    "payrollEmployeeProfiles:resetToDefaults",
    async (_: IpcMainInvokeEvent, companyId: string, employeeId: string) => {
      return await resetEmployeePayrollProfileToDefaults(companyId, employeeId);
    }
  );
}
