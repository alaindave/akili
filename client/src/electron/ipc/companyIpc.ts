import { ipcMain as electronIpcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { currentCompanyStorage, withCompanyStorage } from "../storage/companyStorage.js";

// Capture once per request, including time spent awaiting dialogs or network I/O.
// Switching the active company cannot redirect an existing request's database/files.
export const ipcMain = {
  handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: never[]) => unknown): void {
    electronIpcMain.handle(channel, (event, ...args) =>
      withCompanyStorage(currentCompanyStorage(), () => listener(event, ...args as never[])));
  },
};
