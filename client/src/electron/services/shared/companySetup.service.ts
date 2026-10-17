import { app } from "electron";
import axios from "axios";
import bcrypt from "bcrypt";
import { z } from "zod";
import type {
  CompanySetupCredentials,
  CompanySetupResult,
} from "../../../common/types/shared/Credentials.js";
import { NetworkService } from "./sync/network.service.js";
import {
  initializeAuthenticatedCompany,
  establishCompanySession,
} from "./companySession.service.js";
import { createOrUpdateOfflineUser } from "../../database/repositories/shared/offline_users.repository.js";
import {
  findCompanyStorage,
  withCompanyStorage,
} from "../../storage/companyStorage.js";

export const companySetupCredentialsSchema = z
  .object({
    email: z.string().trim().email().max(255),
    password: z.string().min(1).max(255),
    signUpCode: z.string().trim().min(1).max(255),
  })
  .strict();

const responseSchema = z.object({
  admin: z.object({
    _id: z.string().min(1),
    companyId: z.string().min(1),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    role: z.literal("MANAGER"),
    notes: z.string().nullish(),
  }),
  company: z
    .object({
      _id: z.string(),
      companyId: z.string().min(1),
      name: z.string().min(1),
      legalName: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      serverVersion: z.number(),
      isDeleted: z.literal(0),
    })
    .passthrough(),
});

export async function setupCompany(
  credentials: CompanySetupCredentials
): Promise<CompanySetupResult> {
  const parsed = companySetupCredentialsSchema.parse(credentials);
  if (!(await NetworkService.canReachBackend())) {
    throw new Error(
      "Connexion au serveur requise pour configurer l’entreprise."
    );
  }
  const apiUrl = app.isPackaged
    ? "https://leather-works.onrender.com"
    : process.env.VITE_API_URL;
  let response;
  try {
    response = await axios.post(`${apiUrl}/auth/setup`, parsed);
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      [400, 403, 404].includes(error.response?.status ?? 0)
    ) {
      throw new Error(
        "Code d’accès ou identifiants administrateur invalides.",
        { cause: error }
      );
    }
    throw new Error("Impossible de joindre le serveur. Veuillez réessayer.", {
      cause: error,
    });
  }
  const { admin, company } = responseSchema.parse(response.data);
  const token: unknown = response.headers["x-auth-token"];
  if (
    typeof token !== "string" ||
    !token ||
    admin.companyId !== company.companyId
  ) {
    throw new Error("Réponse d’authentification invalide.");
  }
  const password = await bcrypt.hash(parsed.password, 12);
  await initializeAuthenticatedCompany({ ...company, synced: 1 });
  const storage = findCompanyStorage(company.companyId);
  if (!storage) throw new Error("Stockage de l’entreprise indisponible.");
  await withCompanyStorage(storage, () =>
    createOrUpdateOfflineUser({
      ...admin,
      notes: admin.notes ?? "",
      password,
      lastVerifiedAt: new Date().toISOString(),
    })
  );
  await establishCompanySession(admin, token);
  return { admin: { ...admin, notes: admin.notes ?? "" }, company };
}
