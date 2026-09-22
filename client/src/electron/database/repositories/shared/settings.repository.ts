import { get, run } from "../../db.js";

type Setting = {
  value: string;
};

export async function getSetting(key: string): Promise<string | null> {
  const row = await get<Setting>(
    "SELECT value FROM app_settings WHERE key = ?",
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await run(
    `
      INSERT INTO app_settings(key, value)
      VALUES (?, ?)
  
      ON CONFLICT(key)
      DO UPDATE SET
        value = excluded.value
      `,
    [key, value]
  );
}
