import { app, BrowserWindow } from "electron";
import { pushPendingChanges } from "./push.service.js";
import { pullLatestChanges } from "./pull.service.js";
import { NetworkService } from "./network.service.js";
import {
  getUnsyncedItems,
  notifyPendingChanges,
} from "../../database/repositories/sync.repository.js";
import { SyncStatusEvent } from "../../../common/types/Sync.js";

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
  : process.env.VITE_API_URL;

let syncing = false;

export default async function sync(companyId: string) {
  console.log("SYNC SERVICE API URL:", API_URL);

  if (syncing) {
    console.log("SYNC ALREADY IN PROGRESS. SKIPPING.");
    notifyRenderer({
      status: "SYNCING",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  syncing = true;

  /*
   * ---------------------------------------------------------
   * SYNC STARTED
   * ---------------------------------------------------------
   */
  notifyRenderer({
    status: "SYNCING",
    timestamp: new Date().toISOString(),
  });

  try {
    /*
     * ---------------------------------------------------------
     * CHECK BACKEND
     * ---------------------------------------------------------
     */
    const backendAvailable = await NetworkService.canReachBackend();

    if (!backendAvailable) {
      console.log("BACKEND UNAVAILABLE. SYNC SKIPPED.");

      const pendingChanges = await getPendingChangesCount(companyId);

      notifyRenderer({
        status: "OFFLINE",
        timestamp: new Date().toISOString(),
        pendingChanges,
      });

      return;
    }

    /*
     * ---------------------------------------------------------
     * PUSH PENDING CHANGES
     * ---------------------------------------------------------
     */
    try {
      const pushResult = await pushPendingChanges(companyId);
      console.log("PUSH RESULTS:", pushResult);
      console.log("COMPANY ID", companyId);
    } catch (error) {
      console.error("PUSH FAILED:", error);
      const pendingChanges = await getPendingChangesCount(companyId);

      notifyRenderer({
        status: "ERROR",
        timestamp: new Date().toISOString(),
        pendingChanges,
        error: getErrorMessage(error),
      });

      return;
    }

    /*
     * ---------------------------------------------------------
     * GET CURRENT PENDING COUNT
     * ---------------------------------------------------------
     */
    const pendingAfterPush = await getPendingChangesCount(companyId);

    console.log("PENDING CHANGES AFTER PUSH:", pendingAfterPush);

    /*
     * ---------------------------------------------------------
     * PULL
     * ---------------------------------------------------------
     */
    try {
      const result = await pullLatestChanges();

      console.log("PULL RESULTS:", result);
    } catch (error) {
      console.error("PULL FAILED:", error);

      /*
       * Even if pull fails, report the current SQLite queue
       * count so the renderer has accurate pending information.
       */
      const pendingChanges = await getPendingChangesCount(companyId);

      notifyRenderer({
        status: "ERROR",
        timestamp: new Date().toISOString(),
        pendingChanges,
        error: getErrorMessage(error),
      });

      return;
    }

    /*
     * ---------------------------------------------------------
     * GET FINAL PENDING COUNT
     * ---------------------------------------------------------
   
     */
    const pendingChanges = await getPendingChangesCount(companyId);

    console.log("FINAL PENDING CHANGES:", pendingChanges);

    /*
     * ---------------------------------------------------------
     * SYNC COMPLETE
     * ---------------------------------------------------------
     */
    console.log("TIMESTAMP:", new Date().toISOString());

    notifyRenderer({
      status: "IDLE",
      timestamp: new Date().toISOString(),
      pendingChanges,
    });
    await notifyPendingChanges(companyId);
  } catch (error) {
    console.error("SYNC FAILED:", error);

    const pendingChanges = await getPendingChangesCount(companyId);

    notifyRenderer({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      pendingChanges,
      error: getErrorMessage(error),
    });
  } finally {
    syncing = false;
  }
}

/*
 * ---------------------------------------------------------
 * GET CURRENT PENDING CHANGES
 * ---------------------------------------------------------
 */
async function getPendingChangesCount(companyId: string): Promise<number> {
  try {
    const pending = await getUnsyncedItems(companyId);
    return pending.length;
  } catch (error) {
    console.error("FAILED TO GET PENDING CHANGES:", error);
    return 0;
  }
}

/*
 * ---------------------------------------------------------
 * SEND SYNC EVENT TO RENDERER
 * ---------------------------------------------------------
 */
function notifyRenderer(event: SyncStatusEvent) {
  console.log("SYNC EVENT:", event);

  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send("sync:status", event);
    }
  });
}

/*
 * ---------------------------------------------------------
 * ERROR MESSAGE
 * ---------------------------------------------------------
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
