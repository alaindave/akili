import axios from "axios";
import type { SyncQueueItem } from "../../../../common/types/shared/Sync.js";
import type TimeOff from "../../../../common/types/hr/time-off/TimeOff.js";
import type { TimeOffMotif } from "../../../../common/types/hr/time-off/TimeOff.js";
import { markManySynced } from "../../../database/repositories/shared/sync.repository.js";
import { markLegacyTimeOffQueueReviewed, markTimeOffSynced, upsertPulledTimeOff } from "../../../database/repositories/modules/hr/timeOff.repository.js";
import { getSyncState, updateLastPulledVersion } from "../../../database/repositories/shared/syncState.repository.js";
import { getPendingSyncItems } from "../../../database/repositories/shared/sync.repository.js";

type PushResult = { synced: string[]; failures: string[] };
type VersionedTimeOff = TimeOff | (TimeOffMotif & { serverVersion: number; isDeleted?: number });
const safeObject = (value: unknown): Record<string, any> => {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid queued TimeOff payload");
  return parsed as Record<string, any>;
};
async function postIdempotently(path: string, body: Record<string, unknown>, headers: Record<string, string>, getPath: string) {
  try {
    return await axios.post(path, body, { headers, timeout: 90000 });
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 409) throw error;
    const existing = await axios.get(getPath, { headers, timeout: 90000 });
    const matches = Object.entries(body).every(([key, value]) =>
      JSON.stringify(existing.data?.[key] ?? null) === JSON.stringify(value ?? null));
    if (!matches) throw new Error("Create ID already exists with different server data; manual conflict review is required");
    return existing;
  }
}

/** Sends canonical motif policies before requests that reference them. Legacy queue entries are deliberately held for review. */
export async function pushTimeOffQueue(companyId: string, apiUrl: string, token: string, queue: SyncQueueItem[]): Promise<PushResult> {
  const synced: string[] = [];
  const failures: string[] = [];
  const acknowledgedVersions = new Map<string, number>();
  const reviewedLegacyIds = new Set<string>();
  if (!apiUrl) return { synced, failures: ["TimeOff sync API URL is not configured"] };
  const items = queue.filter(item => item.entity === "time_off_motif" || item.entity === "time_off" || item.entity === "leave");
  items.sort((a, b) => (a.entity === "time_off_motif" ? 0 : 1) - (b.entity === "time_off_motif" ? 0 : 1));
  for (const item of items) {
    try {
      if (item.companyId !== companyId) throw new Error("Queued company does not match active company");
      if (item.entity === "leave") {
        if (reviewedLegacyIds.has(item.entityId)) continue;
        throw new Error("Legacy leave change is held for explicit TimeOff motif review");
      }
      const data = safeObject(item.payload);
      if (data.companyId && data.companyId !== companyId) throw new Error("Payload company does not match active company");
      const versionKey = `${item.entity}:${item.entityId}`;
      if (acknowledgedVersions.has(versionKey)) data.serverVersion = acknowledgedVersions.get(versionKey);
      let response;
      if (item.entity === "time_off_motif") {
        const motifFields = ["code","label","category","payrollTreatment","deductFromLeaveBalance",
          "requiresApproval","requiresJustification","requiresSupportingDocument","isActive"];
        const motifInput = Object.fromEntries(["_id", ...motifFields]
          .filter(key => data[key] !== undefined).map(key => [key,data[key]]));
        const path = `${apiUrl}/time-off/motifs${item.operation === "create" ? "" : `/${encodeURIComponent(item.entityId)}`}`;
        if (item.operation === "create") response = await postIdempotently(path, motifInput, { "x-auth-token": token, "x-company-id": companyId }, `${apiUrl}/time-off/motifs/${encodeURIComponent(item.entityId)}`);
        else if (item.operation === "delete") response = await axios.delete(path, { data: { serverVersion: data.serverVersion }, headers: { "x-auth-token": token, "x-company-id": companyId }, timeout: 90000 });
        else {
          const motifChanges = Object.fromEntries(motifFields.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
          response = await axios.patch(path, { ...motifChanges, serverVersion: data.serverVersion }, { headers: { "x-auth-token": token, "x-company-id": companyId }, timeout: 90000 });
        }
        const saved = response.data as TimeOffMotif & { serverVersion: number; isDeleted?: number };
        acknowledgedVersions.set(versionKey, saved.serverVersion);
        await upsertPulledTimeOff(companyId, "time_off_motif", saved);
        await markTimeOffSynced(companyId, "time_off_motif", item.entityId, saved.serverVersion);
      } else {
        const id = encodeURIComponent(item.entityId);
        const base = `${apiUrl}/time-off`;
        const headers = { "x-auth-token": token, "x-company-id": companyId };
        const fields = ["_id","employeeId","motifId","startDate","endDate","isPartialDay","startTime","endTime","notes","additionalNotes","supportingDocumentIds"];
        const requestInput = Object.fromEntries(fields.filter(key => data[key] !== undefined).map(key => [key,data[key]]));
        if (data.reviewLegacy === true) {
          response = await axios.post(`${base}/${id}/review-legacy`, { motifId: data.motifId, notes: data.notes, serverVersion: data.serverVersion }, { headers, timeout: 90000 });
          const saved = response.data as TimeOff;
          acknowledgedVersions.set(versionKey, saved.serverVersion);
          await upsertPulledTimeOff(companyId, "time_off", saved);
          await markTimeOffSynced(companyId, "time_off", item.entityId, saved.serverVersion);
          await markLegacyTimeOffQueueReviewed(companyId, item.entityId);
          reviewedLegacyIds.add(item.entityId);
          await markManySynced(companyId, [item._id]);
          synced.push(item._id);
          continue;
        }
        if (item.operation === "create") response = await postIdempotently(base, requestInput, headers, `${base}/${id}`);
        else if (item.operation === "delete") response = await axios.delete(`${base}/${id}`, { data: { serverVersion: data.serverVersion }, headers, timeout: 90000 });
        else if (data.status === "CANCELLED") response = await axios.post(`${base}/${id}/cancel`, { serverVersion: data.serverVersion }, { headers, timeout: 90000 });
        else if (data.status === "APPROVED") response = await axios.post(`${base}/${id}/approve`, { serverVersion: data.serverVersion }, { headers, timeout: 90000 });
        else if (data.status === "REJECTED") response = await axios.post(`${base}/${id}/reject`, { serverVersion: data.serverVersion, rejectionReason: data.rejectionReason }, { headers, timeout: 90000 });
        else if (data.additionalNotes !== undefined && Object.keys(data).every(key => ["_id","companyId","serverVersion","additionalNotes","status"].includes(key))) response = await axios.patch(`${base}/${id}/notes`, { serverVersion: data.serverVersion, additionalNotes: data.additionalNotes }, { headers, timeout: 90000 });
        else response = await axios.patch(`${base}/${id}`, { ...Object.fromEntries(fields.filter(key => key !== "_id" && data[key] !== undefined).map(key => [key,data[key]])), serverVersion: data.serverVersion }, { headers, timeout: 90000 });
        const saved = response.data as TimeOff;
        acknowledgedVersions.set(versionKey, saved.serverVersion);
        await upsertPulledTimeOff(companyId, "time_off", saved);
        await markTimeOffSynced(companyId, "time_off", item.entityId, saved.serverVersion);
      }
      await markManySynced(companyId, [item._id]);
      synced.push(item._id);
    } catch (error) {
      const detail = axios.isAxiosError(error) ? (error.response?.data?.message ?? error.message) : String(error);
      failures.push(`${item.entity} ${item.entityId}: ${detail}`);
    }
  }
  return { synced, failures };
}

export async function pullTimeOffChanges(companyId: string, apiUrl: string, token: string) {
  if (!apiUrl) throw new Error("TimeOff sync API URL is not configured");
  const headers = { "x-auth-token": token, "x-company-id": companyId };
  const [motifResponse, requestResponse] = await Promise.all([
    axios.get(`${apiUrl}/time-off/motifs`, { headers, timeout: 90000 }),
    axios.get(`${apiUrl}/time-off?includeDeleted=true`, { headers, timeout: 90000 }),
  ]);
  const motifs = (Array.isArray(motifResponse.data) ? motifResponse.data : motifResponse.data.items ?? []) as Array<TimeOffMotif & { serverVersion: number; isDeleted?: number }>;
  const requests = (Array.isArray(requestResponse.data) ? requestResponse.data : requestResponse.data.items ?? []) as TimeOff[];
  const errors: string[] = [];
  const motifCount = await importPullRows(companyId, "time_off_motif", motifs);
  const requestCount = await importPullRows(companyId, "time_off", requests);
  return { motifs: motifCount, requests: requestCount, errors };
}

async function importPullRows(companyId: string, entity: "time_off" | "time_off_motif", values: VersionedTimeOff[]) {
  const state = await getSyncState(companyId, entity);
  let cursor = state.lastPulledVersion;
  const sorted = values.filter(row => row.companyId === companyId && Number(row.serverVersion) > cursor)
    .sort((a, b) => Number(a.serverVersion) - Number(b.serverVersion));
  for (const row of sorted) {
    const pending = await getPendingSyncItems(companyId, [{ entity, entityId: row._id }]);
    if (pending.length) break;
    await upsertPulledTimeOff(companyId, entity, row);
    cursor = Number(row.serverVersion);
  }
  if (cursor > state.lastPulledVersion) await updateLastPulledVersion(companyId, entity, cursor);
  return cursor - state.lastPulledVersion;
}
