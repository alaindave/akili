import { getSetting, setSetting } from "../../shared/settings.repository.js";
import { getAdminUsersById } from "../../shared/admin_users.repository.js";

export async function requireAttendanceAdmin(companyId: string, userId: string) {
  const user = await getAdminUsersById(companyId, userId);
  if (!user || user.isDeleted || !["ADMIN", "MANAGER"].includes(user.role)) {
    throw new Error("Accès réservé aux administrateurs et gestionnaires.");
  }
}

export async function getAttendanceClockIn(companyId: string): Promise<string> {
  if (!companyId) throw new Error("Entreprise requise.");
  return (await getSetting(`attendance.clockIn.${companyId}`)) ?? "08:00";
}

export async function saveAttendanceClockIn(companyId: string, userId: string, time: string) {
  await requireAttendanceAdmin(companyId, userId);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Heure invalide.");
  await setSetting(`attendance.clockIn.${companyId}`, time);
  return time;
}
