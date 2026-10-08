import { invoke } from "../../ipc/ipc.cjs";
type IncidentApi = import("../../../common/types/incident/Incident", {
  with: { "resolution-mode": "require" },
}).IncidentApi;

export const incidentApi: IncidentApi = {
  addNote: (companyId, id, note, authorId) => invoke("incidents:addNote", companyId, id, note, authorId),
  update: (companyId, id, input) => invoke("incidents:update", companyId, id, input),
  create: (companyId, input) => invoke("incidents:create", companyId, input),
  getAll: (companyId, filters = {}) => invoke("incidents:getAll", companyId, filters),
  getById: (companyId, id, module) => invoke("incidents:getById", companyId, id, module),
  getLocations: (companyId, module) => invoke("incidents:getLocations", companyId, module),
};
