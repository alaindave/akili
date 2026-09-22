import crypto from "crypto";

import type { EmailAttachment } from "../../../../common/types/EmailNotification.js";
import NotificationQueueItem from "../../../../common/types/EmailNotificationQueueItem.js";
import { all, get, runDirect } from "../../db.js";

function generateQueueId(): string {
  return crypto.randomUUID();
}

export interface CreateNotificationQueueInput {
  companyId: string;
  type: NotificationQueueItem["type"];
  recipientEmail: string;
  title: string;
  message: string;
  attachments?: EmailAttachment[];
  entityId?: string | null;
}

type NotificationQueueRow = Omit<NotificationQueueItem, "attachments"> & {
  attachmentsJson?: string | null;
};

function deserializeAttachments(
  attachmentsJson: string | null | undefined
): EmailAttachment[] {
  if (!attachmentsJson) {
    return [];
  }

  try {
    const attachments: unknown = JSON.parse(attachmentsJson);
    return Array.isArray(attachments) ? (attachments as EmailAttachment[]) : [];
  } catch {
    console.error("NOTIFICATION QUEUE: invalid stored attachment payload.");
    return [];
  }
}

function toNotificationQueueItem(
  row: NotificationQueueRow
): NotificationQueueItem {
  const { attachmentsJson, ...item } = row;

  return {
    ...item,
    attachments: deserializeAttachments(attachmentsJson),
  };
}

export async function enqueueNotification(
  input: CreateNotificationQueueInput
): Promise<NotificationQueueItem> {
  const now = new Date().toISOString();

  const item: NotificationQueueItem = {
    queueId: generateQueueId(),

    companyId: input.companyId,

    type: input.type,

    recipientEmail: input.recipientEmail,

    title: input.title,

    message: input.message,

    attachments: input.attachments ?? [],

    entityId: input.entityId ?? null,

    status: "PENDING",

    attempts: 0,

    lastAttemptAt: null,

    nextAttemptAt: now,

    sentAt: null,

    lastError: null,

    createdAt: now,

    updatedAt: now,
  };

  await runDirect(
    `
      INSERT INTO notification_queue (
        queueId,
        companyId,
        type,
        recipientEmail,
        title,
        message,
        attachmentsJson,
        entityId,
        status,
        attempts,
        lastAttemptAt,
        nextAttemptAt,
        sentAt,
        lastError,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      item.queueId,
      item.companyId,
      item.type,
      item.recipientEmail,
      item.title,
      item.message,
      JSON.stringify(item.attachments),
      item.entityId,
      item.status,
      item.attempts,
      item.lastAttemptAt,
      item.nextAttemptAt,
      item.sentAt,
      item.lastError,
      item.createdAt,
      item.updatedAt,
    ]
  );

  return item;
}

export async function getPendingNotifications(
  limit = 20
): Promise<NotificationQueueItem[]> {
  const now = new Date().toISOString();

  const rows = await all<NotificationQueueRow>(
    `
      SELECT *
      FROM notification_queue
      WHERE
        status IN ('PENDING', 'FAILED')
        AND (
          nextAttemptAt IS NULL
          OR nextAttemptAt <= ?
        )
      ORDER BY createdAt ASC
      LIMIT ?
    `,
    [now, limit]
  );

  return rows.map(toNotificationQueueItem);
}

export async function getNotificationById(
  queueId: string
): Promise<NotificationQueueItem | undefined | null> {
  const row = await get<NotificationQueueRow>(
    `
      SELECT *
      FROM notification_queue
      WHERE queueId = ?
      LIMIT 1
    `,
    [queueId]
  );

  return row ? toNotificationQueueItem(row) : row;
}

/** Returns a prior notification for the same domain event, if one exists. */
export async function getNotificationByEntity(
  companyId: string,
  type: NotificationQueueItem["type"],
  entityId: string
): Promise<NotificationQueueItem | undefined | null> {
  const row = await get<NotificationQueueRow>(
    `
      SELECT *
      FROM notification_queue
      WHERE companyId = ?
        AND type = ?
        AND entityId = ?
      ORDER BY createdAt ASC
      LIMIT 1
    `,
    [companyId, type, entityId]
  );

  return row ? toNotificationQueueItem(row) : row;
}

export async function markNotificationProcessing(
  queueId: string
): Promise<void> {
  const now = new Date().toISOString();

  await runDirect(
    `
      UPDATE notification_queue
      SET
        status = 'PROCESSING',
        attempts = attempts + 1,
        lastAttemptAt = ?,
        updatedAt = ?
      WHERE queueId = ?
    `,
    [now, now, queueId]
  );
}

export async function markNotificationSent(queueId: string): Promise<void> {
  const now = new Date().toISOString();

  await runDirect(
    `
      UPDATE notification_queue
      SET
        status = 'SENT',
        sentAt = ?,
        lastError = NULL,
        updatedAt = ?
      WHERE queueId = ?
    `,
    [now, now, queueId]
  );
}

export async function markNotificationFailed(
  queueId: string,
  error: string,
  nextAttemptAt: string
): Promise<void> {
  const now = new Date().toISOString();

  await runDirect(
    `
      UPDATE notification_queue
      SET
        status = 'FAILED',
        lastError = ?,
        nextAttemptAt = ?,
        updatedAt = ?
      WHERE queueId = ?
    `,
    [error, nextAttemptAt, now, queueId]
  );
}

export async function resetProcessingNotifications(): Promise<void> {
  const now = new Date().toISOString();

  await runDirect(
    `
      UPDATE notification_queue
      SET
        status = 'PENDING',
        updatedAt = ?
      WHERE status = 'PROCESSING'
    `,
    [now]
  );
}

export async function deleteSentNotifications(
  olderThan: string
): Promise<void> {
  await runDirect(
    `
      DELETE FROM notification_queue
      WHERE
        status = 'SENT'
        AND sentAt < ?
    `,
    [olderThan]
  );
}
