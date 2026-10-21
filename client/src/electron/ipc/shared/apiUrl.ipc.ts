import { app, ipcMain } from "electron";

const PRODUCTION_API_URL =
  process.env.PRODUCTION_API_URL || "https://leather-works.onrender.com";

export function registerApiUrlIPC() {
  ipcMain.handle(
    "app:get-api-url",
    (_event, developmentUrl: string): string => {
      if (app.isPackaged) {
        return PRODUCTION_API_URL;
      }
      return developmentUrl;
    }
  );
}
