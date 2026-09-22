import { ipcMain } from "electron";

import {
  upsertCompany,
  upsertCompanyId,
  getCompanyId,
  updateCompany,
  getCompanyById,
  markCompanySynced,
  getUnsyncedCompany,
  deleteCompany,
  restoreCompany,
  getLogoUrl,
  updateLogo,
} from "../../database/repositories/shared/companies.repository.js";
import type Company from "../../../common/types/Company.js";

/* =========================================================
   REGISTER COMPANY IPC
========================================================= */

export function registerCompanyIpc(): void {
  ipcMain.handle(
    "company:upsert",
    async (_, company: Company): Promise<void> => {
      if (!company) {
        throw new Error("Company data is required");
      }

      await upsertCompany(company);
    }
  );

  /* =======================================================
    GET COMPANY LOGO
  ======================================================= */
  ipcMain.handle("company:getLogoUrl", async (_, logoPath: string) => {
    return await getLogoUrl(logoPath);
  });

  /* =======================================================
    UPDATE COMPANY LOGO
  ======================================================= */

  ipcMain.handle(
    "company:updateLogo",
    async (
      _,
      data: {
        companyId: string;
        mimeType: string;
        data: ArrayBuffer;
      }
    ) => {
      return await updateLogo(data.companyId, data.mimeType, data.data);
    }
  );

  /* =======================================================
     UPSERT COMPANY ID
  ======================================================= */

  ipcMain.handle(
    "company:upsertId",
    async (_, company: Company): Promise<void> => {
      if (!company) {
        throw new Error("Company data is required");
      }

      if (!company.companyId) {
        throw new Error("Company ID is required");
      }

      await upsertCompanyId(company);
    }
  );

  /* =======================================================
     GET COMPANY BY ID
     
     Includes deleted companies.
     
     Useful for local/internal operations where you need
     to inspect the complete company record.
  ======================================================= */

  ipcMain.handle(
    "company:getById",
    async (_, companyId: string): Promise<Company | null> => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      return await getCompanyById(companyId);
    }
  );

  /* =======================================================
     GET CURRENT COMPANY ID
     
     One installation = one company.
  ======================================================= */

  ipcMain.handle("company:getId", async (): Promise<string | null> => {
    return await getCompanyId();
  });

  /* =======================================================
     UPDATE COMPANY
  ======================================================= */

  ipcMain.handle(
    "company:update",
    async (_event, company: Company): Promise<void> => {
      if (!company) {
        throw new Error("Company data is required");
      }

      if (!company.companyId) {
        throw new Error("Company ID is required");
      }

      await updateCompany(company);
    }
  );

  /* =======================================================
     MARK COMPANY AS SYNCED
  ======================================================= */

  ipcMain.handle(
    "company:markSynced",
    async (
      _event,
      data: {
        companyId: string;
        serverVersion?: number;
      }
    ): Promise<void> => {
      if (!data?.companyId) {
        throw new Error("Company ID is required");
      }

      await markCompanySynced(data.companyId, data.serverVersion);
    }
  );

  /* =======================================================
     GET UNSYNCED COMPANY
  ======================================================= */

  ipcMain.handle("company:getUnsynced", async (): Promise<Company | null> => {
    return await getUnsyncedCompany();
  });

  /* =======================================================
     DELETE COMPANY
     
     This performs a soft delete:
       isDeleted = 1
       synced = 0
     
     The deletion is then added to the sync queue.
  ======================================================= */

  ipcMain.handle(
    "company:delete",
    async (_event, companyId: string): Promise<void> => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      await deleteCompany(companyId);
    }
  );

  /* =======================================================
     RESTORE COMPANY
  ======================================================= */

  ipcMain.handle(
    "company:restore",
    async (_event, companyId: string): Promise<void> => {
      if (!companyId) {
        throw new Error("Company ID is required");
      }

      await restoreCompany(companyId);
    }
  );
}
