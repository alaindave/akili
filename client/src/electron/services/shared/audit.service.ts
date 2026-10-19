/**
 * Akili ERP — Shared Audit Service
 *
 * Reusable audit service for:
 * - HR
 * - Inventory
 * - Procurement
 * - Sales
 * - Production
 * - Accounting
 *
 * Responsibilities:
 * - Validate and normalize audit input.
 * - Generate stable event IDs and timestamps.
 * - Redact common sensitive fields from change details.
 * - Delegate persistence and queries to the audit repository.
 * - Support transaction-aware audit inserts.
 *
 * Important:
 * - This service must run in the trusted Electron main process or backend.
 * - Do not trust actorId or companyId supplied directly by the renderer.
 * - The repository must insert the event using the supplied transaction
 *   when one is provided.
 * - Do not swallow audit persistence errors for critical business operations.
 */

import { randomUUID } from "node:crypto";
import { createAuditLog } from "../../database/repositories/shared/audit_log.repository.js";
import type {
  AuditLog,
  CreateAuditLogInput,
} from "../../../common/types/shared/audit.type.ts/AuditLog.js";
import type { AuditEvent } from "../../../common/types/shared/audit.type.ts/AuditEvent.js";
import type {
  AuditEntityHistoryFilter,
  AuditSearchFilter,
  AuditSearchResult,
} from "../../../common/types/shared/audit.type.ts/AuditQuery.js";
import type { AuditRecordInput } from "../../../common/types/shared/audit.type.ts/AuditRecordInput.js";
import type {
  AuditRepositoryPort,
  AuditTransactionContext,
} from "../../../common/types/shared/audit.type.ts/AuditRepository.js";
import type {
  AuditService as AuditServiceContract,
  AuditServiceOptions,
} from "../../../common/types/shared/audit.type.ts/AuditService.js";

const REDACTED_VALUE = "[REDACTED]";

/**
 * Field names that must not expose sensitive values in audit changes.
 *
 * Add application-specific secrets here as needed.
 */
const SENSITIVE_FIELD_PATTERN =
  /password|passwd|token|secret|authorization|cookie|api.?key|private.?key|credential|refresh.?token|access.?token/i;

/**
 * Basic runtime validation is intentional.
 * TypeScript types alone do not validate runtime input.
 */
function requireNonEmptyString(
  value: unknown,
  fieldName: string
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Audit validation failed: ${fieldName} is required.`);
  }
}

function isAllowedValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): value is T {
  return (
    typeof value === "string" &&
    allowedValues.some((allowedValue) => allowedValue === value)
  );
}

function sanitizeJsonValue(value: unknown, fieldName = ""): unknown {
  if (SENSITIVE_FIELD_PATTERN.test(fieldName)) {
    return REDACTED_VALUE;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>
    )) {
      sanitized[key] = sanitizeJsonValue(nestedValue, key);
    }

    return sanitized;
  }

  // Functions, symbols, undefined and other unsupported values are not
  // meaningful audit JSON values.
  return String(value);
}

/**
 * Service entry point for workflows using the existing audit_logs contract.
 * Preserve actor display names and from/to changes while applying shared
 * validation and redaction. Persistence errors propagate to the transaction.
 */
export async function recordAuditLog(
  input: CreateAuditLogInput,
  withinTransaction = false
): Promise<AuditLog> {
  for (const field of [
    "companyId", "userId", "userName", "action", "entity", "entityId", "description",
  ] as const) {
    requireNonEmptyString(input[field], field);
  }

  const changes = input.changes === undefined ? undefined : Object.fromEntries(
    Object.entries(input.changes).map(([field, change]) => [field, {
      from: sanitizeJsonValue(change.from, field),
      to: sanitizeJsonValue(change.to, field),
    }])
  );

  return createAuditLog({ ...input, changes }, withinTransaction);
}

function sanitizeChanges(
  changes: AuditRecordInput["changes"]
): AuditRecordInput["changes"] {
  if (!changes) {
    return undefined;
  }

  return changes.map((change) => {
    const sanitizedChange: NonNullable<AuditRecordInput["changes"]>[number] = {
      field: change.field,
    };

    if ("before" in change) {
      sanitizedChange.before = sanitizeJsonValue(
        change.before,
        change.field
      ) as typeof change.before;
    }

    if ("after" in change) {
      sanitizedChange.after = sanitizeJsonValue(
        change.after,
        change.field
      ) as typeof change.after;
    }

    return sanitizedChange;
  });
}

function validateRecordInput(input: AuditRecordInput): void {
  requireNonEmptyString(input.companyId, "companyId");
  requireNonEmptyString(input.actorId, "actorId");
  requireNonEmptyString(input.entityType, "entityType");
  requireNonEmptyString(input.entityId, "entityId");
  requireNonEmptyString(input.description, "description");
  requireNonEmptyString(input.correlationId, "correlationId");

  if (
    !isAllowedValue(input.actorType, ["USER", "SYSTEM", "INTEGRATION"] as const)
  ) {
    throw new Error("Audit validation failed: invalid actorType.");
  }

  if (
    !isAllowedValue(input.module, [
      "AUTH",
      "ADMINISTRATION",
      "HR",
      "PAYROLL",
      "INVENTORY",
      "PROCUREMENT",
      "SALES",
      "ACCOUNTING",
      "PRODUCTION",
      "SYSTEM",
    ] as const)
  ) {
    throw new Error("Audit validation failed: invalid module.");
  }

  if (
    !isAllowedValue(input.outcome, ["SUCCESS", "FAILURE", "DENIED"] as const)
  ) {
    throw new Error("Audit validation failed: invalid outcome.");
  }

  if (
    !isAllowedValue(input.severity, ["INFO", "WARNING", "CRITICAL"] as const)
  ) {
    throw new Error("Audit validation failed: invalid severity.");
  }

  if (!isAllowedValue(input.source, ["DESKTOP", "BACKEND"] as const)) {
    throw new Error("Audit validation failed: invalid source.");
  }

  requireNonEmptyString(input.action, "action");

  if (
    input.occurredAt !== undefined &&
    Number.isNaN(Date.parse(input.occurredAt))
  ) {
    throw new Error(
      "Audit validation failed: occurredAt must be a valid date."
    );
  }
}

/**
 * Shared audit service.
 *
 * Instantiate once in the trusted application layer and inject it into
 * module services that need to record audit events.
 */
export class AuditService implements AuditServiceContract {
  private readonly repository: AuditRepositoryPort;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: AuditServiceOptions) {
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  /**
   * Record one audit event.
   *
   * Pass a transaction context for critical business operations so the
   * business change and audit insert commit or roll back together.
   *
   * This method intentionally does not catch repository errors.
   */
  async record(
    input: AuditRecordInput,
    transaction?: AuditTransactionContext
  ): Promise<AuditEvent> {
    validateRecordInput(input);

    const recordedAt = this.now().toISOString();
    const occurredAt = input.occurredAt ?? recordedAt;

    const event: AuditEvent = {
      id: this.createId(),
      companyId: input.companyId,
      actorId: input.actorId,
      actorType: input.actorType,
      module: input.module,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description,
      outcome: input.outcome,
      severity: input.severity,
      correlationId: input.correlationId,
      source: input.source,
      occurredAt,
      recordedAt,
      syncStatus: "PENDING",
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.changes !== undefined
        ? { changes: sanitizeChanges(input.changes) }
        : {}),
    };

    await this.repository.insert(event, transaction);

    return event;
  }

  /**
   * Search audit events.
   *
   * The caller must supply the company context from trusted application
   * state. The repository should enforce company scoping in its SQL.
   */
  async search(filter: AuditSearchFilter): Promise<AuditSearchResult> {
    requireNonEmptyString(filter.companyId, "companyId");

    return this.repository.search(filter);
  }

  /**
   * Retrieve the audit history for one entity.
   *
   * Example: all audit events related to a specific employee,
   * purchase order, stock movement, sales order, or journal entry.
   */
  async getEntityHistory(
    filter: AuditEntityHistoryFilter
  ): Promise<AuditSearchResult> {
    requireNonEmptyString(filter.companyId, "companyId");
    requireNonEmptyString(filter.entityType, "entityType");
    requireNonEmptyString(filter.entityId, "entityId");

    return this.repository.getEntityHistory(filter);
  }
}
