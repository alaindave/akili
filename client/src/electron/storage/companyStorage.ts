import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";

export interface CompanyStorage {
  companyId: string;
  name: string;
  directory: string;
  migratedFrom?: string;
}

// Capture the old default before main changes it; older imports opened SQLite here.
export const legacyDefaultUserData = app.getPath("userData");
const root = path.join(app.getPath("appData"), "Akili");
const context = new AsyncLocalStorage<{ company: CompanyStorage | null }>();
let activeCompany: CompanyStorage | null = null;

export function initializeUserDataPath(): void {
  fs.mkdirSync(root, { recursive: true });
  app.setPath("userData", root);
}

export function getUserDataRoot(): string {
  return root;
}

export function validateCompanyId(companyId: string): void {
  if (
    typeof companyId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(companyId)
  ) {
    throw new Error("Invalid company ID for local storage.");
  }
}

export function companyFolderName(name: string, companyId: string): string {
  validateCompanyId(companyId);
  const safeName =
    Array.from(name.normalize("NFC"))
      .filter(
        (character) =>
          character.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(character)
      )
      .join("")
      .trim()
      .replace(/[. ]+$/g, "")
      .slice(0, 80) || "Entreprise";
  return `${safeName}_${companyId}`;
}

export function listCompanyStorage(): CompanyStorage[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || entry.name.startsWith(".")) return [];
    const directory = path.join(root, entry.name);
    const manifest = path.join(directory, "company.json");
    if (!fs.existsSync(manifest)) return [];
    const data = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
      companyId: string;
      name: string;
      migratedFrom?: string;
    };
    validateCompanyId(data.companyId);
    if (
      typeof data.name !== "string" ||
      !entry.name.endsWith(`_${data.companyId}`)
    ) {
      throw new Error(`Invalid company storage manifest: ${manifest}`);
    }
    return [{ ...data, directory }];
  });
}

export function findCompanyStorage(
  companyId: string
): CompanyStorage | undefined {
  validateCompanyId(companyId);
  const matches = listCompanyStorage().filter(
    (company) => company.companyId === companyId
  );
  if (matches.length > 1)
    throw new Error(`Duplicate company storage: ${companyId}`);
  return matches[0];
}

export function writeCompanyManifest(company: CompanyStorage): void {
  const temporary = path.join(company.directory, "company.json.tmp");
  fs.writeFileSync(
    temporary,
    JSON.stringify(
      {
        companyId: company.companyId,
        name: company.name,
        ...(company.migratedFrom ? { migratedFrom: company.migratedFrom } : {}),
      },
      null,
      2
    )
  );
  fs.renameSync(temporary, path.join(company.directory, "company.json"));
}

export function createCompanyStorage(
  name: string,
  companyId: string
): CompanyStorage {
  const existing = findCompanyStorage(companyId);
  if (existing) return existing;
  const company = {
    name,
    companyId,
    directory: path.join(root, companyFolderName(name, companyId)),
  };
  fs.mkdirSync(company.directory, { recursive: true });
  writeCompanyManifest(company);
  return company;
}

export function setActiveCompanyStorage(company: CompanyStorage | null): void {
  activeCompany = company;
}

export function currentCompanyStorage(): CompanyStorage | null {
  const captured = context.getStore();
  return captured ? captured.company : activeCompany;
}

export function requireCompanyStorage(): CompanyStorage {
  const company = currentCompanyStorage();
  if (!company)
    throw new Error("Select a company before accessing local data.");
  return company;
}

export function withCompanyStorage<T>(
  company: CompanyStorage | null,
  action: () => T
): T {
  return context.run({ company }, action);
}

export function getCompanyFilesRoot(): string {
  return path.join(requireCompanyStorage().directory, "files");
}

export function validateStorageCompany(companyId: string): void {
  validateCompanyId(companyId);
  if (requireCompanyStorage().companyId !== companyId) {
    throw new Error("Media company does not match active company storage");
  }
}
