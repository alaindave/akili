import { ipcMain } from "./companyIpc.js";
import sync from "../../services/shared/sync/sync.service.js";
import { getUnsyncedItems } from "../../database/repositories/shared/sync.repository.js";
import { app } from "electron";

const PRODUCTION_API_URL = "https://leather-works.onrender.com";

export function registerSyncIPC() {
  ipcMain.handle("sync:get-api-url", (_, API_URL: string): string => {
    if (app.isPackaged) {
      return PRODUCTION_API_URL;
    }
    return API_URL;
  });

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
