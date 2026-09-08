import { SyncStatusEvent } from "../../common/types/Sync";
import useSyncStore from "../../store/sync.store";
import { queryClient } from "../lib/queryClient";
import { attendanceKeys } from "../modules/hr/attendance/hooks/useAttendance";
import { employeeKeys } from "../modules/hr/employees/hooks/useEmployees";

import { leaveKeys } from "../modules/hr/leave/hooks/useLeave";

let initialized = false;

let unsubscribeSyncStatus: (() => void) | null = null;
let unsubscribePendingChanges: (() => void) | null = null;

/* =========================================================
   INVALIDATE ALL SYNCED ENTITY QUERIES
========================================================= */

async function invalidateSyncedQueries() {
  /*
   * Invalidate every entity whose data can be changed
   * by the synchronization process.
   *
   * React Query will refetch active queries automatically.
   */

  await Promise.all([
    // Employees
    queryClient.invalidateQueries({
      queryKey: employeeKeys.all,
    }),

    // Attendances
    queryClient.invalidateQueries({
      queryKey: attendanceKeys.all,
    }),

    // Leaves
    queryClient.invalidateQueries({
      queryKey: leaveKeys.all,
    }),
  ]);
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

  unsubscribeSyncStatus = window.electron.onSyncStatus(
    async ({ status, timestamp }: SyncStatusEvent) => {
      const syncStore = useSyncStore.getState();

      console.log("RENDERER RECEIVED SYNC STATUS:", status, timestamp ?? "");

      switch (status) {
        /* ===================================================
           SYNC COMPLETED
        =================================================== */

        case "IDLE": {
          if (timestamp) {
            console.log("LAST SYNC TIMESTAMP", timestamp);
            syncStore.setSyncCompleted(timestamp);

            try {
              await invalidateSyncedQueries();

              console.log("RENDERER QUERY CACHE INVALIDATED AFTER SYNC.");
            } catch (error) {
              console.error(
                "FAILED TO INVALIDATE QUERY CACHE AFTER SYNC:",
                error
              );
            }
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

  /*
   * Remove sync status listener.
   */
  unsubscribeSyncStatus?.();

  /*
   * Remove pending changes listener.
   */
  unsubscribePendingChanges?.();

  unsubscribeSyncStatus = null;
  unsubscribePendingChanges = null;

  initialized = false;

  console.log("RENDERER SYNC MANAGER DESTROYED.");
}
