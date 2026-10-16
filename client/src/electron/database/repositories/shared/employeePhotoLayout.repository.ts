import { all, get, run, transaction } from "../../db.js";
import type Employee from "../../../../common/types/hr/employees/Employee.js";
import { addToSyncQueue } from "./sync.repository.js";

export const photoTransaction = transaction;
const cleanupKey = "storage.employee-photo-cleanup.v1";
export interface PhotoCleanup { source: string; hash: string }

export function listPhotoEmployees(companyId: string): Promise<Employee[]> {
  return all<Employee>("SELECT * FROM employees WHERE companyId = ?", [companyId]);
}

export async function getPhotoCleanup(): Promise<PhotoCleanup[]> {
  const row = await get<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", [cleanupKey]);
  return row ? JSON.parse(row.value) as PhotoCleanup[] : [];
}

export async function setPhotoCleanup(entries: PhotoCleanup[]): Promise<void> {
  await run("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [cleanupKey, JSON.stringify(entries)]);
}

export async function renamePhotoReferences(companyId: string, employeeId: string, filename: string): Promise<void> {
  await run("UPDATE employees SET photo_path = ?, photo_filename = ? WHERE companyId = ? AND _id = ?",
    [filename, filename, companyId, employeeId]);
  const queue = await all<{ _id: string; payload: string }>(
    "SELECT _id, payload FROM sync_queue WHERE companyId = ? AND entityId = ? AND entity IN ('employee', 'employee_photo')",
    [companyId, employeeId]);
  for (const row of queue) {
    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    if (!payload.photo_path) continue;
    payload.photo_path = filename;
    payload.photo_filename = filename;
    await run("UPDATE sync_queue SET payload = ? WHERE companyId = ? AND _id = ?", [JSON.stringify(payload), companyId, row._id]);
  }
}

export async function saveUploadedPhoto(employee: Employee, filename: string, hash: string, mimeType: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const version = (employee.photo_version ?? 0) + 1;
  await run(`UPDATE employees SET photo_filename = ?, photo_path = ?, photo_version = ?, photo_hash = ?,
    photo_last_modified = ?, photo_mime_type = ?, photo_needs_upload = 1, updatedAt = ? WHERE companyId = ? AND _id = ?`,
  [filename, filename, version, hash, timestamp, mimeType, timestamp, employee.companyId, employee._id]);
  await addToSyncQueue({ companyId: employee.companyId, entity: "employee_photo", entityId: employee._id,
    operation: "update", payload: JSON.stringify({ companyId: employee.companyId, employeeId: employee._id,
      photo_filename: filename, photo_path: filename, photo_version: version, photo_hash: hash,
      photo_last_modified: timestamp, photo_mime_type: mimeType, updatedAt: timestamp }) });
}
