/** A field-level value recorded when an entity is changed. */
export interface AuditChange {
  from: unknown;
  to: unknown;
}

export interface CreateAuditLogInput {
  companyId: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  changes?: Record<string, AuditChange>;
}

export interface AuditLog extends CreateAuditLogInput {
  _id: string;
  createdAt: string;
}
