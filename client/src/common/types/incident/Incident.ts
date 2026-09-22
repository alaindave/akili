export interface IncidentInput {
  reporterName: string;
  reporterContact: string;
  occurredAt: string;
  location: string;
  notes: string;
  preventiveActions: string;
  remedialActions: string;
}

export interface Incident extends IncidentInput {
  _id: string;
  incidentNumber: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  serverVersion: number;
  synced: number;
  lastSyncedAt: string | null;
  isDeleted: number;
}

export interface IncidentFilters {
  search?: string;
  location?: string;
  from?: string;
  to?: string;
}

export interface IncidentApi {
  create(companyId: string, input: IncidentInput): Promise<Incident>;
  update(companyId: string, id: string, input: IncidentInput): Promise<Incident>;
  getAll(companyId: string, filters?: IncidentFilters): Promise<Incident[]>;
  getById(companyId: string, id: string): Promise<Incident | null>;
  getLocations(companyId: string): Promise<string[]>;
}
