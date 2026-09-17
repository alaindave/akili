import { Notification } from "electron";
import crypto from "crypto";
import { emitNotification } from "../../ipc/notification_emitter.ipc.js";

export interface Reminder {
  _id: string;
  message: string;
  remindAt: string;
}

const reminders = new Map<string, NodeJS.Timeout>();

// Keep native Electron notifications alive while they exist.
const activeNotifications = new Map<string, Notification>();

export function scheduleReminder(message: string, remindAt: Date): Reminder {
  if (!message.trim()) {
    throw new Error("Reminder message cannot be empty");
  }

  const _id = crypto.randomUUID();

  const delay = remindAt.getTime() - Date.now();

  if (delay <= 0) {
    throw new Error("Reminder time must be in the future");
  }

  const timeout = setTimeout(() => {
    reminders.delete(_id);

    const cleanMessage = message.trim();

    /*
     * ---------------------------------------------------------
     * 1. SEND PERSISTENT IN-APP NOTIFICATION
     * ---------------------------------------------------------
     */

    emitNotification({
      _id,
      title: "Rappel",
      message: cleanMessage,
      type: "REMINDER",
      createdAt: new Date().toISOString(),
      remindAt: remindAt.toISOString(),
    });

    /*
     * ---------------------------------------------------------
     * 2. SHOW NATIVE ELECTRON NOTIFICATION
     * ---------------------------------------------------------
     */

    const notification = new Notification({
      title: "Rappel - Akili",
      body: cleanMessage,
      silent: false,
      urgency: "critical",
      timeoutType: "never",
    });

    activeNotifications.set(_id, notification);

    notification.on("close", () => {
      activeNotifications.delete(_id);
    });

    notification.show();
  }, delay);

  reminders.set(_id, timeout);

  return {
    _id,
    message: message.trim(),
    remindAt: remindAt.toISOString(),
  };
}

export function cancelReminder(id: string): boolean {
  /*
   * Reminder hasn't fired yet.
   */
  const timeout = reminders.get(id);

  if (timeout) {
    clearTimeout(timeout);
    reminders.delete(id);

    return true;
  }

  /*
   * Native notification is currently showing.
   */
  const notification = activeNotifications.get(id);

  if (notification) {
    notification.close();
    activeNotifications.delete(id);

    return true;
  }

  return false;
}

export function cancelAllReminders(): void {
  /*
   * Cancel reminders that haven't fired.
   */
  for (const timeout of reminders.values()) {
    clearTimeout(timeout);
  }

  reminders.clear();

  /*
   * Close native notifications.
   */
  for (const notification of activeNotifications.values()) {
    notification.close();
  }

  activeNotifications.clear();
}
