import { all, get, run, transaction } from "../../db.js";
import type Employee from "../../../../common/types/hr/employees/Employee.js";
import type { EmployeeDocument } from "../../../../common/types/hr/employees/EmployeeDocuments.js";

export const documentTransaction = transaction;
const cleanupKey = "storage.employee-document-cleanup.v1";
export interface DocumentCleanup { source: string; hash: string }

export function listDocumentEmployees(companyId: string): Promise<Employee[]> {
  return all<Employee>("SELECT * FROM employees WHERE companyId = ?", [companyId]);
}
export function listLayoutDocuments(companyId: string): Promise<EmployeeDocument[]> {
  return all<EmployeeDocument>("SELECT * FROM employees_documents WHERE companyId = ?", [companyId]);
}
export async function getDocumentCleanup(): Promise<DocumentCleanup[]> {
  const row = await get<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", [cleanupKey]);
  return row ? JSON.parse(row.value) as DocumentCleanup[] : [];
}
export async function setDocumentCleanup(entries: DocumentCleanup[]): Promise<void> {
  await run("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [cleanupKey, JSON.stringify(entries)]);
}
export async function renameDocumentReferences(document: EmployeeDocument, localPath: string, fileName: string): Promise<void> {
  await run("UPDATE employees_documents SET localPath = ?, fileName = ? WHERE companyId = ? AND _id = ?",
    [localPath, fileName, document.companyId, document._id]);
  const queue = await all<{ _id: string; payload: string }>(
    "SELECT _id, payload FROM sync_queue WHERE companyId = ? AND entityId = ? AND entity = 'employee_document'",
    [document.companyId, document._id]);
  for (const row of queue) {
    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    payload.localPath = localPath;
    payload.fileName = fileName;
    await run("UPDATE sync_queue SET payload = ? WHERE companyId = ? AND _id = ?",
      [JSON.stringify(payload), document.companyId, row._id]);
  }
}
