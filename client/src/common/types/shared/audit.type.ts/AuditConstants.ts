/**
 * Stable identifiers for Akili ERP modules.
 *
 * Use these values in persisted audit events and API payloads.
 */
export const AUDIT_MODULES = [
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
] as const;

export type AuditModule = (typeof AUDIT_MODULES)[number];

/**
 * Standardized business actions.
 *
 * Add new action codes deliberately instead of using inconsistent
 * free-text action names across modules.
 */
export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "ARCHIVE",
  "RESTORE",
  "VIEW",
  "EXPORT",
  "IMPORT",
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "ACCESS_DENIED",
  "SUBMIT",
  "VERIFY",
  "APPROVE",
  "REJECT",
  "CANCEL",
  "POST",
  "UNPOST",
  "PAY",
  "RECEIVE",
  "ISSUE",
  "TRANSFER",
  "ADJUST",
  "REVERSE",
  "RECONCILE",
  "CLOSE",
  "REOPEN",
  "CALCULATE",
  "FINALIZE",
  "SYNC",
  "CONFIGURE",
  "OTHER",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Result of the action being audited.
 */
export const AUDIT_OUTCOMES = [
  "SUCCESS",
  "FAILURE",
  "DENIED",
] as const;

export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

/**
 * Importance of an audit event.
 */
export const AUDIT_SEVERITIES = [
  "INFO",
  "WARNING",
  "CRITICAL",
] as const;

export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

/**
 * Identity category of the actor performing the action.
 */
export const AUDIT_ACTOR_TYPES = [
  "USER",
  "SYSTEM",
  "INTEGRATION",
] as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

/**
 * Origin of the recorded event.
 *
 * BACKEND means the event was created by trusted backend code,
 * not merely submitted with a BACKEND value by the desktop client.
 */
export const AUDIT_SOURCES = [
  "DESKTOP",
  "BACKEND",
] as const;

export type AuditSource = (typeof AUDIT_SOURCES)[number];

/**
 * Local delivery status of an event to the central backend.
 *
 * This is transport metadata, not the outcome of the business action.
 */
export const AUDIT_SYNC_STATUSES = [
  "PENDING",
  "SYNCED",
  "FAILED",
] as const;

export type AuditSyncStatus =
  (typeof AUDIT_SYNC_STATUSES)[number];
