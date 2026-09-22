type Company = import("../../../common/types/Company", {
  with: { "resolution-mode": "require" },
}).default;

import { invoke } from "../../ipc/ipc.cjs";

export const companyApi = {
  adminUsers: {
    getAll: (companyId: string) => invoke("adminUsers:getAll", companyId),
  },

  getLogoUrl: (logoPath: string) => invoke("company:getLogoUrl", logoPath),

  updateLogo: (data: {
    companyId: string;
    mimeType: string;
    data: ArrayBuffer;
  }) => invoke("company:updateLogo", data),

  upsert: (company: Company) => invoke("company:upsert", company),

  upsertId: (company: Company) => invoke("company:upsertId", company),

  getById: (companyId: string) => invoke("company:getById", companyId),

  getId: () => invoke("company:getId"),

  update: (company: Pick<Company, "companyId" | "name" | "legalName" | "logoPath" | "address" | "city" | "country" | "phone" | "email" | "website">) => invoke("company:update", company),

  markSynced: (companyId: string, serverVersion?: number) =>
    invoke("company:markSynced", {
      companyId,
      serverVersion,
    }),

  getUnsynced: () => invoke("company:getUnsynced"),

  delete: (companyId: string) => invoke("company:delete", companyId),

  restore: (companyId: string) => invoke("company:restore", companyId),
};
