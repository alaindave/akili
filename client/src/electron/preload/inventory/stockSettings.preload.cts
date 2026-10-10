type StockSettingsApi = import("../../../common/types/inventory/StockSettings.js", { with: { "resolution-mode": "require" } }).StockSettingsApi;
import { invoke } from "../../ipc/ipc.cjs";
export const stockSettingsApi: StockSettingsApi = {
  getInitialization: (companyId) => invoke("inventory:settings:getInitialization", companyId),
  saveOpeningDraft: (companyId, input) => invoke("inventory:settings:saveOpeningDraft", companyId, input),
  submitOpeningDraft: (companyId, input) => invoke("inventory:settings:submitOpeningDraft", companyId, input),
  get: (companyId) => invoke("inventory:settings:get", companyId),
  saveCategory: (companyId, input) => invoke("inventory:settings:saveCategory", companyId, input),
  saveUnit: (companyId, input) => invoke("inventory:settings:saveUnit", companyId, input),
  archiveCategory: (companyId, input) => invoke("inventory:settings:archiveCategory", companyId, input),
  archiveUnit: (companyId, input) => invoke("inventory:settings:archiveUnit", companyId, input),
  saveNumbering: (companyId, input) => invoke("inventory:settings:saveNumbering", companyId, input),
};
