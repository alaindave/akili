import path from "node:path";
import { validateStorageCompany } from "../../storage/companyStorage.js";
import { getEmployeeDocumentsDir } from "../../storage/directories.js";

export function resolveEmployeeDocumentPath(companyId: string, localPath: string): string {
  validateStorageCompany(companyId);
  if (typeof localPath !== "string" || !localPath) throw new Error("Employee document path is empty");
  let normalized = localPath.replace(/\\/g, "/");
  if (normalized.startsWith("employees_documents/")) normalized = normalized.slice("employees_documents/".length);
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized) || normalized.split("/").some(part => part === "..")) {
    throw new Error("Employee document path is outside company storage");
  }
  const root = path.resolve(getEmployeeDocumentsDir());
  const result = path.resolve(root, normalized);
  if (result === root) throw new Error("Employee document file path is required");
  return result;
}
