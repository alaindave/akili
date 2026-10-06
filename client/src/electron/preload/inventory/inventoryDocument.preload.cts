type Repository = import("../../database/repositories/modules/inventory/inventoryDocument.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryDocumentRepository;
type InventoryDocumentListOptions = import("../../database/repositories/modules/inventory/inventoryDocument.repository.js", {
  with: { "resolution-mode": "require" },
}).InventoryDocumentListOptions;

import { invoke } from "../../ipc/ipc.cjs";

export const inventoryDocumentApi = {
  getById: (
    companyId: string,
    id: string
  ): ReturnType<Repository["getById"]> =>
    invoke("inventory:document:getById", companyId, id),

  getByDocumentNumber: (
    companyId: string,
    documentNumber: string
  ): ReturnType<Repository["getByDocumentNumber"]> =>
    invoke("inventory:document:getByDocumentNumber", companyId, documentNumber),

  documentNumberExists: (
    companyId: string,
    documentNumber: string,
    excludeId?: string
  ): ReturnType<Repository["documentNumberExists"]> =>
    invoke("inventory:document:documentNumberExists", companyId, documentNumber, excludeId),

  list: (
    companyId: string,
    options?: InventoryDocumentListOptions
  ): ReturnType<Repository["list"]> =>
    invoke("inventory:document:list", companyId, options),

  count: (
    companyId: string,
    options?: Omit<InventoryDocumentListOptions, "limit" | "offset">
  ): ReturnType<Repository["count"]> =>
    invoke("inventory:document:count", companyId, options),
};
