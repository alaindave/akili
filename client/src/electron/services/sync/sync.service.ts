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
  console.log("SYNC SERVICE FOR COMPANY", companyId);

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

      /*
       * A push is successful only when there are no unsynced
       * items remaining in the local SQLite sync queue.
       */
      const pendingAfterPush = await getPendingChangesCount(companyId);

      console.log("PENDING CHANGES AFTER PUSH:", pendingAfterPush);

      if (pendingAfterPush > 0) {
        throw new Error(
          `PUSH INCOMPLETE: ${pendingAfterPush} item(s) were not successfully pushed to the server`
        );
      }

      console.log("ALL PENDING CHANGES PUSHED SUCCESSFULLY.");
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
     * PULL LATEST CHANGES
     * ---------------------------------------------------------
     */

    try {
      const pullResult = await pullLatestChanges(companyId);

      console.log("PULL RESULTS:", pullResult);

      /*
       * pullLatestChanges MUST throw if any pulled item fails
       * to be upserted.
       *
       * Therefore reaching this point means all pulled items
       * were successfully upserted.
       */
      console.log("ALL PULLED CHANGES UPSERTED SUCCESSFULLY.");
    } catch (error) {
      console.error("PULL FAILED:", error);

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
     * FINAL VERIFICATION
     * ---------------------------------------------------------
     */

    const pendingChanges = await getPendingChangesCount(companyId);

    console.log("FINAL PENDING CHANGES:", pendingChanges);

    /*
     * If anything remains in the local sync queue, the sync
     * is NOT considered successful.
     */
    if (pendingChanges > 0) {
      console.error(
        `SYNC INCOMPLETE: ${pendingChanges} pending change(s) remain.`
      );

      notifyRenderer({
        status: "ERROR",
        timestamp: new Date().toISOString(),
        pendingChanges,
        error: `SYNC INCOMPLETE: ${pendingChanges} pending change(s) remain`,
      });

      return;
    }

    /*
     * ---------------------------------------------------------
     * SYNC SUCCESS
     * ---------------------------------------------------------
     *
     * At this point:
     *
     * 1. Backend was reachable.
     * 2. Every pending local change was pushed.
     * 3. Local pending queue is empty.
     * 4. pullLatestChanges completed without error.
     * 5. Therefore all pulled items were successfully upserted.
     *
     * NOW the sync is considered successful.
     */

    console.log("========================================");
    console.log("SYNC COMPLETED SUCCESSFULLY");
    console.log("COMPANY:", companyId);
    console.log("PENDING CHANGES:", pendingChanges);
    console.log("TIMESTAMP:", new Date().toISOString());
    console.log("========================================");

    notifyRenderer({
      status: "IDLE",
      timestamp: new Date().toISOString(),
      pendingChanges: 0,
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

    /*
     * IMPORTANT:
     *
     * Do NOT return 0 here if the database query itself failed.
     * Returning 0 could falsely make the sync look successful.
     */
    throw error;
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
