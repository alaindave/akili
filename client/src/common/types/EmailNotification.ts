export type EmailNotificationType = "attendance" | "leave" | "payroll" | "task";

export interface EmailNotification {
  /** The domain event that generated this notification. */
  type: EmailNotificationType;
  /** Tenant boundary, verified against the authenticated user by the API. */
  companyId: string;
  /** One or more intended recipients. */
  // to: string | string[];
  /** Optional reply-to address passed to the email provider. */
  // replyTo?: string;
  /** A short, human-readable summary of the event. */
  title: string;
  /** The notification body. Plain text is converted to safe HTML on the server. */
  message: string;
  /** Local record identifier, useful for delivery tracing. */
  // entityId?: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  id?: string;
  error?: string;
}
