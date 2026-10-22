import { ipcMain } from "../../shared/companyIpc.js";
import type { TimeOffMotif } from "../../../../common/types/hr/time-off/TimeOff.js";
import { createTimeOff, getTimeOff, listMotifs, listTimeOff, saveMotif, transitionTimeOff, updateTimeOff, deactivateMotif } from "../../../services/modules/hr/timeOff.service.js";

export function registerTimeOffIPC() {
  ipcMain.handle("time-off:list", (_, companyId: string, employeeId?: string) => listTimeOff(companyId, employeeId));
  ipcMain.handle("time-off:get", (_, companyId: string, id: string) => getTimeOff(companyId, id));
  ipcMain.handle("time-off:create", (_, companyId: string, input: Parameters<typeof createTimeOff>[1]) => createTimeOff(companyId, input));
  ipcMain.handle("time-off:update", (_, companyId: string, id: string, input: Parameters<typeof updateTimeOff>[2]) => updateTimeOff(companyId, id, input));
  ipcMain.handle("time-off:transition", (_, companyId: string, id: string, action: Parameters<typeof transitionTimeOff>[2], reason?: string) => transitionTimeOff(companyId, id, action, reason));
  ipcMain.handle("time-off:motifs:list", (_, companyId: string) => listMotifs(companyId));
  ipcMain.handle("time-off:motifs:save", (_, companyId: string, input: Omit<TimeOffMotif, "companyId"> & { companyId?: string; serverVersion?: number }) => saveMotif(companyId, input));
  ipcMain.handle("time-off:motifs:deactivate", (_, companyId: string, id: string) => deactivateMotif(companyId, id));
}
