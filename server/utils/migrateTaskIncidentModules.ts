import Task from "../models/task.model.js";
import Incident from "../models/incident.model.js";
import { getNextSyncVersion } from "./syncVersion.js";

// Mongoose defaults do not backfill persisted documents or lean query results.
// Run before serving requests; retain timestamps so pending offline edits keep
// their original conflict ordering. New versions make the changes pullable.
export async function migrateTaskIncidentModules() {
  for (const [entity, collection] of [
    ["task", Task.collection],
    ["incident", Incident.collection],
  ] as const) {
    const missingModule = { module: null }; // Matches missing and explicit null.
    const cursor = collection.find(missingModule, { projection: { _id: 1 } });
    for await (const record of cursor) {
      const serverVersion = await getNextSyncVersion(entity);
      await collection.updateOne(
        { _id: record._id, ...missingModule },
        { $set: { module: "HR", serverVersion } }
      );
    }
  }
}
