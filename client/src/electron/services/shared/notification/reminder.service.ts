import crypto from "crypto";
import { showAppNotification, closeAppNotification, closeAppNotifications } from "./appNotification.service.js";

export interface Reminder {
  _id: string;
  message: string;
  remindAt: string;
}

const reminders = new Map<string, NodeJS.Timeout>();


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

    showAppNotification({
      _id,
      title: "Rappel",
      message: cleanMessage,
      type: "REMINDER",
      createdAt: new Date().toISOString(),
      remindAt: remindAt.toISOString(),
    });

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
  return closeAppNotification(id);
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
  closeAppNotifications("REMINDER");
}
