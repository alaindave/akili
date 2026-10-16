import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SyncStatus = "IDLE" | "SYNCING" | "OFFLINE" | "ERROR";

interface SyncStore {
  status: SyncStatus;
  lastSyncAt: string | null;
  syncVersion: number;
  pendingChanges: number;
  errorMessage: string | null;

  setSyncing: () => void;
  setSyncCompleted: (timestamp: string) => void;
  setPendingChanges: (count: number) => void;
  setOffline: () => void;
  setSyncError: (message?: string) => void;
  resetSyncStatus: () => void;
}

const useSyncStore = create<SyncStore>()(
  persist(
    (set) => ({
      status: "IDLE",
      lastSyncAt: null,
      syncVersion: 0,
      pendingChanges: 0,
      errorMessage: null,

      setSyncing: () =>
        set({
          status: "SYNCING",
          errorMessage: null,
        }),

      setSyncCompleted: (timestamp) =>
        set((store) => ({
          status: "IDLE",
          errorMessage: null,
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
          errorMessage: null,
        }),

      setSyncError: (message) =>
        set({
          status: "ERROR",
          errorMessage: message ?? null,
        }),

      resetSyncStatus: () =>
        set({
          status: "IDLE",
          errorMessage: null,
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
