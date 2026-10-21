import "dotenv/config";
import { MongoClient } from "mongodb";
import { migrateTimeOff } from "../migrations/time-off.mjs";
const [databaseName, maintenance] = process.argv.slice(2);
if (
  !databaseName ||
  maintenance !== "--maintenance-confirmed" ||
  !process.env.TIME_OFF_MIGRATION_URI
) {
  console.error(
    "Set TIME_OFF_MIGRATION_URI; run: node scripts/migrate-time-off.mjs DATABASE_NAME --maintenance-confirmed"
  );
  process.exit(1);
}
const client = new MongoClient(process.env.TIME_OFF_MIGRATION_URI);
(async () => {
  await client.connect();
  console.log(JSON.stringify(await migrateTimeOff(client.db(databaseName))));
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => client.close());
