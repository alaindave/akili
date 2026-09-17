import type { AttendanceDailyCheck } from "../../../common/types/attendance/AttendanceDailyCheck.js";
import type NotificationQueueItem from "../../../common/types/EmailNotificationQueueItem.js";
import { getAllAdminUsers } from "../../database/repositories/admin_users.repository.js";
import {
  enqueueNotification,
  getNotificationByEntity,
} from "../../database/repositories/notificationQueue.repository.js";
import { generateAttendanceReport } from "./attendance_report.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatAttendanceDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00.000Z`)
  );
}

async function getManagerEmail(
  dailyCheck: AttendanceDailyCheck
): Promise<string> {
  let email = dailyCheck.managerNotifiedTo?.trim();

  if (!email) {
    const adminUsers = await getAllAdminUsers(dailyCheck.companyId);

    const manager = dailyCheck.managerId
      ? adminUsers?.find((user) => user._id === dailyCheck.managerId)
      : adminUsers?.find(
          (user) => user.role === "MANAGER" && user.isDeleted !== 1
        );

    email = manager?.email?.trim();
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new Error(
      `Cannot notify attendance manager: no valid manager email is configured for ${dailyCheck.date}.`
    );
  }

  return email;
}

/**
 * Queues the appropriate attendance notification for the manager.
 *
 * LOCKED:
 *   Sends the attendance report and informs the manager that
 *   the attendance has been locked.
 *
 * MANAGER_NOTIFIED:
 *   Asks the manager to confirm the attendance.
 */
export async function notifyManagerOfAttendanceDailyCheck(
  dailyCheck: AttendanceDailyCheck
): Promise<NotificationQueueItem> {
  if (
    dailyCheck.status !== "LOCKED" &&
    dailyCheck.status !== "MANAGER_NOTIFIED"
  ) {
    throw new Error(
      `Cannot notify the manager: attendance daily check ${dailyCheck._id} ` +
        `has unsupported status "${dailyCheck.status}".`
    );
  }

  const existingNotification = await getNotificationByEntity(
    dailyCheck.companyId,
    "attendance",
    dailyCheck._id
  );

  if (existingNotification) {
    return existingNotification;
  }

  const recipientEmail = await getManagerEmail(dailyCheck);
  const attendanceDate = formatAttendanceDate(dailyCheck.date);

  // ---------------------------------------------------------
  // MANAGER_NOTIFIED
  // ---------------------------------------------------------
  if (dailyCheck.status === "MANAGER_NOTIFIED") {
    const notification = await enqueueNotification({
      companyId: dailyCheck.companyId,
      type: "attendance",
      recipientEmail,
      title: `Confirmation de présence - ${attendanceDate}`,
      message:
        `La liste de présence du ${attendanceDate} est prête pour votre vérification. ` +
        "Veuillez vérifier les présences, les retards et les absences, puis confirmer la liste de présence.",
      entityId: dailyCheck._id,
    });

    console.log("MANAGER ATTENDANCE CONFIRMATION NOTIFICATION QUEUED:", {
      companyId: dailyCheck.companyId,
      attendanceDailyCheckId: dailyCheck._id,
      recipientEmail,
      queueId: notification.queueId,
    });

    return notification;
  }

  // ---------------------------------------------------------
  // LOCKED
  // ---------------------------------------------------------
  const report = await generateAttendanceReport(
    dailyCheck.companyId,
    dailyCheck.date
  );

  const notification = await enqueueNotification({
    companyId: dailyCheck.companyId,
    type: "attendance",
    recipientEmail,
    title: `Présence verrouillée - ${attendanceDate}`,
    message:
      `La liste de présence du ${attendanceDate} ` +
      "a été confirmée et verrouillée. Le rapport de présence est joint à cet e-mail.",
    entityId: dailyCheck._id,
    attachments: [
      {
        filename: report.filename,
        content: report.pdfBuffer.toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });

  console.log("LOCKED ATTENDANCE NOTIFICATION QUEUED:", {
    companyId: dailyCheck.companyId,
    attendanceDailyCheckId: dailyCheck._id,
    recipientEmail,
    queueId: notification.queueId,
  });

  return notification;
}
