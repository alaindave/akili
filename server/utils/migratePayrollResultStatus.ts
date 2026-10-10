import PayrollResult from "../models/modules/hr/payrollResult.model.js";
import { getNextSyncVersion } from "./syncVersion.js";

// Run before serving requests. Preserve conflict timestamps, but assign a new
// sync version to every migrated document so existing clients can pull it.
export async function migratePayrollResultStatus() {
  const legacy = { status: "VERIFICATION" };
  const cursor = PayrollResult.collection.find(legacy, {
    projection: { _id: 1 },
  });
  for await (const record of cursor) {
    const serverVersion = await getNextSyncVersion("payroll_result");
    await PayrollResult.collection.updateOne(
      { _id: record._id, ...legacy },
      { $set: { status: "VERIFIÉ", serverVersion } }
    );
  }
}
