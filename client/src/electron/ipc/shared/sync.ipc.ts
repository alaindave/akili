import { ipcMain } from "electron";
import sync from "../../services/shared/sync/sync.service.js";
import { getUnsyncedItems } from "../../database/repositories/shared/sync.repository.js";

export function registerSyncIPC() {
  ipcMain.handle("sync:pending-count", async (_, companyId: string) => {
    return (await getUnsyncedItems(companyId)).length;
  });
  console.log("REGISTERING SYNC IPC");
  ipcMain.handle("sync:run", async (_, companyId: string) => {
    console.log("IPC: SYNC FOR COMPANY ID:", companyId);
    try {
      await sync(companyId);
      return {
        success: true,
        message: "Sync success",
      };
    } catch (error) {
      console.error("SYNC IPC FAILED:", error);

      return {
        success: false,
        message: "Sync failed",
      };
    }
  });
}
