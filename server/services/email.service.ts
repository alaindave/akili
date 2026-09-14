import { Resend } from "resend";

export type EmailNotificationType = "attendance" | "leave" | "payroll" | "task";

export interface EmailNotificationRequest {
  type: EmailNotificationType;
  companyId: string;
  to: string | string[];
  replyTo?: string;
  title: string;
  message: string;
  entityId?: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  id?: string;
  error?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function validateEmailNotification(
  notification: EmailNotificationRequest
): string[] {
  if (!notification || !["attendance", "leave", "payroll", "task"].includes(notification.type)) {
    throw new Error("Unsupported notification type.");
  }

  if (!notification.companyId?.trim()) {
    throw new Error("Company ID is required.");
  }

  const recipients = (Array.isArray(notification.to) ? notification.to : [notification.to])
    .map((email) => email.trim())
    .filter(Boolean);

  if (recipients.length === 0 || recipients.some((email) => !EMAIL_PATTERN.test(email))) {
    throw new Error("At least one valid recipient email is required.");
  }

  if (!notification.title?.trim() || !notification.message?.trim()) {
    throw new Error("Email title and message are required.");
  }

  return recipients;
}

/** Sends a notification through Resend. RESEND_API_KEY never reaches Electron. */
export async function sendEmailNotification(
  notification: EmailNotificationRequest
): Promise<EmailDeliveryResult> {
  const recipients = validateEmailNotification(notification);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured.");
  }

  const result = await new Resend(apiKey).emails.send({
    from,
    to: recipients,
    replyTo: notification.replyTo,
    subject: notification.title.trim(),
    text: notification.message.trim(),
    html: `<main style="font-family:Arial,sans-serif;padding:20px"><h2>${escapeHtml(notification.title.trim())}</h2><p style="white-space:pre-line">${escapeHtml(notification.message.trim())}</p><p style="color:#6b7280;font-size:12px">Notification: ${escapeHtml(notification.type)}</p></main>`,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return { success: true, id: result.data?.id };
}
