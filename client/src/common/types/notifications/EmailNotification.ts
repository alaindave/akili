export type EmailNotificationType = "attendance" | "leave" | "payroll" | "task";

/** A file carried with a queued email notification. Content is base64 encoded. */
export interface EmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
}

export interface EmailNotification {
  /** The domain event that generated this notification. */
  type: EmailNotificationType;

  /** Tenant boundary, verified against the authenticated user by the API. */
  companyId: string;

  /** Email address that should receive the notification. */
  recipientEmail: string;

  /** A short, human-readable summary of the event. */
  title: string;

  /** The notification body. */
  message: string;

  /** Optional files to include in the notification email. */
  attachments?: EmailAttachment[];
}

export interface EmailDeliveryResult {
  success: boolean;
  id?: string;
  error?: string;
}
