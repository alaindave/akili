import mongoose, { Types, type ClientSession } from "mongoose";
import TimeOff from "../models/modules/hr/timeOff.model.js";
import Motif from "../models/modules/hr/timeOffMotif.model.js";
import Employee from "../models/modules/hr/employee.model.js";
import EmployeeDocument from "../models/modules/hr/employeesDocuments.model.js";
import { getNextSyncVersion } from "../utils/syncVersion.js";
import type {
  TimeOffRecord,
  TimeOffMotifRecord,
  TimeOffStatus,
} from "../types/timeOff.js";
import { TimeOffError } from "../validation/timeOff.validation.js";

export async function assertTimeOffReady() {
  const marker = await mongoose.connection.db
    ?.collection<{ _id: string }>("migrations")
    .findOne({ _id: "20261020_time_off_v1" });
  if (!marker)
    throw new TimeOffError(
      503,
      "MIGRATION_REQUIRED",
      "La migration TimeOff doit être exécutée avant cette opération."
    );
}
export async function transaction<T>(
  action: (session: ClientSession) => Promise<T>
): Promise<T> {
  await assertTimeOffReady();
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await action(session);
    });
    if (result === undefined)
      throw new Error("Transaction TimeOff sans résultat.");
    return result;
  } finally {
    await session.endSession();
  }
}
export function listMotifs(companyId: string) {
  return Motif.find({ companyId, isDeleted: 0 }).sort({ label: 1 }).lean();
}
export function getMotif(
  companyId: string,
  id: string,
  session?: ClientSession
) {
  return Motif.findOne({ companyId, _id: id, isDeleted: 0 })
    .session(session ?? null)
    .lean();
}
export async function lockActiveMotif(
  companyId: string,
  id: string,
  session: ClientSession
) {
  // A real write serializes policy use against concurrent policy edits/deactivation.
  return Motif.findOneAndUpdate(
    { companyId, _id: id, isActive: true, isDeleted: 0 },
    { $inc: { usageRevision: 1 } },
    { new: true, session }
  ).lean();
}
export async function insertMotif(
  row: TimeOffMotifRecord,
  session: ClientSession
) {
  const [saved] = await Motif.create([row], { session });
  return saved.toObject();
}
export function updateMotif(
  companyId: string,
  id: string,
  serverVersion: number,
  changes: Partial<TimeOffMotifRecord>,
  session: ClientSession
) {
  return Motif.findOneAndUpdate(
    { companyId, _id: id, serverVersion, isDeleted: 0 },
    { $set: changes },
    { new: true, runValidators: true, session }
  ).lean();
}
export function getEmployee(
  companyId: string,
  id: string,
  session: ClientSession
) {
  return Employee.findOne({ companyId, _id: id, isDeleted: 0 })
    .session(session)
    .lean();
}
export function validDocuments(
  companyId: string,
  employeeId: string,
  ids: string[],
  session: ClientSession
) {
  return EmployeeDocument.countDocuments({
    companyId,
    employeeId,
    _id: { $in: ids },
    isDeleted: 0,
    storagePath: { $type: "string", $ne: "" },
  }).session(session);
}
export async function adjustBalance(
  companyId: string,
  employeeId: string,
  delta: number,
  session: ClientSession
) {
  const serverVersion = await getNextSyncVersion("employee", session);
  const saved = await Employee.findOneAndUpdate(
    {
      companyId,
      _id: employeeId,
      isDeleted: 0,
      ...(delta < 0 ? { remainingLeave: { $gte: -delta } } : {}),
    },
    {
      $inc: { remainingLeave: delta },
      $set: { updatedAt: new Date(), serverVersion },
    },
    { session, new: true }
  );
  if (!saved)
    throw new TimeOffError(
      409,
      "INSUFFICIENT_BALANCE",
      "Solde de congé insuffisant ou employé indisponible."
    );
}
export async function getRequest(
  companyId: string,
  id: string,
  session?: ClientSession
) {
  const ids: Array<string | Types.ObjectId> = [id];
  if (/^[a-f\d]{24}$/i.test(id)) ids.push(new Types.ObjectId(id));
  const rows = await TimeOff.find({ companyId, _id: { $in: ids } })
    .limit(2)
    .session(session ?? null)
    .lean();
  if (rows.length > 1)
    throw new TimeOffError(
      409,
      "AMBIGUOUS_LEGACY_ID",
      "Identifiant historique ambigu : rapprochement nécessaire."
    );
  return rows[0] ?? null;
}
export function listRequests(
  companyId: string,
  query: {
    employeeId?: string;
    status?: TimeOffStatus;
    month?: string;
    includeDeleted?: string;
  }
): Promise<TimeOffRecord[]> {
  let dateFilter = {};
  if (query.month) {
    const start = new Date(`${query.month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    // Migrated records may retain date strings as well as BSON dates.
    dateFilter = {
      $or: [
        { submittedAt: { $gte: start, $lt: end } },
        {
          submittedAt: {
            $gte: start.toISOString().slice(0, 10),
            $lt: end.toISOString().slice(0, 10),
          },
        },
      ],
    };
  }
  // collection access preserves BSON types in the migration's mixed date range.
  return mongoose.connection.db
    .collection<TimeOffRecord>("time_off")
    .find({
      companyId,
      ...(query.includeDeleted === "true" ? {} : { isDeleted: { $ne: 1 } }),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...dateFilter,
    })
    .sort({ submittedAt: -1, _id: 1 })
    .toArray();
}
export async function insertRequest(
  row: TimeOffRecord,
  session: ClientSession
) {
  const [saved] = await TimeOff.create([row], { session });
  return saved.toObject();
}
export function updateRequest(
  row: TimeOffRecord,
  changes: Partial<TimeOffRecord>,
  session: ClientSession
) {
  return TimeOff.findOneAndUpdate(
    {
      companyId: row.companyId,
      _id: row._id,
      serverVersion: row.serverVersion,
      isDeleted: { $ne: 1 },
    },
    {
      $set: changes,
      ...(changes.isPartialDay === false
        ? { $unset: { startTime: "", endTime: "" } }
        : {}),
    },
    { new: true, runValidators: true, session }
  ).lean();
}
