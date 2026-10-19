import type { AuditEvent } from "./AuditEvent.js";
import type {
  AuditEntityHistoryFilter,
  AuditSearchFilter,
  AuditSearchResult,
} from "./AuditQuery.js";

/** Opaque transaction context owned by the persistence layer. */
export type AuditTransactionContext = unknown;

/**
 * Persistence contract for the audit service.
 * Implementations must honor supplied transactions, use parameterized queries,
 * and enforce company scoping.
 */
export interface AuditRepositoryPort {
  insert(event: AuditEvent, transaction?: AuditTransactionContext): Promise<void>;
  search(filter: AuditSearchFilter): Promise<AuditSearchResult>;
  getEntityHistory(filter: AuditEntityHistoryFilter): Promise<AuditSearchResult>;
}
