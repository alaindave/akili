import { addToSyncQueue, notifyPendingChanges } from "./sync.repository.js";
import { generateIncidentNumber } from "../../incidentNumber.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Incident, IncidentFilters, IncidentInput } from "../../../../common/types/incident/Incident.js";
import { all, get, getDirect, run, runDirect, transaction } from "../../db.js";

const companySchema = z.string().trim().min(1).max(200);
const timestamp = z.string().datetime({ offset: true });
const inputSchema = z.object({
  reporterName: z.string().trim().min(1).max(200),
  reporterContact: z.string().trim().min(1).max(300),
  occurredAt: timestamp,
  location: z.string().trim().min(1).max(300),
  notes: z.string().trim().min(1).max(10000),
  preventiveActions: z.string().trim().max(10000),
  remedialActions: z.string().trim().max(10000),
});
const filtersSchema = z.object({
  search: z.string().trim().max(300).optional(),
  location: z.string().trim().max(300).optional(),
  from: timestamp.optional(),
  to: timestamp.optional(),
}).refine((value) => !value.from || !value.to || Date.parse(value.from) <= Date.parse(value.to),
  "La date de fin doit suivre la date de début.");

export async function createIncident(companyId: string, input: IncidentInput): Promise<Incident> {
  const company = companySchema.parse(companyId);
  const data = inputSchema.parse(input);
  const now = new Date();
  const incident: Incident = {
    ...data,
    occurredAt: new Date(data.occurredAt).toISOString(),
    companyId: company,
    _id: randomUUID(),
    incidentNumber: generateIncidentNumber(now),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    serverVersion: 0, synced: 0, lastSyncedAt: null, isDeleted: 0,
  };
  await transaction(async () => {
    await runDirect(`INSERT INTO incidents
      (_id, incidentNumber, companyId, reporterName, reporterContact, occurredAt, location, notes,
        preventiveActions, remedialActions, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      incident._id, incident.incidentNumber, company, incident.reporterName, incident.reporterContact,
      incident.occurredAt, incident.location, incident.notes, incident.preventiveActions,
      incident.remedialActions, incident.createdAt, incident.updatedAt,
    ]);
    await queueIncident(incident, "create");
  });
  await notifyPendingChanges(company);
  return incident;
}

export async function getIncidents(companyId: string, filters: IncidentFilters = {}): Promise<Incident[]> {
  const params: string[] = [companySchema.parse(companyId)];
  const parsed = filtersSchema.parse(filters);
  const conditions = ["companyId = ?", "isDeleted = 0"];
  if (parsed.search) {
    // instr treats %, _ and quotes as literal search characters.
    conditions.push(`(${["incidentNumber", "reporterName", "reporterContact", "location", "notes", "preventiveActions", "remedialActions"]
      .map((column) => `instr(lower(${column}), lower(?)) > 0`).join(" OR ")})`);
    params.push(...Array<string>(7).fill(parsed.search));
  }
  if (parsed.location) {
    conditions.push("location = ?");
    params.push(parsed.location);
  }
  if (parsed.from) {
    conditions.push("occurredAt >= ?");
    params.push(new Date(parsed.from).toISOString());
  }
  if (parsed.to) {
    conditions.push("occurredAt <= ?");
    params.push(new Date(parsed.to).toISOString());
  }
  return all<Incident>(`SELECT * FROM incidents WHERE ${conditions.join(" AND ")}
    ORDER BY occurredAt DESC, createdAt DESC, _id DESC`, params);
}

export async function getIncidentById(companyId: string, id: string): Promise<Incident | null> {
  return get<Incident>("SELECT * FROM incidents WHERE companyId = ? AND _id = ? AND isDeleted = 0",
    [companySchema.parse(companyId), z.string().uuid().parse(id)]);
}

export async function getIncidentLocations(companyId: string): Promise<string[]> {
  const rows = await all<{ location: string }>(
    "SELECT DISTINCT location FROM incidents WHERE companyId = ? AND isDeleted = 0 ORDER BY location COLLATE NOCASE",
    [companySchema.parse(companyId)]);
  return rows.map((row) => row.location);
}

async function queueIncident(incident: Incident, operation: "create" | "update") {
  await addToSyncQueue({
    companyId: incident.companyId, entity: "incident", entityId: incident._id,
    operation, payload: JSON.stringify(incident),
  }, true);
}

export async function updateIncident(companyId: string, id: string, input: IncidentInput): Promise<Incident> {
  const company = companySchema.parse(companyId);
  const incidentId = z.string().uuid().parse(id);
  const data = inputSchema.parse(input);
  const result = await transaction(async () => {
    const existing = await getDirect<Incident>(
      "SELECT * FROM incidents WHERE companyId = ? AND _id = ? AND isDeleted = 0", [company, incidentId]);
    if (!existing) throw new Error("Incident introuvable.");
    const incident: Incident = {
      ...existing, ...data, occurredAt: new Date(data.occurredAt).toISOString(),
      updatedAt: new Date(Math.max(Date.now(), Date.parse(existing.updatedAt) + 1)).toISOString(), synced: 0,
    };
    await runDirect(`UPDATE incidents SET reporterName = ?, reporterContact = ?, occurredAt = ?,
      location = ?, notes = ?, preventiveActions = ?, remedialActions = ?, updatedAt = ?, synced = 0
      WHERE companyId = ? AND _id = ?`, [incident.reporterName, incident.reporterContact,
      incident.occurredAt, incident.location, incident.notes, incident.preventiveActions,
      incident.remedialActions, incident.updatedAt, company, incidentId]);
    await queueIncident(incident, "update");
    return incident;
  });
  await notifyPendingChanges(company);
  return result;
}

// Old local-only reports enter the queue once, including after an interrupted upgrade.
export async function queueExistingIncidents() {
  const companies = await all<{ companyId: string }>("SELECT DISTINCT companyId FROM incidents");
  await transaction(async () => {
    await runDirect(`INSERT INTO sync_queue (companyId, entity, entityId, operation, payload)
      SELECT i.companyId, 'incident', i._id, 'create', json_object(
        '_id', i._id, 'companyId', i.companyId, 'incidentNumber', i.incidentNumber,
        'reporterName', i.reporterName, 'reporterContact', i.reporterContact,
        'occurredAt', i.occurredAt, 'location', i.location, 'notes', i.notes,
        'preventiveActions', i.preventiveActions, 'remedialActions', i.remedialActions,
        'createdAt', i.createdAt, 'updatedAt', i.updatedAt, 'serverVersion', i.serverVersion,
        'isDeleted', i.isDeleted)
      FROM incidents i WHERE i.synced = 0 AND i.serverVersion = 0 AND NOT EXISTS (
        SELECT 1 FROM sync_queue q WHERE q.companyId = i.companyId AND q.entity = 'incident'
          AND q.entityId = i._id)`);
  });
  for (const company of companies) await notifyPendingChanges(company.companyId);
}

// An acknowledgement for an older snapshot must not mark a newer edit as synced.
export async function markIncidentSynced(companyId: string, id: string, updatedAt: string) {
  await run(`UPDATE incidents SET synced = 1, lastSyncedAt = ?
    WHERE companyId = ? AND _id = ? AND updatedAt = ?`,
    [new Date().toISOString(), companyId, id, updatedAt]);
}

export async function upsertIncident(companyId: string, incoming: Incident): Promise<void> {
  const company = companySchema.parse(companyId);
  if (incoming.companyId !== company) throw new Error("Incident company mismatch");
  const data = inputSchema.parse(incoming);
  const id = z.string().uuid().parse(incoming._id);
  const version = z.number().int().positive().parse(incoming.serverVersion);
  const number = z.string().min(1).max(100).parse(incoming.incidentNumber);
  const createdAt = new Date(timestamp.parse(incoming.createdAt)).toISOString();
  const updatedAt = new Date(timestamp.parse(incoming.updatedAt)).toISOString();
  const isDeleted = z.union([z.literal(0), z.literal(1)]).parse(incoming.isDeleted ?? 0);
  await transaction(async () => {
    const existing = await getDirect<Incident>("SELECT * FROM incidents WHERE _id = ?", [id]);
    if (existing && existing.companyId !== company) throw new Error("Incident company mismatch");
    if (existing && existing.serverVersion >= version) return;
    if (existing && !existing.synced) throw new Error("Incident has pending local edits; retry pull after push");
    await runDirect(`INSERT INTO incidents (_id, companyId, incidentNumber, reporterName, reporterContact,
      occurredAt, location, notes, preventiveActions, remedialActions, createdAt, updatedAt,
      serverVersion, synced, lastSyncedAt, isDeleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(_id) DO UPDATE SET
        reporterName = excluded.reporterName, reporterContact = excluded.reporterContact,
        occurredAt = excluded.occurredAt, location = excluded.location, notes = excluded.notes,
        preventiveActions = excluded.preventiveActions, remedialActions = excluded.remedialActions,
        incidentNumber = excluded.incidentNumber, createdAt = excluded.createdAt,
        updatedAt = excluded.updatedAt, serverVersion = excluded.serverVersion,
        synced = 1, lastSyncedAt = excluded.lastSyncedAt, isDeleted = excluded.isDeleted`,
      [id, company, number, data.reporterName, data.reporterContact, new Date(data.occurredAt).toISOString(),
        data.location, data.notes, data.preventiveActions, data.remedialActions, createdAt, updatedAt,
        version, new Date().toISOString(), isDeleted]);
  });
}
