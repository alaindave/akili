/**
 * JSON-compatible value permitted in structured audit details.
 *
 * Do not use arbitrary class instances, Buffers, Dates, or other
 * non-serializable objects. Dates should be ISO 8601 strings.
 */
export type AuditJsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type AuditJsonValue =
  | AuditJsonPrimitive
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue };

/**
 * A meaningful field-level change.
 *
 * Only include fields approved by the audit redaction policy.
 * Omit before/after when values are sensitive or unnecessary.
 */
export interface AuditChange {
  field: string;
  before?: AuditJsonValue;
  after?: AuditJsonValue;
}
