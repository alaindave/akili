import { app, ipcMain } from "electron";

export function registerAppIPC() {
  console.log("REGISTERING APP IPC");
  ipcMain.handle("app:getUserDataPath", () => {
    return app.getPath("userData");
  });
}
