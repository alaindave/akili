import type { AuditEvent } from "./AuditEvent.js";

/**
 * An event prepared for an upload batch.
 *
 * Keep the original event ID so retries remain idempotent.
 */
export interface AuditSyncBatch {
  batchId: string;
  companyId: string;
  events: AuditEvent[];
}

/**
 * Server acknowledgment for an individual event.
 *
 * An event is marked synchronized only after its persistence
 * has been confirmed by the server.
 */
export interface AuditSyncAcknowledgment {
  eventId: string;
  status: "ACCEPTED" | "ALREADY_EXISTS" | "REJECTED";
  errorCode?: string;
}

/**
 * Result of uploading a batch.
 *
 * Individual outcomes allow partial failures without falsely
 * marking the entire batch as synchronized.
 */
export interface AuditSyncResult {
  batchId: string;
  acknowledgments: AuditSyncAcknowledgment[];
}
