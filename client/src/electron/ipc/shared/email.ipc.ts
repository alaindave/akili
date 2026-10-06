import { ipcMain } from "electron";
import type { EmailNotification } from "../../../common/types/notifications/EmailNotification.js";
import { sendNotificationEmail } from "../../services/shared/email/email.service.js";

export function registerEmailIPC(): void {
  ipcMain.handle("email:send", async (_, notification: EmailNotification) =>
    sendNotificationEmail(notification)
  );
}
