import { randomUUID } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import { createHash } from "node:crypto";
import AdminUser from "../models/shared/adminUser.model.js";
import * as repo from "../repositories/timeOff.repository.js";
import { getNextSyncVersion } from "../utils/syncVersion.js";
import { TimeOffStatus, type TimeOffRecord, type TimeOffMotifRecord, type TimeOffMotifSnapshot,
  type CreateMotif, type EditMotif, type CreateTimeOff, type EditTimeOff, type RequestFields } from "../types/timeOff.js";
import { TimeOffError, validate, createMotifSchema, editMotifSchema, createRequestSchema, editRequestSchema,
  actionSchema, rejectSchema, notesSchema, identifier, periodSchema } from "../validation/timeOff.validation.js";
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
async function createMotif(actor: TimeOffActor, body: unknown, session: ClientSession) {
  writer(actor, true);
  const input = validate<CreateMotif>(createMotifSchema, body);
  return inSession(session, async session => {
    const now = new Date();
    return repo.insertMotif({ ...input, _id: input._id ?? randomUUID(), companyId: actor.companyId, isSystemDefault: false,
      createdAt: now, updatedAt: now, serverVersion: await getNextSyncVersion("time_off_motif", session), synced: 1, isDeleted: 0 }, session);
  });
}
async function editMotif(actor: TimeOffActor, id: string, body: unknown, session: ClientSession) {
  writer(actor, true);
  const { serverVersion, ...changes } = validate<EditMotif>(editMotifSchema, body);
  return inSession(session, async session => {
    const motif = await repo.getMotif(actor.companyId, id, session);
    if (!motif) missing();
    checkVersion(motif.serverVersion, serverVersion);
    if (motif.isSystemDefault) throw new TimeOffError(403, "PROTECTED_MOTIF", "Ce motif système est protégé.");
    return await repo.updateMotif(actor.companyId, id, serverVersion, { ...changes, updatedAt: new Date(),
      serverVersion: await getNextSyncVersion("time_off_motif", session) }, session) ?? missing();
  });
}
async function deactivateMotif(actor: TimeOffActor, id: string, body: unknown, session: ClientSession) {
  const input = validate<{ serverVersion: number }>(actionSchema, body);
  // Retain the record, code and all historical references; never physically delete.
  return editMotif(actor, id, { ...input, isActive: false }, session);
}
async function createRequest(actor: TimeOffActor, body: unknown, session: ClientSession) {
  writer(actor);
  const input = validate<CreateTimeOff>(createRequestSchema, body);
  return inSession(session, async session => {
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
async function editRequest(actor: TimeOffActor, id: string, body: unknown, session: ClientSession) {
  writer(actor);
  const { serverVersion, ...changes } = validate<EditTimeOff>(editRequestSchema, body);
  return inSession(session, async session => {
    const row = await current(actor, id, serverVersion, session);
    if (row.status !== TimeOffStatus.PENDING) throw new TimeOffError(409, "HISTORY_IMMUTABLE", "Seule une demande en attente peut être modifiée.");
    const fields: RequestFields = { ...row, motifId: row.motifId ?? "", ...(changes.isPartialDay === false ? { startTime: undefined, endTime: undefined } : {}), ...changes };
    const motif = await policy(actor, row.employeeId, fields, session);
    const decision = motif.requiresApproval ? {} : await approval(actor, { ...fields, employeeId: row.employeeId }, motif, session);
    return save(row, { ...changes, ...decision }, session);
  });
}
async function approveRequest(actor: TimeOffActor, id: string, body: unknown, session: ClientSession) {
  writer(actor, true);
  const input = validate<{ serverVersion: number }>(actionSchema, body);
  return inSession(session, async session => {
    const row = await current(actor, id, input.serverVersion, session);
    if (row.status !== TimeOffStatus.PENDING) throw new TimeOffError(409, "INVALID_TRANSITION", "La demande n’est pas en attente d’approbation.");
    const fields = { ...row, motifId: row.motifId ?? "" };
    const motif = await policy(actor, row.employeeId, fields, session);
    return save(row, await approval(actor, fields, motif, session), session);
  });
}
async function rejectRequest(actor: TimeOffActor, id: string, body: unknown, session: ClientSession) {
  writer(actor, true);
  const input = validate<{ serverVersion: number; rejectionReason: string }>(rejectSchema, body);
  return inSession(session, async session => {
    const row = await current(actor, id, input.serverVersion, session);
    if (row.status !== TimeOffStatus.PENDING) throw new TimeOffError(409, "INVALID_TRANSITION", "Seule une demande en attente peut être refusée.");
    return save(row, { status: TimeOffStatus.REJECTED, rejectionReason: input.rejectionReason }, session);
  });
}
async function cancelRequest(actor: TimeOffActor, id: string, body: unknown, session: ClientSession) {
  writer(actor);
  const input = validate<{ serverVersion: number }>(actionSchema, body);
  return inSession(session, async session => {
    const row = await current(actor, id, input.serverVersion, session);
    if (![TimeOffStatus.PENDING, TimeOffStatus.APPROVED].includes(row.status)) throw new TimeOffError(409, "INVALID_TRANSITION", "Cette demande ne peut plus être annulée.");
    const changes: Partial<TimeOffRecord> = { status: TimeOffStatus.CANCELLED };
    if (row.status === TimeOffStatus.APPROVED) {
      writer(actor, true);
      const days = row.balanceDaysDeducted;
      if (days === undefined) throw new TimeOffError(409, "BALANCE_METADATA_MISSING", "Le montant de la déduction initiale est manquant.");
      if (days > 0) await repo.adjustBalance(actor.companyId, row.employeeId, days, session);
    }
    return save(row, changes, session);
  });
}
async function deleteRequest(actor: TimeOffActor, id: string, body: unknown, session: ClientSession) {
  writer(actor, true);
  const input = validate<{ serverVersion: number }>(actionSchema, body);
  return inSession(session, async session => {
    const row = await current(actor, id, input.serverVersion, session);
    if (row.status === TimeOffStatus.APPROVED) throw new TimeOffError(409, "CANCELLATION_REQUIRED", "Annulez la demande approuvée avant de l’archiver.");
    return save(row, { isDeleted: 1 }, session);
  });
}
async function addNotes(actor: TimeOffActor, id: string, body: unknown, session: ClientSession) {
  writer(actor);
  const input = validate<{ serverVersion: number; additionalNotes: string }>(notesSchema, body);
  return inSession(session, async session => save(await current(actor, id, input.serverVersion, session), { additionalNotes: input.additionalNotes }, session));
}
// Helpers run inside the encompassing sync transaction, never a second session.
function inSession<T>(session: ClientSession, action: (session: ClientSession) => Promise<T>) {
  return action(session);
}

export async function timeOffSyncActor(companyId: string, userId: string): Promise<TimeOffActor> {
  const user = await AdminUser.findOne({ _id: userId, companyId, isDeleted: 0 }).lean();
  if (!user) throw new TimeOffError(403, "FORBIDDEN", "Utilisateur non autorisé.");
  const actor = { companyId, _id: userId, role: user.role };
  reader(actor);
  return actor;
}

const motifKeys = ["code", "label", "category", "payrollTreatment", "deductFromLeaveBalance",
  "requiresApproval", "requiresJustification", "requiresSupportingDocument", "isActive"];
const requestKeys = ["motifId", "startDate", "endDate", "isPartialDay", "startTime", "endTime",
  "notes", "additionalNotes", "supportingDocumentIds"];
const receiptCollections = new WeakMap<object, Promise<unknown>>();
async function ensureReceipts() {
  await repo.assertTimeOffReady();
  const db = mongoose.connection.db;
  let ready = receiptCollections.get(db);
  if (!ready) {
    // Older MongoDB versions cannot create a collection inside a transaction.
    ready = db.createCollection("time_off_sync_receipts").catch((error: { code?: number }) => {
      if (error.code !== 48) { receiptCollections.delete(db); throw error; }
    });
    receiptCollections.set(db, ready);
  }
  await ready;
}
function select(data: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.filter(key => data[key] != null).map(key => [key, data[key]]));
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${canonical(val)}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}

/** Only called by /sync/push. A receipt makes a committed operation replay-safe. */
export async function syncTimeOff(
  entity: "time_off" | "time_off_motif",
  operation: "create" | "update" | "delete",
  data: Record<string, unknown>,
  actor: TimeOffActor
) {
  const id = validate<string>(identifier.required(), data._id);
  const mutationId = validate<string>(identifier.required(), data.syncMutationId);
  if (data.companyId !== actor.companyId) throw new TimeOffError(403, "FORBIDDEN", "Entreprise invalide.");
  const action = data.requestedAction ??
    (operation === "delete" ? "delete" : operation === "create" ? "create" :
      data.additionalNotes !== undefined && !data.motifId ? "notes" : "edit");
  const managerOnly = entity === "time_off_motif" || ["approve", "reject", "delete"].includes(String(action));
  writer(actor, managerOnly);
  const fingerprint = createHash("sha256").update(canonical({ entity, operation, data })).digest("hex");
  const receiptId = createHash("sha256").update(`${actor.companyId}:${entity}:${mutationId}`).digest("hex");
  await ensureReceipts();
  return repo.transaction(async session => {
    const receipts = mongoose.connection.db.collection<{
      _id: string; fingerprint: string; actorId: string; record: TimeOffRecord | TimeOffMotifRecord;
    }>("time_off_sync_receipts");
    const receipt = await receipts.findOne({ _id: receiptId }, { session });
    if (receipt) {
      // Another authorized user may resume this device's queue after a lost response.
      if (receipt.fingerprint !== fingerprint)
        throw new TimeOffError(409, "MUTATION_CONFLICT", "Identifiant de synchronisation déjà utilisé.");
      return { serverVersion: receipt.record.serverVersion, record: receipt.record };
    }
    const version = { serverVersion: data.serverVersion };
    let record: TimeOffRecord | TimeOffMotifRecord;
    if (entity === "time_off_motif") {
      if (data.isSystemDefault) throw new TimeOffError(403, "PROTECTED_MOTIF", "Ce motif système est protégé.");
      record = operation === "create" ? await createMotif(actor, { _id: id, ...select(data, motifKeys) }, session) :
        operation === "delete" ? await deactivateMotif(actor, id, version, session) :
          await editMotif(actor, id, { ...select(data, motifKeys), ...version }, session);
    } else if (operation === "create") {
      record = await createRequest(actor, { _id: id, ...select(data, ["employeeId", ...requestKeys]) }, session);
    } else if (operation === "delete") {
      record = await deleteRequest(actor, id, version, session);
    } else {
      switch (action) {
        case "approve": record = await approveRequest(actor, id, version, session); break;
        case "reject": record = await rejectRequest(actor, id, { ...version, rejectionReason: data.rejectionReason }, session); break;
        case "cancel": record = await cancelRequest(actor, id, version, session); break;
        case "notes": record = await addNotes(actor, id, { ...version, additionalNotes: data.additionalNotes }, session); break;
        case "edit": record = await editRequest(actor, id, { ...select(data, requestKeys), ...version }, session); break;
        default: throw new TimeOffError(400, "INVALID_ACTION", "Action TimeOff inconnue.");
      }
    }
    await receipts.insertOne({ _id: receiptId, fingerprint, actorId: actor._id, record }, { session });
    return { serverVersion: record.serverVersion, record };
  });
}
