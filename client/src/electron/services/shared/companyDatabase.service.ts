import { migrateEmployeeDocuments } from "./employeeDocumentStorage.service.js";
import { initializeDatabase } from "../../database/schemas/shared/initializeDatabase.js";
import { ensureStorageDirectories } from "../../storage/directories.js";
import { type CompanyStorage, listCompanyStorage, withCompanyStorage } from "../../storage/companyStorage.js";
import { migrateCompanyStorage } from "../../storage/migrateCompanyStorage.js";
import { migrateMediaLayout } from "./mediaLayout.service.js";

import { migrateEmployeePhotos } from "./employeePhoto.service.js";

const initializing = new Map<string, Promise<void>>();

export function ensureCompanyDatabase(company: CompanyStorage): Promise<void> {
  const existing = initializing.get(company.directory);
  if (existing) return existing;
  const pending = withCompanyStorage(company, async () => {
    await ensureStorageDirectories();
    await initializeDatabase(company.companyId);
    await migrateMediaLayout();
    await migrateEmployeePhotos();
    await migrateEmployeeDocuments();
  });
  initializing.set(company.directory, pending);
  pending.catch(() => initializing.delete(company.directory));
  return pending;
}

export async function initializeCompanyDatabases(): Promise<void> {
  await migrateCompanyStorage();
  for (const company of listCompanyStorage()) await ensureCompanyDatabase(company);
}
