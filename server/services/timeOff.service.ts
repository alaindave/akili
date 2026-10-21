import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import * as repo from "../repositories/timeOff.repository.js";
import { getNextSyncVersion } from "../utils/syncVersion.js";
import { TimeOffStatus, type TimeOffRecord, type TimeOffMotifRecord, type TimeOffMotifSnapshot,
  type CreateMotif, type EditMotif, type CreateTimeOff, type EditTimeOff, type RequestFields } from "../types/timeOff.js";
import { TimeOffError, validate, createMotifSchema, editMotifSchema, createRequestSchema, editRequestSchema,
  actionSchema, rejectSchema, notesSchema, reviewSchema, listSchema, periodSchema } from "../validation/timeOff.validation.js";
export interface TimeOffActor { companyId: string; _id: string; role: string }
function reader(actor: TimeOffActor) {
  if (typeof actor.companyId !== "string" || !actor.companyId.trim() || typeof actor._id !== "string" || !actor._id.trim() ||
      !["ADMIN", "MANAGER", "VIEWER"].includes(actor.role)) {
    throw new TimeOffError(401, "UNAUTHORIZED", "Authentification requise.");
  }
}
function writer(actor: TimeOffActor, managerOnly = false) {
  reader(actor);
  if (!actor.companyId || !actor._id) throw new TimeOffError(401, "UNAUTHORIZED", "Authentification requise.");
  if (managerOnly ? actor.role !== "MANAGER" : !["ADMIN", "MANAGER"].includes(actor.role)) {
    throw new TimeOffError(403, "FORBIDDEN", "Vous n’avez pas l’autorisation d’effectuer cette opération.");
  }
}
function checkVersion(actual: number, expected: number) {
  if (actual !== expected) throw new TimeOffError(409, "VERSION_CONFLICT", "Cette fiche a été modifiée. Actualisez-la avant de continuer.");
}
function missing(): never { throw new TimeOffError(404, "NOT_FOUND", "Fiche introuvable dans cette entreprise."); }
function unresolved(): never { throw new TimeOffError(409, "LEGACY_REVIEW_REQUIRED", "Cette demande historique nécessite un rapprochement explicite avant toute modification de sa politique."); }
function dates(value: RequestFields) {
  validate(periodSchema, { startDate: value.startDate, endDate: value.endDate,
    isPartialDay: value.isPartialDay, startTime: value.startTime, endTime: value.endTime });
  if (value.endDate < value.startDate) throw new TimeOffError(400, "INVALID_PERIOD", "La date de fin doit suivre la date de début.");
  if (value.isPartialDay) {
    if (value.startDate !== value.endDate || !value.startTime || !value.endTime || value.startTime >= value.endTime) {
      throw new TimeOffError(400, "INVALID_PARTIAL_DAY", "Une absence partielle nécessite une seule date et des heures de début et de fin valides.");
    }
  } else if (value.startTime || value.endTime) throw new TimeOffError(400, "UNEXPECTED_TIMES", "Les heures sont réservées aux absences partielles.");
}
async function policy(actor: TimeOffActor, employeeId: string, fields: RequestFields, session: ClientSession) {
  dates(fields);
  if (!await repo.getEmployee(actor.companyId, employeeId, session)) missing();
  const motif = await repo.lockActiveMotif(actor.companyId, fields.motifId, session);
  if (!motif) throw new TimeOffError(404, "MOTIF_UNAVAILABLE", "Motif actif introuvable dans cette entreprise.");
  if (motif.requiresJustification && !fields.notes?.trim()) throw new TimeOffError(400, "JUSTIFICATION_REQUIRED", "Une justification est obligatoire pour ce motif.");
  const documents = fields.supportingDocumentIds ?? [];
  if (motif.requiresSupportingDocument && !documents.length) throw new TimeOffError(400, "DOCUMENT_REQUIRED", "Un document justificatif est obligatoire.");
  if (documents.length && await repo.validDocuments(actor.companyId, employeeId, documents, session) !== documents.length) {
    throw new TimeOffError(400, "INVALID_DOCUMENT", "Document justificatif absent, supprimé ou appartenant à un autre employé.");
  }
  return motif;
}
function snapshot(motif: TimeOffMotifRecord): TimeOffMotifSnapshot {
  return { code: motif.code, label: motif.label, category: motif.category, payrollTreatment: motif.payrollTreatment,
    deductFromLeaveBalance: motif.deductFromLeaveBalance };
}
function balanceWeekdays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const totalDays = (Date.parse(`${endDate}T00:00:00Z`) - start.getTime()) / 86400000 + 1;
  let days = Math.floor(totalDays / 7) * 5;
  for (let offset = 0; offset < totalDays % 7; offset++) {
    const weekday = (start.getUTCDay() + offset) % 7;
    if (weekday !== 0 && weekday !== 6) days++;
  }
  return days;
}
async function approval(actor: TimeOffActor, row: RequestFields & { employeeId: string }, motif: TimeOffMotifRecord, session: ClientSession) {
  let days = 0;
  if (motif.deductFromLeaveBalance) {
    if (row.isPartialDay) throw new TimeOffError(409, "PARTIAL_BALANCE_RULE_UNDEFINED", "La règle de déduction du solde pour une journée partielle doit être définie avant approbation.");
    days = balanceWeekdays(row.startDate, row.endDate);
    await repo.adjustBalance(actor.companyId, row.employeeId, -days, session);
  }
  return { status: TimeOffStatus.APPROVED, motifSnapshot: snapshot(motif), approvedBy: actor._id,
    approvedAt: new Date(), balanceDaysDeducted: days };
}
async function current(actor: TimeOffActor, id: string, version: number, session: ClientSession) {
  const row = await repo.getRequest(actor.companyId, id, session);
  if (!row || row.isDeleted) missing();
  checkVersion(row.serverVersion, version);
  return row;
}
async function save(row: TimeOffRecord, changes: Partial<TimeOffRecord>, session: ClientSession) {
  const saved = await repo.updateRequest(row, { ...changes, updatedAt: new Date(), synced: 1,
    serverVersion: await getNextSyncVersion("time_off", session) }, session);
  if (!saved) throw new TimeOffError(409, "VERSION_CONFLICT", "La demande a été modifiée simultanément.");
  return saved;
}
export async function listMotifs(actor: TimeOffActor) { reader(actor); await repo.assertTimeOffReady(); return repo.listMotifs(actor.companyId); }
export async function getMotif(actor: TimeOffActor, id: string) { reader(actor); await repo.assertTimeOffReady(); return await repo.getMotif(actor.companyId, id) ?? missing(); }
export async function createMotif(actor: TimeOffActor, body: unknown) {
  writer(actor, true);
  const input = validate<CreateMotif>(createMotifSchema, body);
  return repo.transaction(async session => {
    const now = new Date();
    return repo.insertMotif({ ...input, _id: input._id ?? randomUUID(), companyId: actor.companyId, isSystemDefault: false,
      createdAt: now, updatedAt: now, serverVersion: await getNextSyncVersion("time_off_motif", session), synced: 1, isDeleted: 0 }, session);
  });
}
export async function editMotif(actor: TimeOffActor, id: string, body: unknown) {
  writer(actor, true);
  const { serverVersion, ...changes } = validate<EditMotif>(editMotifSchema, body);
  return repo.transaction(async session => {
    const motif = await repo.getMotif(actor.companyId, id, session);
    if (!motif) missing();
    checkVersion(motif.serverVersion, serverVersion);
    if (motif.isSystemDefault) throw new TimeOffError(403, "PROTECTED_MOTIF", "Ce motif système est protégé.");
    return await repo.updateMotif(actor.companyId, id, serverVersion, { ...changes, updatedAt: new Date(),
      serverVersion: await getNextSyncVersion("time_off_motif", session) }, session) ?? missing();
  });
}
export async function deactivateMotif(actor: TimeOffActor, id: string, body: unknown) {
  const input = validate<{ serverVersion: number }>(actionSchema, body);
  // Retain the record, code and all historical references; never physically delete.
  return editMotif(actor, id, { ...input, isActive: false });
}
export async function listRequests(actor: TimeOffActor, query: unknown) {
  reader(actor);
  await repo.assertTimeOffReady();
  return repo.listRequests(actor.companyId, validate<{employeeId?: string; status?: TimeOffStatus; month?: string; includeDeleted?: string}>(listSchema, query));
}
export async function getRequest(actor: TimeOffActor, id: string) {
  reader(actor);
  await repo.assertTimeOffReady();
  return await repo.getRequest(actor.companyId, id) ?? missing();
}
export async function createRequest(actor: TimeOffActor, body: unknown) {
  writer(actor);
  const input = validate<CreateTimeOff>(createRequestSchema, body);
  return repo.transaction(async session => {
    if (input._id && await repo.getRequest(actor.companyId, input._id, session)) {
      throw new TimeOffError(409, "DUPLICATE_KEY", "Cet identifiant de demande existe déjà.");
    }
    const motif = await policy(actor, input.employeeId, input, session);
    const now = new Date();
    const submittedMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const decision = motif.requiresApproval ? { status: TimeOffStatus.PENDING } : await approval(actor, input, motif, session);
    return repo.insertRequest({ ...input, _id: input._id ?? randomUUID(), companyId: actor.companyId,
      submittedAt: now, submittedMonth, createdAt: now, updatedAt: now, ...decision, synced: 1, isDeleted: 0,
      serverVersion: await getNextSyncVersion("time_off", session) }, session);
  });
}
export async function editRequest(actor: TimeOffActor, id: string, body: unknown) {
  writer(actor);
  const { serverVersion, ...changes } = validate<EditTimeOff>(editRequestSchema, body);
  return repo.transaction(async session => {
    const row = await current(actor, id, serverVersion, session);
    if (row.legacyNeedsReview || !row.motifId) unresolved();
    if (row.status !== TimeOffStatus.PENDING) throw new TimeOffError(409, "HISTORY_IMMUTABLE", "Seule une demande en attente peut être modifiée.");
    const fields: RequestFields = { ...row, motifId: row.motifId, ...(changes.isPartialDay === false ? { startTime: undefined, endTime: undefined } : {}), ...changes };
    const motif = await policy(actor, row.employeeId, fields, session);
    const decision = motif.requiresApproval ? {} : await approval(actor, { ...fields, employeeId: row.employeeId }, motif, session);
    return save(row, { ...changes, ...decision }, session);
  });
}
export async function approveRequest(actor: TimeOffActor, id: string, body: unknown) {
  writer(actor, true);
  const input = validate<{ serverVersion: number }>(actionSchema, body);
  return repo.transaction(async session => {
    const row = await current(actor, id, input.serverVersion, session);
    if (row.legacyNeedsReview || !row.motifId) unresolved();
    if (row.status !== TimeOffStatus.PENDING) throw new TimeOffError(409, "INVALID_TRANSITION", "La demande n’est pas en attente d’approbation.");
    const fields = { ...row, motifId: row.motifId };
    const motif = await policy(actor, row.employeeId, fields, session);
    return save(row, await approval(actor, fields, motif, session), session);
  });
}
export async function rejectRequest(actor: TimeOffActor, id: string, body: unknown) {
  writer(actor, true);
  const input = validate<{ serverVersion: number; rejectionReason: string }>(rejectSchema, body);
  return repo.transaction(async session => {
    const row = await current(actor, id, input.serverVersion, session);
    if (row.status !== TimeOffStatus.PENDING) throw new TimeOffError(409, "INVALID_TRANSITION", "Seule une demande en attente peut être refusée.");
    return save(row, { status: TimeOffStatus.REJECTED, rejectionReason: input.rejectionReason }, session);
  });
}
export async function cancelRequest(actor: TimeOffActor, id: string, body: unknown) {
  writer(actor);
  const input = validate<{ serverVersion: number }>(actionSchema, body);
  return repo.transaction(async session => {
    const row = await current(actor, id, input.serverVersion, session);
    if (![TimeOffStatus.PENDING, TimeOffStatus.APPROVED].includes(row.status)) throw new TimeOffError(409, "INVALID_TRANSITION", "Cette demande ne peut plus être annulée.");
    const changes: Partial<TimeOffRecord> = { status: TimeOffStatus.CANCELLED };
    if (row.status === TimeOffStatus.APPROVED) {
      writer(actor, true);
      let days = row.balanceDaysDeducted;
      if (row.legacyNeedsReview || !row.motifId) {
        dates({ motifId: row.motifId ?? "", startDate: row.startDate, endDate: row.endDate });
        days = balanceWeekdays(row.startDate, row.endDate);
        changes.balanceDaysDeducted = days;
      }
      if (days === undefined) unresolved();
      if (days > 0) await repo.adjustBalance(actor.companyId, row.employeeId, days, session);
    }
    return save(row, changes, session);
  });
}
export async function deleteRequest(actor: TimeOffActor, id: string, body: unknown) {
  writer(actor, true);
  const input = validate<{ serverVersion: number }>(actionSchema, body);
  return repo.transaction(async session => {
    const row = await current(actor, id, input.serverVersion, session);
    if (row.status === TimeOffStatus.APPROVED) throw new TimeOffError(409, "CANCELLATION_REQUIRED", "Annulez la demande approuvée avant de l’archiver.");
    return save(row, { isDeleted: 1 }, session);
  });
}
export async function addNotes(actor: TimeOffActor, id: string, body: unknown) {
  writer(actor);
  const input = validate<{ serverVersion: number; additionalNotes: string }>(notesSchema, body);
  return repo.transaction(async session => save(await current(actor, id, input.serverVersion, session), { additionalNotes: input.additionalNotes }, session));
}
export async function reviewLegacyRequest(actor: TimeOffActor, id: string, body: unknown) {
  writer(actor, true);
  const input = validate<{serverVersion: number; motifId: string; supportingDocumentIds?: string[]; notes?: string}>(reviewSchema, body);
  return repo.transaction(async session => {
    const row = await current(actor, id, input.serverVersion, session);
    if (!row.legacyNeedsReview || row.status !== TimeOffStatus.PENDING) {
      throw new TimeOffError(409, "LEGACY_HISTORY_IMMUTABLE", "Seules les demandes historiques encore en attente peuvent être rapprochées d’un motif.");
    }
    const fields = { ...row, motifId: input.motifId, notes: input.notes ?? row.notes, supportingDocumentIds: input.supportingDocumentIds ?? [] };
    const motif = await policy(actor, row.employeeId, fields, session);
    const decision = motif.requiresApproval ? {} : await approval(actor, fields, motif, session);
    return save(row, { motifId: input.motifId, notes: fields.notes, supportingDocumentIds: fields.supportingDocumentIds, legacyNeedsReview: false, ...decision }, session);
  });
}
