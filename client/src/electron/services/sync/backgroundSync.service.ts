import { BrowserWindow } from "electron";
import { NetworkService } from "./network.service.js";
import sync from "./sync.service.js";

const SYNC_INTERVAL = 2 * 60 * 1000;

let syncInterval: NodeJS.Timeout | null = null;
let syncing = false;

export function startBackgroundSync(companyId: string) {
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
  runBackgroundSync(companyId);

  syncInterval = setInterval(() => {
    runBackgroundSync(companyId);
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
  if (syncing) {
    console.log("SYNC ALREADY IN PROGRESS. SKIPPING...");
    notifyRenderer({
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
        status: "OFFLINE",
        timestamp: new Date().toISOString(),
      });

      return;
    }

    console.log("BACKGROUND SYNC STARTED...");

    await sync(companyId);

    console.log("BACKGROUND SYNC COMPLETED");
  } catch (error) {
    console.error("BACKGROUND SYNC FAILED:", error);

    notifyRenderer({
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
