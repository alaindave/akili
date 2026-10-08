import { ipcMain } from "electron";
import { addIncidentNote, updateIncident, createIncident, getIncidentById, getIncidentLocations, getIncidents } from "../../database/repositories/shared/incidents.repository.js";
import type { IncidentFilters, IncidentInput } from "../../../common/types/incident/Incident.js";

import type { AppModule } from "../../../common/types/task/Task.js";

export function registerIncidentIPC() {
  ipcMain.handle("incidents:addNote", (_, companyId: string, id: string, note: string, authorId: string) => addIncidentNote(companyId, id, note, authorId));
  ipcMain.handle("incidents:update", (_, companyId: string, id: string, input: IncidentInput) => updateIncident(companyId, id, input));
  ipcMain.handle("incidents:create", (_, companyId: string, input: IncidentInput) => createIncident(companyId, input));
  ipcMain.handle("incidents:getAll", (_, companyId: string, filters: IncidentFilters) => getIncidents(companyId, filters));
  ipcMain.handle("incidents:getById", (_, companyId: string, id: string, module?: AppModule) => getIncidentById(companyId, id, module));
  ipcMain.handle("incidents:getLocations", (_, companyId: string, module?: AppModule) => getIncidentLocations(companyId, module));
}
