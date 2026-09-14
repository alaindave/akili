import type {
  EmailDeliveryResult,
  EmailNotification,
} from "../../../common/types/EmailNotification.js";
import { sendEmailNotification } from "../../database/repositories/email.repository.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates notification requests before they leave the desktop application. */
export async function sendNotificationEmail(
  notification: EmailNotification
): Promise<EmailDeliveryResult> {
  if (!notification.companyId?.trim()) {
    throw new Error("Company ID is required.");
  }

  const recipients = (Array.isArray(notification.to)
    ? notification.to
    : [notification.to]
  )
    .map((email) => email.trim())
    .filter(Boolean);

  if (recipients.length === 0 || recipients.some((email) => !EMAIL_PATTERN.test(email))) {
    throw new Error("At least one valid recipient email is required.");
  }

  if (!notification.title.trim() || !notification.message.trim()) {
    throw new Error("Email title and message are required.");
  }

  return sendEmailNotification({
    ...notification,
    to: recipients,
    title: notification.title.trim(),
    message: notification.message.trim(),
  });
}
