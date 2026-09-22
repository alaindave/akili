import { run } from "../../db.js";

export async function createSettingsTable() {
  await run(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
)
  `);

  console.log("SETTINGS TABLE INITIALIZED");
}
