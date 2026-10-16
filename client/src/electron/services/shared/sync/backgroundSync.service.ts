import { BrowserWindow } from "electron";
import { NetworkService } from "./network.service.js";
import sync from "./sync.service.js";
import { processNotificationQueue } from "../email/notificationQueue.service.js";
import { getActiveCompanyId } from "../../../auth.js";
import { findCompanyStorage, withCompanyStorage } from "../../../storage/companyStorage.js";

const SYNC_INTERVAL = 2 * 60 * 1000;

let syncInterval: NodeJS.Timeout | null = null;
let syncing = false;

export function startBackgroundSync(companyId: string) {
  const storage = findCompanyStorage(companyId);
  if (!storage) return;
  if (!companyId) {
    console.log("NO COMPANY CONFIGURED. BACKGROUND SYNC WAITING.");
    return;
  }

  if (syncInterval) {
    console.log("BACKGROUND SYNC ALREADY STARTED");
    return;
  }

  console.log("STARTING BACKGROUND SYNC...");

  // Perform one immediately when Electron starts
  void withCompanyStorage(storage, () => runBackgroundSync(companyId));

  syncInterval = setInterval(() => {
    void withCompanyStorage(storage, () => runBackgroundSync(companyId));
  }, SYNC_INTERVAL);
}

export function stopBackgroundSync() {
  if (!syncInterval) {
    return;
  }

  clearInterval(syncInterval);
  syncInterval = null;

  console.log("BACKGROUND SYNC STOPPED");
}

async function runBackgroundSync(companyId: string) {
  if (await getActiveCompanyId() !== companyId) return;
  if (syncing) {
    console.log("SYNC ALREADY IN PROGRESS. SKIPPING...");

    notifyRenderer({
      companyId,
      status: "SYNCING",
      timestamp: new Date().toISOString(),
    });

    return;
  }

  syncing = true;

  try {
    const backendAvailable = await NetworkService.canReachBackend();

    if (!backendAvailable) {
      console.log("BACKEND UNAVAILABLE. BACKGROUND SYNC SKIPPED.");

      notifyRenderer({
      companyId,
        status: "OFFLINE",
        timestamp: new Date().toISOString(),
      });

      return;
    }

    console.log("BACKGROUND SYNC STARTED...");

    /*
     * -----------------------------------------------------
     * SYNC
     * -----------------------------------------------------
     */
    await sync(companyId);

    console.log("BACKGROUND SYNC COMPLETED");

    /*
     * -----------------------------------------------------
     * NOTIFICATION QUEUE
     * -----------------------------------------------------
     */
    try {
      console.log("PROCESSING NOTIFICATION QUEUE AFTER SYNC...");

      await processNotificationQueue();

      console.log("NOTIFICATION QUEUE PROCESSING AFTER SYNC COMPLETED.");
    } catch (error) {
      console.error("FAILED TO PROCESS NOTIFICATION QUEUE AFTER SYNC:", error);
    }
  } catch (error) {
    console.error("BACKGROUND SYNC FAILED:", error);

    notifyRenderer({
      companyId,
      status: "ERROR",
      timestamp: new Date().toISOString(),
      error: getErrorMessage(error),
    });
  } finally {
    syncing = false;
  }
}

/**
 * Notify all renderer windows about the current sync state.
 */
function notifyRenderer(event: {
  companyId: string;
  status: "SYNCING" | "OFFLINE" | "ERROR";
  timestamp: string;
  error?: string;
}) {
  console.log("BACKGROUND SYNC EVENT:", event);

  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send("sync:status", event);
    }
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
