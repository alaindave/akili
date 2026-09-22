import type Company from "../../common/types/Company";

export async function getCompanyEmail(companyId: string): Promise<string> {
  const company: Company | null = await window.electron.company.getById(companyId);
  const email = company?.email?.trim();
  if (!email) {
    throw new Error("Veuillez renseigner l’adresse e-mail dans les paramètres de l’entreprise.");
  }
  return email;
}
