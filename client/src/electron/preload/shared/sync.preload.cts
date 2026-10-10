import { ipcRenderer } from "electron";
import { invoke } from "../../ipc/ipc.cjs";
type SyncStatusEvent = import("../../../common/types/shared/Sync", {
  with: { "resolution-mode": "require" },
}).SyncStatusEvent;

export const syncApi = {
  getPendingCount: (companyId: string) =>
    invoke<number>("sync:pending-count", companyId),
  sync: (companyId: string) => invoke("sync:run", companyId),

  onSyncStatus: (callback: (event: SyncStatusEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: SyncStatusEvent) => {
      callback(data);
    };

    ipcRenderer.on("sync:status", listener);

    return () => {
      ipcRenderer.removeListener("sync:status", listener);
    };
  },

  onPendingChanges: (
    callback: (data: { companyId: string; pendingChanges: number; timestamp: string }) => void
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: {
        companyId: string;
        pendingChanges: number;
        timestamp: string;
      }
    ) => {
      callback(data);
    };

    ipcRenderer.on("sync:pending-changes", listener);

    return () => {
      ipcRenderer.removeListener("sync:pending-changes", listener);
    };
  },
};
