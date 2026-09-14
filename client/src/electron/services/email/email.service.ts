import axios from "axios";
import { app } from "electron";
import { getToken } from "../../auth.js";
import type {
  EmailDeliveryResult,
  EmailNotification,
} from "../../../common/types/EmailNotification.js";

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
  : process.env.VITE_API_URL;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates notification requests before they leave the desktop application. */
export async function sendNotificationEmail(
  notification: EmailNotification
): Promise<EmailDeliveryResult> {
  if (!notification.companyId?.trim()) {
    throw new Error("Company ID is required.");
  }

  if (!notification.recipientEmail?.trim()) {
    throw new Error("Recipient email is required.");
  }

  if (!EMAIL_PATTERN.test(notification.recipientEmail.trim())) {
    throw new Error("Recipient email is invalid.");
  }

  if (!notification.title?.trim()) {
    throw new Error("Email title is required.");
  }

  if (!notification.message?.trim()) {
    throw new Error("Email message is required.");
  }

  return postEmailNotification({
    ...notification,
    companyId: notification.companyId.trim(),
    recipientEmail: notification.recipientEmail.trim(),
    title: notification.title.trim(),
    message: notification.message.trim(),
  });
}

/** Sends the validated notification to the authenticated cloud email endpoint. */
async function postEmailNotification(
  notification: EmailNotification
): Promise<EmailDeliveryResult> {
  if (!API_URL) {
    throw new Error("VITE_API_URL is not configured");
  }

  const token = await getToken();

  if (!token) {
    throw new Error("You must be signed in to send email notifications.");
  }

  const response = await axios.post<EmailDeliveryResult>(
    `${API_URL}/notifications/email`,
    notification,
    {
      timeout: 15_000,
      headers: {
        "x-auth-token": token,
      },
    }
  );

  return response.data;
}
