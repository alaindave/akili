import type { AuditAction, AuditActorType, AuditModule, AuditOutcome, AuditSeverity, AuditSource, AuditSyncStatus } from "./AuditConstants.js";
import type { AuditChange } from "./AuditChange.js";

/**
 * Complete persisted audit event.
 *
 * An event describes an action that occurred. Its business facts
 * should not be rewritten after creation.
 *
 * Synchronization metadata may be maintained separately in storage
 * to preserve append-only event semantics.
 */
export interface AuditEvent {
  /** Globally unique, stable event identifier. */
  id: string;

  /** Company that owns the operation. */
  companyId: string;

  /** Authenticated user ID, or null for a system actor. */
  actorId: string | null;

  /** Type of actor responsible for the action. */
  actorType: AuditActorType;

  /** Module in which the action occurred. */
  module: AuditModule;

  /** Standardized action code. */
  action: AuditAction;

  /** Stable entity type, e.g. EMPLOYEE or PURCHASE_ORDER. */
  entityType: string;

  /** Identifier of the affected entity. */
  entityId: string;

  /** Human-readable description; French is recommended for Akili. */
  description: string;

  /** Outcome of the operation. */
  outcome: AuditOutcome;

  /** Importance of the event. */
  severity: AuditSeverity;

  /** Optional reason, justification, or rejection explanation. */
  reason?: string;

  /** Allowlisted field-level changes. */
  changes?: AuditChange[];

  /**
   * Links events belonging to one larger business operation.
   */
  correlationId: string;

  /** Trusted origin of the event. */
  source: AuditSource;

  /**
   * Time the event occurred, in UTC ISO 8601 format.
   * Preserve this timestamp when synchronizing offline events.
   */
  occurredAt: string;

  /** Time the event was recorded in the current store, in UTC ISO 8601. */
  recordedAt: string;

  /** Current delivery state to the backend. */
  syncStatus: AuditSyncStatus;

  /** Time the backend acknowledged persistence, if synchronized. */
  syncedAt?: string;
}
