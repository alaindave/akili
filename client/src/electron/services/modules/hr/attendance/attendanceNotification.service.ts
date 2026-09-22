import type { AttendanceDailyCheck } from "../../../../../common/types/attendance/AttendanceDailyCheck.js";
import type NotificationQueueItem from "../../../../../common/types/EmailNotificationQueueItem.js";
import { getCompanyById } from "../../../../database/repositories/shared/companies.repository.js";

import {
  enqueueNotification,
  getNotificationByEntity,
} from "../../../../database/repositories/shared/notificationQueue.repository.js";

import { generateAttendanceReport } from "./attendance_report.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatAttendanceDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00.000Z`)
  );
}

/**
 * Gets the notification email registered for the company.
 *
 * The company email stored in the `companies` table is now
 * the single source of truth for attendance notifications.
 */
async function getManagerEmail(
  dailyCheck: AttendanceDailyCheck
): Promise<string> {
  const company = await getCompanyById(dailyCheck.companyId);

  const email = company?.email?.trim();

  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new Error(
      `Cannot notify attendance manager: no valid company email is configured for ${dailyCheck.date}.`
    );
  }

  return email;
}

/**
 * Queues the appropriate attendance notification for the company email.
 *
 * MANAGER_NOTIFIED:
 *   Asks the company contact to confirm the attendance.
 *
 * LOCKED:
 *   Sends the attendance report and informs the company contact
 *   that the attendance has been locked.
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
        "Veuillez vérifier les présences, les retards et les absences, puis confirmer.",
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
