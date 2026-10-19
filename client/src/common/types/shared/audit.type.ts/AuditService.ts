import type { AuditEvent } from "./AuditEvent.js";
import type { AuditRecordInput } from "./AuditRecordInput.js";
import type { AuditRepositoryPort } from "./AuditRepository.js";
import type { AuditEntityHistoryFilter, AuditSearchFilter, AuditSearchResult } from "./AuditQuery.js";

/** Dependencies and optional clock/identifier providers for the audit service. */
export interface AuditServiceOptions {
  repository: AuditRepositoryPort;
  now?: () => Date;
  createId?: () => string;
}

/**
 * Shared audit service contract.
 *
 * Transaction-aware persistence is exposed through a separate
 * internal repository contract, because transaction types depend
 * on the actual SQLite infrastructure.
 */
export interface AuditService {
  record(input: AuditRecordInput): Promise<AuditEvent>;

  getEntityHistory(
    filter: AuditEntityHistoryFilter
  ): Promise<AuditSearchResult>;

  search(
    filter: AuditSearchFilter
  ): Promise<AuditSearchResult>;
}
