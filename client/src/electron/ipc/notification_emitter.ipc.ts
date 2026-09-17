import { BrowserWindow } from "electron";
import type { AppNotification } from "../../common/types/AppNotification.js";

export function emitNotification(notification: AppNotification): void {
  const windows = BrowserWindow.getAllWindows();

  for (const window of windows) {
    if (window.isDestroyed()) {
      continue;
    }

    window.webContents.send("notifications:new", notification);
  }
}
