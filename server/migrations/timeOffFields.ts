import type { mongo } from "mongoose";
import { historicalTimeOffBalance, timeOffRequestValidator } from "../../client/src/common/migrations/timeOffLegacy.js";

/** Idempotent startup upgrade; preserves IDs, versions, timestamps and employee balances. */
export async function removeTimeOffReviewFields(db: mongo.Db) {
  if (!(await db.listCollections({ name: "time_off" }).hasNext())) return;
  // Existing documents may temporarily fail this validator until their fields are removed below.
  await db.command({ collMod: "time_off", validator: timeOffRequestValidator });
  const target = db.collection("time_off");
  const obsolete = { $or: [{ legacyNeedsReview: { $exists: true } }, { legacyData: { $exists: true } }] };
  for await (const row of target.find(obsolete)) {
    const balance = !row.motifId && row.status === "APPROVED" ? historicalTimeOffBalance(row) : undefined;
    await target.updateOne({ _id: row._id }, {
      $unset: { legacyNeedsReview: "", legacyData: "" },
      ...(balance === undefined ? {} : { $set: { balanceDaysDeducted: balance } }),
    });
  }
  // Receipts retain their fingerprints so queued retries still identify the original mutation.
  const receipts = db.collection("time_off_sync_receipts");
  for await (const receipt of receipts.find({ $or: [
    { "record.legacyNeedsReview": { $exists: true } }, { "record.legacyData": { $exists: true } },
  ] })) {
    const row = receipt.record;
    const balance = !row.motifId && row.status === "APPROVED" ? historicalTimeOffBalance(row) : undefined;
    await receipts.updateOne({ _id: receipt._id }, {
      $unset: { "record.legacyNeedsReview": "", "record.legacyData": "" },
      ...(balance === undefined ? {} : { $set: { "record.balanceDaysDeducted": balance } }),
    });
  }
}
