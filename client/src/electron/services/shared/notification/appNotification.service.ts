import { Notification } from "electron";
import type { AppNotification } from "../../../../common/types/notifications/AppNotification.js";
import { emitNotification } from "../../../ipc/shared/notification_emitter.ipc.js";

const active = new Map<string, { notification: Notification; type: AppNotification["type"] }>();
const delivered = new Set<string>();

export function showAppNotification(item: AppNotification): void {
  if (delivered.has(item._id)) return;
  delivered.add(item._id);
  emitNotification(item);
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: `${item.title} - Akili`, body: item.message, silent: false,
    urgency: item.type === "REMINDER" ? "critical" : "normal",
    timeoutType: item.type === "REMINDER" ? "never" : "default",
  });
  active.set(item._id, { notification, type: item.type });
  notification.on("close", () => active.delete(item._id));
  notification.show();
}

export function closeAppNotification(id: string): boolean {
  const entry = active.get(id);
  if (!entry) return false;
  entry.notification.close();
  active.delete(id);
  return true;
}

export function closeAppNotifications(type?: AppNotification["type"]): void {
  for (const [id, entry] of active) {
    if (!type || entry.type === type) closeAppNotification(id);
  }
}
