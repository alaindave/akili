import { randomUUID } from "node:crypto";
import { type TimeOffMotif } from "../../../../common/types/hr/time-off/TimeOff.js";
import { requireLocalIdentity } from "../../../auth.js";
import { all, run, transaction } from "../../../database/db.js";
import { getAdminUsersById } from "../../../database/repositories/shared/admin_users.repository.js";
import { notifyPendingChanges } from "../../../database/repositories/shared/sync.repository.js";
import { recordAuditLog } from "../../shared/audit.service.js";
import {
  enqueueNotification,
  getNotificationByEntity,
} from "../../../database/repositories/shared/notificationQueue.repository.js";
import { getCompanyById } from "../../../database/repositories/shared/companies.repository.js";
import {
  createTimeOff as persistTimeOff,
  getTimeOff as readTimeOff,
  getTimeOffMotif,
  listTimeOffWithEmployees,
  listTimeOffMotifs,
  saveTimeOffMotif as persistMotif,
  transitionTimeOff as persistTransition,
  updateTimeOff as persistUpdate,
} from "../../../database/repositories/modules/hr/timeOff.repository.js";

export type NewTimeOff = Parameters<typeof persistTimeOff>[1];
export type TimeOffChanges = Parameters<typeof persistUpdate>[2];
export type TimeOffAction = "approve" | "reject" | "cancel" | "delete";
export type MotifInput = Omit<
  TimeOffMotif,
  "companyId" | "createdAt" | "updatedAt" | "code"
> & {
  code?: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
  serverVersion?: number;
};

async function actorFor(companyId: string, managerOnly = false) {
  const identity = await requireLocalIdentity(companyId);
  if (managerOnly && identity.role !== "MANAGER")
    throw new Error("Action réservée aux gestionnaires.");
  const actor = await getAdminUsersById(companyId, identity._id);
  if (!actor || actor.isDeleted || (managerOnly && actor.role !== "MANAGER"))
    throw new Error("Utilisateur local invalide ou non autorisé.");
  if (!["ADMIN", "MANAGER"].includes(identity.role) || !["ADMIN", "MANAGER"].includes(actor.role))
    throw new Error("Action non autorisée.");
  return { identity, actor };
}

function validateDates(
  startDate: string,
  endDate: string,
  partial: boolean | undefined,
  startTime?: string,
  endTime?: string
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    endDate < startDate
  )
    throw new Error("La période de la demande est invalide.");
  if (
    partial &&
    (startDate !== endDate ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime ?? "") ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime ?? "") ||
      (startTime ?? "") >= (endTime ?? ""))
  )
    throw new Error(
      "Une demande partielle doit avoir une date et des heures valides."
    );
}

async function requireMotifPolicy(
  companyId: string,
  motifId: string,
  input: { notes?: string; supportingDocumentIds?: string[] }
) {
  const motif = await getTimeOffMotif(companyId, motifId);
  if (!motif || !motif.isActive)
    throw new Error("Choisissez un motif actif de cette entreprise.");
  if (motif.requiresJustification && !input.notes?.trim())
    throw new Error("Une justification est requise pour ce motif.");
  if (motif.requiresSupportingDocument && !input.supportingDocumentIds?.length)
    throw new Error("Un document justificatif est requis pour ce motif.");
  return motif;
}

async function audited<T>(
  companyId: string,
  actorId: string,
  action: string,
  entity: "TimeOff" | "TimeOffMotif",
  entityId: string | ((result: T) => string),
  description: string,
  changes: Record<string, { from: unknown; to: unknown }> | undefined,
  write: () => Promise<T>
) {
  return transaction(async () => {
    const result = await write();
    const actor = await getAdminUsersById(companyId, actorId);
    if (!actor) throw new Error("Utilisateur local introuvable.");
    await recordAuditLog(
      {
        companyId,
        userId: actorId,
        userName: `${actor.firstName} ${actor.lastName}`.trim(),
        action,
        entity,
        entityId: typeof entityId === "function" ? entityId(result) : entityId,
        description,
        changes,
      },
      true
    );
    return result;
  });
}

export async function listTimeOff(companyId: string, employeeId?: string) {
  await requireLocalIdentity(companyId);
  return listTimeOffWithEmployees(companyId, employeeId);
}
export async function getTimeOff(companyId: string, id: string) {
  await requireLocalIdentity(companyId);
  return readTimeOff(companyId, id);
}
export async function listMotifs(companyId: string) {
  await requireLocalIdentity(companyId);
  return listTimeOffMotifs(companyId);
}
export async function createTimeOff(companyId: string, input: NewTimeOff) {
  const { identity } = await actorFor(companyId);
  validateDates(
    input.startDate,
    input.endDate,
    input.isPartialDay,
    input.startTime,
    input.endTime
  );
  await requireMotifPolicy(companyId, input.motifId, input);
  const saved = await audited(
    companyId,
    identity._id,
    "CREATE",
    "TimeOff",
    (result) => result._id,
    "Création d'une demande de congé/absence",
    undefined,
    async () => {
      const created = await persistTimeOff(companyId, input);
      const motif = await getTimeOffMotif(companyId, input.motifId);
      if (motif && !motif.requiresApproval) {
        const now = new Date().toISOString();
        await run(
          `UPDATE time_off SET status='APPROVED',approvedBy=?,approvedAt=?,motifSnapshot=?,synced=0 WHERE companyId=? AND _id=?`,
          [
            identity._id,
            now,
            JSON.stringify({
              code: motif.code,
              label: motif.label,
              category: motif.category,
              payrollTreatment: motif.payrollTreatment,
              deductFromLeaveBalance: motif.deductFromLeaveBalance,
            }),
            companyId,
            created._id,
          ]
        );
      }
      // The queued creation is an intent; sync computes the authoritative approval and balance.
      return (await readTimeOff(companyId, created._id)) ?? created;
    }
  );
  const company = await getCompanyById(companyId);
  const recipientEmail = company?.email?.trim();
  if (
    recipientEmail &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) &&
    !(await getNotificationByEntity(companyId, "leave", saved._id))
  ) {
    const employeeRow = await all<{ firstName: string; lastName: string }>(
      "SELECT firstName,lastName FROM employees WHERE companyId=? AND _id=?",
      [companyId, input.employeeId]
    );
    const target = employeeRow[0];
    await enqueueNotification({
      companyId,
      type: "leave",
      recipientEmail,
      entityId: saved._id,
      title: "Nouvelle demande TimeOff",
      message: `${
        target ? `${target.firstName} ${target.lastName}` : "Un employé"
      } a soumis une demande du ${saved.startDate} au ${saved.endDate}.`,
    });
  }
  await notifyPendingChanges(companyId);
  return (await readTimeOff(companyId, saved._id)) ?? saved;
}
export async function updateTimeOff(
  companyId: string,
  id: string,
  changes: TimeOffChanges
) {
  const { identity } = await actorFor(companyId);
  const current = await readTimeOff(companyId, id);
  if (!current) throw new Error("Demande introuvable.");
  if (
    typeof changes.additionalNotes === "string" &&
    Object.keys(changes).length === 1
  ) {
    if (!["ADMIN", "MANAGER"].includes(identity.role))
      throw new Error("Action non autorisée.");
    const saved = await audited(
      companyId,
      identity._id,
      "UPDATE",
      "TimeOff",
      id,
      "Modification des notes d'une demande",
      {
        additionalNotes: {
          from: current.additionalNotes,
          to: changes.additionalNotes,
        },
      },
      () => persistUpdate(companyId, id, changes)
    );
    await notifyPendingChanges(companyId);
    return saved;
  }
  const next = { ...current, ...changes };
  validateDates(
    next.startDate,
    next.endDate,
    next.isPartialDay,
    next.startTime,
    next.endTime
  );
  if (!next.motifId) throw new Error("Un motif actif est requis.");
  await requireMotifPolicy(companyId, next.motifId, next);
  const saved = await audited(
    companyId,
    identity._id,
    "UPDATE",
    "TimeOff",
    id,
    "Modification d'une demande",
    {
      startDate: { from: current.startDate, to: next.startDate },
      endDate: { from: current.endDate, to: next.endDate },
      motifId: { from: current.motifId, to: next.motifId },
    },
    () => persistUpdate(companyId, id, changes)
  );
  await notifyPendingChanges(companyId);
  return saved;
}
export async function transitionTimeOff(
  companyId: string,
  id: string,
  action: TimeOffAction,
  reason?: string
) {
  const current = await readTimeOff(companyId, id);
  if (!current) throw new Error("Demande introuvable.");
  const { identity } = await actorFor(
    companyId,
    action === "approve" ||
      action === "reject" ||
      action === "delete" ||
      (action === "cancel" && current.status === "APPROVED")
  );
  const result = await audited(
    companyId,
    identity._id,
    action.toUpperCase(),
    "TimeOff",
    id,
    `Action ${action} sur demande TimeOff`,
    {
      status: {
        from: current.status,
        to:
          action === "approve"
            ? "APPROVED"
            : action === "reject"
            ? "REJECTED"
            : action === "cancel"
            ? "CANCELLED"
            : current.status,
      },
    },
    () => persistTransition(companyId, id, action, reason)
  );
  await notifyPendingChanges(companyId);
  return result;
}
export async function saveMotif(companyId: string, input: MotifInput) {
  const { identity } = await actorFor(companyId, true);
  if (input.companyId && input.companyId !== companyId)
    throw new Error("Entreprise du motif invalide.");
  if (!input.label.trim()) throw new Error("Le champ du motif est requis.");
  if (input.isSystemDefault)
    throw new Error(
      "Les motifs système ne peuvent pas être créés ou modifiés ici."
    );
  const id = input._id || randomUUID();
  const code =
    input.code?.trim() ||
    `MOTIF-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const current = await getTimeOffMotif(companyId, id);
  if (current?.isSystemDefault) throw new Error("Les motifs système sont protégés.");
  const saved = await audited(
    companyId,
    identity._id,
    current ? "UPDATE" : "CREATE",
    "TimeOffMotif",
    id,
    "Enregistrement d'un motif TimeOff",
    current
      ? {
          label: { from: current.label, to: input.label },
          isActive: { from: current.isActive, to: input.isActive },
        }
      : undefined,
    () =>
      persistMotif(companyId, {
        ...input,
        serverVersion: current?.serverVersion ?? input.serverVersion ?? 0,
        code,
        _id: id,
        companyId,
        createdAt:
          current?.createdAt ?? input.createdAt ?? new Date().toISOString(),
      })
  );
  await notifyPendingChanges(companyId);
  return saved;
}
export async function deactivateMotif(companyId: string, id: string) {
  const { identity } = await actorFor(companyId, true);
  const current = await getTimeOffMotif(companyId, id);
  if (!current) throw new Error("Motif introuvable.");
  if (current.isSystemDefault)
    throw new Error("Les motifs système sont protégés.");
  if (!current.isActive) return current;
  const saved = await audited(
    companyId,
    identity._id,
    "DEACTIVATE",
    "TimeOffMotif",
    id,
    "Désactivation d'un motif TimeOff",
    { isActive: { from: true, to: false } },
    async () => {
      const result = await persistMotif(companyId, {
        ...current,
        isActive: false,
        updatedAt: new Date().toISOString(),
      });
      return result;
    }
  );
  await notifyPendingChanges(companyId);
  return saved;
}

