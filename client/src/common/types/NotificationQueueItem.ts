import type {
  EmailAttachment,
  EmailNotificationType,
} from "./EmailNotification.js";

export type NotificationQueueStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "FAILED";

export default interface NotificationQueueItem {
  queueId: string;
  companyId: string;
  type: EmailNotificationType;
  recipientEmail: string;
  title: string;
  message: string;
  attachments: EmailAttachment[];
  entityId?: string | null;
  status: NotificationQueueStatus;
  attempts: number;
  lastAttemptAt?: string | null;
  nextAttemptAt?: string | null;
  sentAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}
