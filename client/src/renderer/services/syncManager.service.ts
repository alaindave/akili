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

  unsubscribeSyncStatus = window.electron.onSyncStatus(
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

            /*
             * This increments syncVersion.
             *
             * Individual pages listen to syncVersion and
             * explicitly refetch their SQLite queries.
             */
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
          /*
           * IMPORTANT:
           *
           * Do NOT touch React Query here.
           *
           * Existing SQLite-backed data must remain visible
           * while the application is offline.
           */
          syncStore.setOffline();
          break;
        }

        /* ===================================================
           ERROR
        =================================================== */

        case "ERROR": {
          /*
           * An error does not invalidate or clear local data.
           */
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

  unsubscribePendingChanges = window.electron.onPendingChanges(
    ({ pendingChanges, timestamp }) => {
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
