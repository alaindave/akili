import { BrowserWindow } from "electron";
import { z } from "zod";
import { clearToken, saveLocalSession, saveToken } from "../../auth.js";
import { getCompanyById, upsertCompanyId } from "../../database/repositories/shared/companies.repository.js";
import { createSocket, getSocket } from "../../socket.js";
import { closeAppNotifications } from "./notification/appNotification.service.js";
import { startBackgroundSync, stopBackgroundSync } from "./sync/backgroundSync.service.js";
import { createCompanyStorage, findCompanyStorage, listCompanyStorage, setActiveCompanyStorage, withCompanyStorage } from "../../storage/companyStorage.js";
import { ensureCompanyDatabase } from "./companyDatabase.service.js";
import { getOfflineUserByEmail } from "../../database/repositories/shared/offline_users.repository.js";
import type OfflineUser from "../../../common/types/shared/OfflineUser.js";
import type Company from "../../../common/types/shared/Company.js";

export const loginCredentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  companyId: z.string().trim().min(1).max(255).optional(),
});

const identitySchema = z.object({
  _id: z.string().min(1), companyId: z.string().min(1),
  role: z.enum(["ADMIN", "MANAGER", "VIEWER"]),
});

export async function establishCompanySession(identity: unknown, token?: string): Promise<void> {
  const session = identitySchema.parse(identity);
  const storage = findCompanyStorage(session.companyId);
  if (!storage) throw new Error("Entreprise non configurée sur cet appareil.");
  await ensureCompanyDatabase(storage);
  return withCompanyStorage(storage, async () => {
  const company = await getCompanyById(session.companyId);
  if (!company || company.isDeleted) throw new Error("Entreprise indisponible.");
  stopBackgroundSync();
  getSocket()?.disconnect();
  closeAppNotifications("WARNING");
  await clearToken();
  if (token) await saveToken(token);
  await saveLocalSession(session);
  setActiveCompanyStorage(storage);
  const window = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed() && candidate.isVisible());
  if (window && token) await createSocket(window);
  startBackgroundSync(session.companyId);
  });
}

export async function initializeAuthenticatedCompany(company: Company, selectedCompanyId?: string): Promise<void> {
  if (!company?.companyId || company.isDeleted || (selectedCompanyId && selectedCompanyId !== company.companyId)) {
    throw new Error("L’entreprise ne correspond pas à la sélection.");
  }
  const storage = createCompanyStorage(company.name, company.companyId);
  await ensureCompanyDatabase(storage);
  await withCompanyStorage(storage, () => upsertCompanyId(company));
}

export async function endCompanySession(): Promise<void> {
  stopBackgroundSync();
  getSocket()?.disconnect();
  closeAppNotifications("WARNING");
  await clearToken();
  setActiveCompanyStorage(null);
}

export async function findOfflineCompanyUser(email: string, companyId?: string): Promise<OfflineUser | null> {
  const candidates = companyId ? [findCompanyStorage(companyId)].filter((storage) => storage !== undefined) : listCompanyStorage();
  const matches: OfflineUser[] = [];
  for (const storage of candidates) {
    await ensureCompanyDatabase(storage);
    const user = await withCompanyStorage(storage, () => getOfflineUserByEmail(email, storage.companyId));
    if (user) matches.push(user);
  }
  return matches.length === 1 ? matches[0] : null;
}
