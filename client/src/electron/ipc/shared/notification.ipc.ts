import { ipcMain } from "electron";
import {
  scheduleReminder,
  cancelReminder,
  cancelAllReminders,
} from "../../services/notification/reminder.service.js";

export function registerNotificationIPC(): void {
  console.log("REGISTERING NOTIFICATION IPC");
  ipcMain.handle(
    "notifications:schedule-reminder",
    async (_event, message: string, remindAt: string) => {
      try {
        if (!message?.trim()) {
          return {
            success: false,
            message: "Reminder message cannot be empty.",
          };
        }

        const date = new Date(remindAt);

        if (Number.isNaN(date.getTime())) {
          return {
            success: false,
            message: "Invalid reminder date.",
          };
        }

        if (date.getTime() <= Date.now()) {
          return {
            success: false,
            message: "Reminder time must be in the future.",
          };
        }

        const reminder = scheduleReminder(message.trim(), date);

        return {
          success: true,
          reminder,
        };
      } catch (error) {
        console.error("Failed to schedule reminder:", error);

        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to schedule reminder.",
        };
      }
    }
  );

  ipcMain.handle(
    "notifications:cancel-reminder",
    async (_event, id: string) => {
      try {
        return {
          success: cancelReminder(id),
        };
      } catch (error) {
        console.error("Failed to cancel reminder:", error);

        return {
          success: false,
        };
      }
    }
  );

  ipcMain.handle("notifications:cancel-all-reminders", async () => {
    try {
      cancelAllReminders();

      return {
        success: true,
      };
    } catch (error) {
      console.error("Failed to cancel reminders:", error);

      return {
        success: false,
      };
    }
  });
}
