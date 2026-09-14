import { ipcMain } from "electron";

import {
  createLeave,
  getLeaveById,
  getLeaveByEmployeeId,
  getLeaveByMonth,
  getOngoingLeaves,
  updateLeave,
  deleteLeave,
  cancelLeave,
} from "../database/repositories/leaves.repository.js";

import Leave from "../../common/types/Leave.js";

export function registerLeaveIPC() {
  console.log("REGISTERING LEAVES IPC");

  ipcMain.handle(
    "leave:create",
    async (
      _,
      companyId: string,
      leave: Pick<
        Leave,
        | "managerEmail"
        | "employeeId"
        | "employeeFirstName"
        | "employeeLastName"
        | "startDate"
        | "endDate"
        | "notes"
        | "subject"
      >
    ) => {
      console.log("LEAVE IPC RECEIVED:", companyId, leave.managerEmail, leave);

      const createdLeave = await createLeave(companyId, leave);
      return createdLeave;
    }
  );

  ipcMain.handle(
    "leave:getLeaveByEmployeeId",
    async (_, companyId: string, employeeId: string) => {
      return getLeaveByEmployeeId(companyId, employeeId);
    }
  );

  ipcMain.handle(
    "leave:getLeaveById",
    async (_, companyId: string, _id: string) => {
      return getLeaveById(companyId, _id);
    }
  );

  ipcMain.handle(
    "leave:getOnGoing",
    async (_, companyId: string, date: string) => {
      return getOngoingLeaves(companyId, date);
    }
  );

  ipcMain.handle(
    "leave:getLeaveByMonth",
    async (_, companyId: string, month: string) => {
      return getLeaveByMonth(companyId, month);
    }
  );

  ipcMain.handle("leave:cancel", async (_, companyId: string, _id: string) => {
    return cancelLeave(companyId, _id);
  });

  ipcMain.handle(
    "leave:update",
    async (
      _,
      companyId: string,
      _id: string,
      updates: {
        subject?: string;
        notes?: string;
        startDate?: string;
        endDate?: string;
        status?: string;
      }
    ) => {
      return updateLeave(companyId, _id, updates);
    }
  );

  ipcMain.handle("leave:delete", async (_, companyId: string, _id: string) => {
    return deleteLeave(companyId, _id);
  });
}
