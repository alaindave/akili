import { ipcRenderer } from "electron";
import { invoke } from "../../ipc/ipc.cjs";
type EmailNotification = import("../../../common/types/EmailNotification", {
  with: { "resolution-mode": "require" },
}).EmailNotification;
type AppNotification = import("../../../common/types/AppNotification", {
  with: { "resolution-mode": "require" },
}).AppNotification;

export const notificationsApi = {
  email: {
    send: (notification: EmailNotification) =>
      ipcRenderer.invoke("email:send", notification),
  },

  scheduleReminder: (message: string, remindAt: string) =>
    invoke("notifications:schedule-reminder", message, remindAt),

  cancelReminder: (id: string) => invoke("notifications:cancel-reminder", id),

  cancelAllReminders: () => invoke("notifications:cancel-all-reminders"),

  onNew: (callback: (notification: AppNotification) => void) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      notification: AppNotification
    ) => {
      callback(notification);
    };
    ipcRenderer.on("notifications:new", listener);
    return () => {
      ipcRenderer.removeListener("notifications:new", listener);
    };
  },
};
