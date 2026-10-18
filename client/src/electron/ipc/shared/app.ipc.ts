import { app } from "electron";
import { ipcMain } from "./companyIpc.js";

export function registerAppIPC() {
  console.log("REGISTERING APP IPC");
  ipcMain.handle("app:getUserDataPath", () => {
    return app.getPath("userData");
  });
}
