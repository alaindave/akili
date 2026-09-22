import { SyncStatusEvent } from "../../common/types/Sync";
import useSyncStore from "../../store/sync.store";

let initialized = false;

let unsubscribeSyncStatus: (() => void) | null = null;
let unsubscribePendingChanges: (() => void) | null = null;

/* =========================================================
   INITIALIZE RENDERER SYNC
========================================================= */

export function initializeRendererSync() {
  if (initialized) {
    return;
  }

  initialized = true;

  console.log("RENDERER SYNC MANAGER INITIALIZING...");

  /* =======================================================
     SYNC STATUS
  ======================================================= */

  unsubscribeSyncStatus = window.electron.sync.onSyncStatus(
    ({ status, timestamp }: SyncStatusEvent) => {
      const syncStore = useSyncStore.getState();

      console.log("RENDERER RECEIVED SYNC STATUS:", status, timestamp ?? "");

      switch (status) {
        /* ===================================================
           SYNC COMPLETED
        =================================================== */

        case "IDLE": {
          if (timestamp) {
            console.log("LAST SYNC TIMESTAMP:", timestamp);
            syncStore.setSyncCompleted(timestamp);
          } else {
            syncStore.resetSyncStatus();
          }

          break;
        }

        /* ===================================================
           SYNCING
        =================================================== */

        case "SYNCING": {
          syncStore.setSyncing();
          break;
        }

        /* ===================================================
           OFFLINE
        =================================================== */

        case "OFFLINE": {
          syncStore.setOffline();
          break;
        }

        /* ===================================================
           ERROR
        =================================================== */

        case "ERROR": {
          syncStore.setSyncError();
          break;
        }

        /* ===================================================
           UNKNOWN STATUS
        =================================================== */

        default: {
          console.warn("RENDERER RECEIVED UNKNOWN SYNC STATUS:", status);
        }
      }
    }
  );

  /* =======================================================
     PENDING CHANGES
  ======================================================= */

  unsubscribePendingChanges = window.electron.sync.onPendingChanges(
    ({
      pendingChanges,
      timestamp,
    }: {
      pendingChanges: number;
      timestamp: string | null;
    }) => {
      const syncStore = useSyncStore.getState();

      console.log(
        "RENDERER RECEIVED PENDING CHANGES:",
        pendingChanges,
        timestamp
      );

      syncStore.setPendingChanges(pendingChanges);
    }
  );

  console.log("RENDERER SYNC MANAGER INITIALIZED.");
}

/* =========================================================
   DESTROY RENDERER SYNC
========================================================= */

export function destroyRendererSync() {
  if (!initialized) {
    return;
  }

  unsubscribeSyncStatus?.();
  unsubscribePendingChanges?.();

  unsubscribeSyncStatus = null;
  unsubscribePendingChanges = null;

  initialized = false;

  console.log("RENDERER SYNC MANAGER DESTROYED.");
}
