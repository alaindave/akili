import { ipcMain } from "../../shared/companyIpc.js";

import {
  createLeave,
  getLeaveById,
  getLeaveByEmployeeId,
  getLeaveByMonth,
  getOngoingLeaves,
  updateLeave,
  deleteLeave,
  cancelLeave,
} from "../../../database/repositories/modules/hr/leaves.repository.js";

import Leave from "../../../../common/types/hr/time-off/TimeOff.js";

export function registerLeaveIPC() {
  console.log("REGISTERING LEAVES IPC");

  ipcMain.handle(
    "leave:create",
    async (
      _,
      companyId: string,
      leave: Pick<
        Leave,
        "employeeId" | "startDate" | "endDate" | "notes" | "motifId" | "status"
      >
    ) => {
      console.log("LEAVE IPC RECEIVED:", companyId, leave);

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
        motif?: string;
        notes?: string;
        additionalNotes?: string;
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
