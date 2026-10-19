import type { AuditAction, AuditActorType, AuditModule, AuditOutcome, AuditSeverity, AuditSource } from "./AuditConstants.js";
import type { AuditChange } from "./AuditChange.js";

/**
 * Input accepted by the audit service.
 *
 * The service generates the event ID and timestamps and determines
 * synchronization metadata. Actor identity and company scope must
 * be resolved or verified through trusted application context.
 */
export interface AuditRecordInput {
  companyId: string;

  actorId: string | null;
  actorType: AuditActorType;

  module: AuditModule;
  action: AuditAction;

  entityType: string;
  entityId: string;

  description: string;
  outcome: AuditOutcome;
  severity: AuditSeverity;

  reason?: string;
  changes?: AuditChange[];

  correlationId: string;

  /**
   * Normally set by trusted service code.
   * Do not trust renderer input to establish event provenance.
   */
  source: AuditSource;

  /** Optional for importing or recording a previously occurred event. */
  occurredAt?: string;
}

/**
 * Data supplied when a trusted backend creates its own event.
 *
 * Backend code must still establish actor identity, company scope,
 * event provenance, and timestamps from trusted context.
 */
export type AuditBackendRecordInput = Omit<
  AuditRecordInput,
  "source"
> & {
  source: "BACKEND";
};
