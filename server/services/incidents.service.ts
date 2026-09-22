import Incident from "../models/incident.model.js";
import { getNextSyncVersion } from "../utils/syncVersion.js";
import { broadcastEntityChange } from "./socket.service.js";
import type { SyncOperation } from "../sync.js";

// Full snapshots allow an update to arrive before a retried create.
// Newest client updatedAt wins, matching offline edits; replays are no-ops.
export async function syncIncident(
  operation: SyncOperation,
  data: Record<string, unknown>
) {
  if (operation !== "create" && operation !== "update")
    throw new Error("Unsupported incident operation");
  if (!data || typeof data !== "object")
    throw new Error("Invalid incident payload");
  const candidate = new Incident({
    _id: data._id,
    companyId: data.companyId,
    incidentNumber: data.incidentNumber,
    reporterName: data.reporterName,
    reporterContact: data.reporterContact,
    occurredAt: data.occurredAt,
    location: data.location,
    notes: data.notes,
    preventiveActions: data.preventiveActions,
    remedialActions: data.remedialActions,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    serverVersion: 0,
    isDeleted: 0,
  });
  await candidate.validate();
  const fields = candidate.toObject();

  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await Incident.findById(fields._id).lean();
    if (existing && existing.companyId !== fields.companyId)
      throw new Error("Incident company mismatch");
    if (existing && existing.updatedAt.getTime() >= fields.updatedAt.getTime())
      return existing;
    const serverVersion = await getNextSyncVersion("incident");
    let saved;
    if (!existing) {
      try {
        saved = await Incident.create({ ...fields, serverVersion });
      } catch (error) {
        if ((error as { code?: number }).code === 11000) continue;
        throw error;
      }
    } else {
      const {
        _id,
        companyId,
        incidentNumber: _number,
        createdAt: _created,
        ...mutable
      } = fields;
      saved = await Incident.findOneAndUpdate(
        { _id, companyId, serverVersion: existing.serverVersion },
        { $set: { ...mutable, serverVersion } },
        { new: true, runValidators: true }
      );
      if (!saved) continue;
    }
    // Broadcast only an invalidation, never reporter details or incident notes.
    broadcastEntityChange({
      entity: "incident",
      event: existing ? "UPDATED" : "CREATED",
      entityId: fields._id,
      serverVersion,
    });
    return saved;
  }
  throw new Error("Incident changed concurrently; retry sync");
}
