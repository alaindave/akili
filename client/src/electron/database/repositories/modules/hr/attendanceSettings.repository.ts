import { all, get, getDirect, runDirect, transaction } from "../../../db.js";
import { addToSyncQueue, notifyPendingChanges } from "../../shared/sync.repository.js";
import type Company from "../../../../../common/types/Company.js";
import { getAdminUsersById } from "../../shared/admin_users.repository.js";

export async function requireAttendanceAdmin(companyId: string, userId: string) {
  const user = await getAdminUsersById(companyId, userId);
  if (!user || user.isDeleted || !["ADMIN", "MANAGER"].includes(user.role)) {
    throw new Error("Accès réservé aux administrateurs et gestionnaires.");
  }
}

export async function getAttendanceClockIn(companyId: string): Promise<string> {
  if (!companyId) throw new Error("Entreprise requise.");
  const company = await get<Company>(
    "SELECT * FROM companies WHERE companyId = ? AND isDeleted = 0",
    [companyId]
  );
  return company?.attendanceClockIn ?? "08:00";
}

export async function saveAttendanceClockIn(companyId: string, userId: string, time: string) {
  await requireAttendanceAdmin(companyId, userId);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Heure invalide.");
  await persistAttendanceClockIn(companyId, time);
  return time;
}

async function persistAttendanceClockIn(companyId: string, time: string, legacyKey?: string) {
  await transaction(async () => {
    const result = await runDirect(
      `UPDATE companies SET attendanceClockIn = ?, updatedAt = ?, synced = 0
       WHERE companyId = ? AND isDeleted = 0`,
      [time, new Date().toISOString(), companyId]
    );
    if (!result.changes) throw new Error("Entreprise introuvable.");
    const company = await getDirect<Company>(
      "SELECT * FROM companies WHERE companyId = ?", [companyId]
    );
    await addToSyncQueue({
      companyId,
      entity: "company",
      entityId: companyId,
      operation: "update",
      payload: JSON.stringify(company),
    }, true);
    if (legacyKey) await runDirect("DELETE FROM app_settings WHERE key = ?", [legacyKey]);
  });
  await notifyPendingChanges(companyId);
}

// Run after both settings and sync tables exist. Removing the old key makes this restart-safe.
export async function migrateAttendanceClockInSettings() {
  const settings = await all<{ companyId: string; key: string; value: string }>(`
    SELECT c.companyId, s.key, s.value FROM companies c
    JOIN app_settings s ON s.key = 'attendance.clockIn.' || c.companyId
    WHERE c.isDeleted = 0
  `);
  for (const setting of settings) {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(setting.value)) {
      await persistAttendanceClockIn(setting.companyId, setting.value, setting.key);
    }
  }
}
