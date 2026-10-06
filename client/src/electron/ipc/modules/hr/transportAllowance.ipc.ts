import { ipcMain } from "electron";

import {
  createWeeklyTransportAllowanceReport,
  saveWeeklyTransportAllowanceReport,
} from "../../../services/modules/hr/attendance/transportAllowance.service.js";
import { TransportAllowanceWeeklyReport } from "../../../../common/types/hr/attendance/TransportAllowance.js";

/**
 * Register Transport Allowance IPC handlers
 */
export function registerTransportAllowanceIpc(): void {
  ipcMain.handle(
    "transportAllowance:saveWeeklyPdf",
    (_, report: TransportAllowanceWeeklyReport) =>
      saveWeeklyTransportAllowanceReport(report)
  );
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
