import { getCompanyFilesRoot, validateStorageCompany } from "./companyStorage.js";

const operations = new Map<string, Promise<unknown>>();
/** Serialize filesystem changes and upload snapshots within one company's media. */
export function withEmployeeMedia<T>(companyId: string, operation: () => Promise<T>): Promise<T> {
  validateStorageCompany(companyId);
  const key = getCompanyFilesRoot();
  const next = (operations.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
  operations.set(key, next);
  void next.finally(() => { if (operations.get(key) === next) operations.delete(key); }).catch(() => {});
  return next;
}
