import { ipcMain } from "electron";
import sync from "../services/sync/sync.service.js";

export function registerSyncIPC() {
  console.log("REGISTERING SYNC IPC");
  ipcMain.handle("sync:run", async (_, companyId: string) => {
    console.log("SYNC FOR COMPANY ID:", companyId);
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
