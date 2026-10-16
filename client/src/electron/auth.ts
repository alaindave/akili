import keytar from "keytar";
import { z } from "zod";

const SERVICE = "Afritan";
const ACCOUNT = "auth-token";
const LOCAL_SESSION_ACCOUNT = "local-auth-session";
const localIdentitySchema = z.object({
  _id: z.string().trim().min(1),
  companyId: z.string().trim().min(1),
  role: z.enum(["ADMIN", "MANAGER", "VIEWER"]),
});

// Only call after server authentication or successful local password verification.
export async function saveLocalSession(identity: unknown): Promise<void> {
  const session = localIdentitySchema.parse(identity);
  await keytar.setPassword(SERVICE, LOCAL_SESSION_ACCOUNT, JSON.stringify(session));
}

export async function requireLocalIdentity(companyId: string) {
  if (typeof companyId !== "string" || !companyId.trim()) {
    throw new Error("Company ID is required.");
  }
  const stored = await keytar.getPassword(SERVICE, LOCAL_SESSION_ACCOUNT);
  let identity;
  if (stored) {
    identity = localIdentitySchema.parse(JSON.parse(stored));
  } else {
    // Preserve existing installations with a still-valid saved server login.
    // An expired token alone never establishes an offline session.
    const token = await getToken();
    if (!token) throw new Error("Authentication required.");
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some((part) => !part)) {
      throw new Error("Invalid authentication token.");
    }
    identity = localIdentitySchema.extend({
      exp: z.number().finite().gt(Date.now() / 1000).optional(),
    }).parse(JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")));
  }
  if (identity.companyId !== companyId.trim()) {
    throw new Error("Access denied for this company.");
  }
  return identity;
}

export async function saveToken(token: string) {
  await keytar.setPassword(SERVICE, ACCOUNT, token);
}

export async function getToken(companyId?: string) {
  const token = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!token || !companyId) return token;
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return claims.companyId === companyId ? token : null;
  } catch {
    return null;
  }
}

export async function getActiveCompanyId(): Promise<string | null> {
  const stored = await keytar.getPassword(SERVICE, LOCAL_SESSION_ACCOUNT);
  if (stored) return localIdentitySchema.parse(JSON.parse(stored)).companyId;
  const token = await getToken();
  if (!token) return null;
  try {
    return localIdentitySchema.parse(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))).companyId;
  } catch {
    return null;
  }
}

export async function clearToken() {
  // Attempt both removals even if the credential store rejects one.
  await Promise.all([
    keytar.deletePassword(SERVICE, LOCAL_SESSION_ACCOUNT),
    keytar.deletePassword(SERVICE, ACCOUNT),
  ]);
}
