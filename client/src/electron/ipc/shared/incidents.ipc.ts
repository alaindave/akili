import { ipcMain } from "electron";
import { updateIncident, createIncident, getIncidentById, getIncidentLocations, getIncidents } from "../../database/repositories/shared/incidents.repository.js";
import type { IncidentFilters, IncidentInput } from "../../../common/types/incident/Incident.js";

export function registerIncidentIPC() {
  ipcMain.handle("incidents:update", (_, companyId: string, id: string, input: IncidentInput) => updateIncident(companyId, id, input));
  ipcMain.handle("incidents:create", (_, companyId: string, input: IncidentInput) => createIncident(companyId, input));
  ipcMain.handle("incidents:getAll", (_, companyId: string, filters: IncidentFilters) => getIncidents(companyId, filters));
  ipcMain.handle("incidents:getById", (_, companyId: string, id: string) => getIncidentById(companyId, id));
  ipcMain.handle("incidents:getLocations", (_, companyId: string) => getIncidentLocations(companyId));
}
