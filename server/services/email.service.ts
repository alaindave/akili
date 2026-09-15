import { Resend } from "resend";

export type EmailNotificationType = "attendance" | "leave" | "payroll" | "task";

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
}

export interface EmailNotificationRequest {
  type: EmailNotificationType;
  companyId: string;
  recipientEmail: string;
  title: string;
  message: string;
  attachments?: EmailAttachment[];
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
  const errors: string[] = [];

  if (
    !notification ||
    !["attendance", "leave", "payroll", "task"].includes(notification.type)
  ) {
    errors.push("Unsupported notification type.");
  }

  if (!notification?.companyId?.trim()) {
    errors.push("Company ID is required.");
  }

  if (!notification?.recipientEmail?.trim()) {
    errors.push("Recipient email is required.");
  } else if (!EMAIL_PATTERN.test(notification.recipientEmail.trim())) {
    errors.push("Recipient email is invalid.");
  }

  if (!notification?.title?.trim()) {
    errors.push("Email title is required.");
  }

  if (!notification?.message?.trim()) {
    errors.push("Email message is required.");
  }

  if (
    notification?.attachments?.some(
      (attachment) =>
        !attachment?.filename?.trim() ||
        !attachment?.content?.trim() ||
        (attachment.contentType !== undefined && !attachment.contentType.trim())
    )
  ) {
    errors.push("Email attachments must include a filename and content.");
  }

  return errors;
}

/**
 * Sends a notification through Resend.
 *
 * RESEND_API_KEY never reaches Electron.
 */
export async function sendEmailNotification(
  notification: EmailNotificationRequest
): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY must be configured.");
  }

  if (!from) {
    throw new Error("RESEND_FROM_EMAIL must be configured.");
  }

  const recipientEmail = notification.recipientEmail.trim();

  if (!EMAIL_PATTERN.test(recipientEmail)) {
    throw new Error("Recipient email is invalid.");
  }

  const validationErrors = validateEmailNotification(notification);

  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(" "));
  }

  const result = await new Resend(apiKey).emails.send({
    from,
    to: recipientEmail,
    subject: notification.title.trim(),
    text: notification.message.trim(),
    html: `<main style="font-family:Arial,sans-serif;padding:20px">
      <h2>${escapeHtml(notification.title.trim())}</h2>
      <p style="white-space:pre-line;font-size:15px">${escapeHtml(
        notification.message.trim()
      )}</p>
    </main>`,
    attachments: notification.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    success: true,
    id: result.data?.id,
  };
}
