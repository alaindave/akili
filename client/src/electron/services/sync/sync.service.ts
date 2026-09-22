import { app, BrowserWindow } from "electron";
import { pushPendingChanges } from "./push.service.js";
import { pullLatestChanges } from "./pull.service.js";
import { NetworkService } from "./network.service.js";
import {
  getUnsyncedItems,
  notifyPendingChanges,
} from "../../database/repositories/shared/sync.repository.js";
import { SyncStatusEvent } from "../../../common/types/Sync.js";

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
  : process.env.VITE_API_URL;

let syncing = false;

const MAX_SYNC_RETRIES = 10;
const SYNC_RETRY_DELAY = 3000;

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
     * PUSH PENDING CHANGES WITH RETRIES
     * ---------------------------------------------------------
     */

    let pushSuccessful = false;
    let lastPushError: unknown = null;

    for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
      try {
        console.log(`PUSH ATTEMPT ${attempt}/${MAX_SYNC_RETRIES}`);

        const pushResult = await pushPendingChanges(companyId);

        console.log("PUSH RESULTS:", pushResult);

        /*
         * Check the queue after every push attempt.
         */
        const pendingAfterPush = await getPendingChangesCount(companyId);

        console.log(
          `PENDING CHANGES AFTER PUSH ATTEMPT ${attempt}:`,
          pendingAfterPush
        );

        /*
         * Nothing remains -> push is successful.
         */
        if (pendingAfterPush === 0) {
          pushSuccessful = true;

          console.log("ALL PENDING CHANGES PUSHED SUCCESSFULLY.");

          break;
        }

        /*
         * Items still remain.
         *
         * Retry unless this was the final attempt.
         */
        lastPushError = new Error(
          `PUSH INCOMPLETE: ${pendingAfterPush} item(s) remain`
        );

        if (attempt < MAX_SYNC_RETRIES) {
          console.log(
            `PUSH INCOMPLETE. RETRYING IN ${SYNC_RETRY_DELAY / 1000} SECONDS...`
          );

          notifyRenderer({
            status: "SYNCING",
            timestamp: new Date().toISOString(),
            pendingChanges: pendingAfterPush,
            error: `Retrying sync (${attempt + 1}/${MAX_SYNC_RETRIES})...`,
          });

          await delay(SYNC_RETRY_DELAY);
        }
      } catch (error) {
        lastPushError = error;

        console.error(`PUSH ATTEMPT ${attempt} FAILED:`, error);

        const pendingChanges = await getPendingChangesCount(companyId);

        /*
         * Retry if attempts remain.
         */
        if (attempt < MAX_SYNC_RETRIES) {
          console.log(
            `PUSH FAILED. RETRYING IN ${SYNC_RETRY_DELAY / 1000} SECONDS...`
          );

          notifyRenderer({
            status: "SYNCING",
            timestamp: new Date().toISOString(),
            pendingChanges,
            error: `Push failed. Retrying (${
              attempt + 1
            }/${MAX_SYNC_RETRIES})...`,
          });

          await delay(SYNC_RETRY_DELAY);
        }

        await notifyPendingChanges(companyId);
      }
    }

    /*
     * ---------------------------------------------------------
     * PUSH FAILED AFTER ALL RETRIES
     * ---------------------------------------------------------
     */

    if (!pushSuccessful) {
      const pendingChanges = await getPendingChangesCount(companyId);

      const errorMessage =
        lastPushError instanceof Error
          ? lastPushError.message
          : String(lastPushError);

      console.error(`PUSH FAILED AFTER ${MAX_SYNC_RETRIES} ATTEMPTS.`);

      notifyRenderer({
        status: "ERROR",
        timestamp: new Date().toISOString(),
        pendingChanges,
        error: `PUSH FAILED AFTER ${MAX_SYNC_RETRIES} ATTEMPTS: ${errorMessage}`,
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
 * DELAY
 * ---------------------------------------------------------
 */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
