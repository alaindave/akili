import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SyncStatus = "IDLE" | "SYNCING" | "OFFLINE" | "ERROR";

interface SyncStore {
  status: SyncStatus;
  lastSyncAt: string | null;
  syncVersion: number;
  pendingChanges: number;

  setSyncing: () => void;
  setSyncCompleted: (timestamp: string) => void;
  setPendingChanges: (count: number) => void;
  setOffline: () => void;
  setSyncError: () => void;
  resetSyncStatus: () => void;
}

const useSyncStore = create<SyncStore>()(
  persist(
    (set) => ({
      status: "IDLE",
      lastSyncAt: null,
      syncVersion: 0,
      pendingChanges: 0,

      setSyncing: () =>
        set({
          status: "SYNCING",
        }),

      setSyncCompleted: (timestamp) =>
        set((store) => ({
          status: "IDLE",
          lastSyncAt: timestamp,
          syncVersion: store.syncVersion + 1,
        })),

      setPendingChanges: (count) =>
        set({
          pendingChanges: Math.max(0, count),
        }),

      setOffline: () =>
        set({
          status: "OFFLINE",
        }),

      setSyncError: () =>
        set({
          status: "ERROR",
        }),

      resetSyncStatus: () =>
        set({
          status: "IDLE",
        }),
    }),
    {
      name: "sync-store",

      partialize: (store) => ({
        lastSyncAt: store.lastSyncAt,
      }),
    }
  )
);

export default useSyncStore;
