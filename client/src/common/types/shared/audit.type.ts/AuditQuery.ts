import type { AuditAction, AuditModule, AuditOutcome, AuditSeverity, AuditSyncStatus } from "./AuditConstants.js";
import type { AuditEvent } from "./AuditEvent.js";

/**
 * Filters for searching audit history.
 *
 * Company scope is mandatory. Implementations should enforce maximum
 * page sizes and validate date ranges before querying storage.
 */
export interface AuditSearchFilter {
  companyId: string;

  module?: AuditModule;
  action?: AuditAction;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  outcome?: AuditOutcome;
  severity?: AuditSeverity;
  syncStatus?: AuditSyncStatus;

  from?: string;
  to?: string;

  /** Maximum number of records to return. */
  limit?: number;

  /**
   * Opaque pagination cursor.
   * Its format is owned by the query implementation.
   */
  cursor?: string;
}

/**
 * Standard paginated query result.
 */
export interface AuditSearchResult {
  items: AuditEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Parameters for retrieving the history of one business record.
 */
export interface AuditEntityHistoryFilter {
  companyId: string;
  entityType: string;
  entityId: string;
  limit?: number;
  cursor?: string;
}
