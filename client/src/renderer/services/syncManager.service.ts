import { SyncStatusEvent } from "../../common/types/shared/Sync";
import useSyncStore from "../../store/sync.store";
import useAdminUser from "../../store/auth.store";

let initialized = false;

let unsubscribeSyncStatus: (() => void) | null = null;
let unsubscribePendingChanges: (() => void) | null = null;
let unsubscribeCompany: (() => void) | null = null;
let pendingRevision = 0;

async function refreshPendingChanges(companyId: string) {
  const revision = ++pendingRevision;
  if (!companyId) {
    useSyncStore.getState().setPendingChanges(0);
    return;
  }
  try {
    const count = await window.electron.sync.getPendingCount(companyId);
    if (initialized && revision === pendingRevision) {
      useSyncStore.getState().setPendingChanges(count);
    }
  } catch (error) {
    console.error("FAILED TO LOAD PENDING CHANGES:", error);
  }
}

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
    ({ status, timestamp, pulledChanges, pendingChanges }: SyncStatusEvent) => {
      const syncStore = useSyncStore.getState();
      if (typeof pendingChanges === "number") {
        pendingRevision++;
        syncStore.setPendingChanges(pendingChanges);
      }

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
          if (pulledChanges && timestamp) syncStore.setSyncCompleted(timestamp);
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
      companyId,
    }: {
      companyId: string;
      pendingChanges: number;
      timestamp: string | null;
    }) => {
      if (companyId !== useAdminUser.getState().adminUser.companyId) return;
      pendingRevision++;
      const syncStore = useSyncStore.getState();

      console.log(
        "RENDERER RECEIVED PENDING CHANGES:",
        pendingChanges,
        timestamp
      );

      syncStore.setPendingChanges(pendingChanges);
    }
  );

  unsubscribeCompany = useAdminUser.subscribe((state, previous) => {
    if (state.adminUser.companyId !== previous.adminUser.companyId) {
      useSyncStore.getState().setPendingChanges(0);
      void refreshPendingChanges(state.adminUser.companyId);
    }
  });
  void refreshPendingChanges(useAdminUser.getState().adminUser.companyId);

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
  unsubscribeCompany?.();
  pendingRevision++;

  unsubscribeSyncStatus = null;
  unsubscribePendingChanges = null;
  unsubscribeCompany = null;

  initialized = false;

  console.log("RENDERER SYNC MANAGER DESTROYED.");
}
