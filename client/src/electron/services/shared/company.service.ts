import { getConfiguredCompanies, getCompanyId, getUnsyncedCompany, getCompanyById, getLogoUrl } from "../../database/repositories/shared/companies.repository.js";
import type Company from "../../../common/types/shared/Company.js";
import type { CompanySummary, CompanyBranding } from "../../../common/types/shared/Company.js";
import { getActiveCompanyId } from "../../auth.js";
import { listCompanyStorage, findCompanyStorage, withCompanyStorage } from "../../storage/companyStorage.js";
import { ensureCompanyDatabase } from "./companyDatabase.service.js";

export async function getCompanyBranding(companyId: string): Promise<CompanyBranding | null> {
  const storage = findCompanyStorage(companyId);
  if (!storage) return null;

  return withCompanyStorage(storage, async () => {
    const company = await getCompanyById(companyId);
    if (!company || company.isDeleted) return null;
    return {
      name: company.name,
      logoUrl: company.logoPath ? await getLogoUrl(company.logoPath) : null,
    };
  });
}

export async function listConfiguredCompanies(): Promise<CompanySummary[]> {
  const companies: CompanySummary[] = [];
  for (const storage of listCompanyStorage()) {
    await ensureCompanyDatabase(storage);
    companies.push(...await withCompanyStorage(storage, () => getConfiguredCompanies()));
  }
  return companies.sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

export async function getCurrentCompanyId(): Promise<string | null> {
  const companyId = await getActiveCompanyId();
  const storage = companyId ? findCompanyStorage(companyId) : undefined;
  return storage ? withCompanyStorage(storage, () => getCompanyId(storage.companyId)) : null;
}

export async function getCurrentUnsyncedCompany(): Promise<Company | null> {
  const companyId = await getCurrentCompanyId();
  const storage = companyId ? findCompanyStorage(companyId) : undefined;
  return storage ? withCompanyStorage(storage, () => getUnsyncedCompany(storage.companyId)) : null;
}
