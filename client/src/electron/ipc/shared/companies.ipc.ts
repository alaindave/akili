import { ipcMain } from "../companyIpc.js";
import { listConfiguredCompanies, getCurrentCompanyId, getCurrentUnsyncedCompany, getCompanyBranding } from "../../services/shared/company.service.js";
import { validateCompanyId } from "../../storage/companyStorage.js";

import {
  upsertCompany,
  upsertCompanyId,
  updateCompany,
  getCompanyById,
  markCompanySynced,
  deleteCompany,
  restoreCompany,
  getLogoUrl,
  updateLogo,
} from "../../database/repositories/shared/companies.repository.js";
import type Company from "../../../common/types/shared/Company.js";

/* =========================================================
   REGISTER COMPANY IPC
========================================================= */

export function registerCompanyIpc(): void {
  ipcMain.handle("company:getBranding", (_, companyId: string) => {
    validateCompanyId(companyId);
    return getCompanyBranding(companyId);
  });
  ipcMain.handle("company:listConfigured", () => listConfiguredCompanies());
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
     
     Returns the authenticated company on this installation.
  ======================================================= */

  ipcMain.handle("company:getId", async (): Promise<string | null> => {
    return await getCurrentCompanyId();
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
    return await getCurrentUnsyncedCompany();
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
