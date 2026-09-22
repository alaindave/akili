import { invoke } from "../../ipc/ipc.cjs";
type IncidentApi = import("../../../common/types/incident/Incident", {
  with: { "resolution-mode": "require" },
}).IncidentApi;

export const incidentApi: IncidentApi = {
  update: (companyId, id, input) => invoke("incidents:update", companyId, id, input),
  create: (companyId, input) => invoke("incidents:create", companyId, input),
  getAll: (companyId, filters = {}) => invoke("incidents:getAll", companyId, filters),
  getById: (companyId, id) => invoke("incidents:getById", companyId, id),
  getLocations: (companyId) => invoke("incidents:getLocations", companyId),
};
