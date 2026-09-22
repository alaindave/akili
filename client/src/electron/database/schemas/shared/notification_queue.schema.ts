import { all, run } from "../../db.js";

export async function createNotificationTable() {
  await run(`
 CREATE TABLE IF NOT EXISTS notification_queue (
  queueId TEXT PRIMARY KEY,
  companyId TEXT NOT NULL,
  type TEXT NOT NULL,
  recipientEmail TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  attachmentsJson TEXT,
  entityId TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  lastAttemptAt TEXT,
  nextAttemptAt TEXT,
  sentAt TEXT,
  lastError TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_pending
ON notification_queue(status, nextAttemptAt);

CREATE INDEX IF NOT EXISTS idx_notification_queue_company
ON notification_queue(companyId);

CREATE INDEX IF NOT EXISTS idx_notification_queue_entity
ON notification_queue(entityId);
  `);

  const columns = await all<{ name: string }>(
    "PRAGMA table_info(notification_queue)"
  );

  if (!columns.some((column) => column.name === "attachmentsJson")) {
    await run(`
      ALTER TABLE notification_queue
      ADD COLUMN attachmentsJson TEXT
    `);
  }

  console.log("NOTIFICATION QUEUE TABLE INITIALIZED");
}
