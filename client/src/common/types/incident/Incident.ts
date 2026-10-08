import type { AppModule } from "../task/Task.js";

export interface IncidentInput {
  module: AppModule;
  reporterName: string;
  reporterContact: string;
  occurredAt: string;
  location: string;
  notes: string;
  preventiveActions: string;
  remedialActions: string;
}

export interface Incident extends IncidentInput {
  companyId: string;
  _id: string;
  incidentNumber: string;
  createdAt: string;
  updatedAt: string;
  serverVersion: number;
  synced: number;
  lastSyncedAt: string | null;
  isDeleted: number;
}

export interface IncidentFilters {
  module?: AppModule;
  search?: string;
  location?: string;
  from?: string;
  to?: string;
}

export interface IncidentApi {
  addNote(companyId: string, id: string, note: string, authorId: string): Promise<Incident>;
  create(companyId: string, input: IncidentInput): Promise<Incident>;
  update(
    companyId: string,
    id: string,
    input: IncidentInput
  ): Promise<Incident>;
  getAll(companyId: string, filters?: IncidentFilters): Promise<Incident[]>;
  getById(companyId: string, id: string, module?: AppModule): Promise<Incident | null>;
  getLocations(companyId: string, module?: AppModule): Promise<string[]>;
}
