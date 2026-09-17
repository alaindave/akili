import { ipcMain } from "electron";

import { createWeeklyTransportAllowanceReport } from "../services/attendance/transportAllowance.service.js";

/**
 * Register Transport Allowance IPC handlers
 */
export function registerTransportAllowanceIpc(): void {
  console.log("REGISTERING TRANSPORT ALLOWANCE IPC ");
  ipcMain.handle(
    "transportAllowance:createWeeklyReport",
    async (_, companyId: string, weekStart: string) => {
      if (!companyId || typeof companyId !== "string") {
        throw new Error("L'identifiant de l'entreprise est requis.");
      }

      if (!weekStart || typeof weekStart !== "string") {
        throw new Error("La date de début de semaine est requise.");
      }
      return await createWeeklyTransportAllowanceReport(companyId, weekStart);
    }
  );
}
