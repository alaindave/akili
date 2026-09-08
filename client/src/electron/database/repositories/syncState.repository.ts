import { get, run } from "../db.js";

export interface SyncState {
  companyId: string;
  entity: string;
  lastPulledVersion: number;
  updatedAt: string;
}

/* =========================================================
   GET SYNC STATE
========================================================= */

export async function getSyncState(
  companyId: string,
  entity: string
): Promise<SyncState> {
  const existing = await get<SyncState>(
    `
      SELECT
        companyId,
        entity,
        lastPulledVersion,
        updatedAt
      FROM sync_state
      WHERE companyId = ?
        AND entity = ?
      LIMIT 1
    `,
    [companyId, entity]
  );

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();

  await run(
    `
      INSERT INTO sync_state (
        companyId,
        entity,
        lastPulledVersion,
        updatedAt
      )
      VALUES (?, ?, 0, ?)
    `,
    [companyId, entity, now]
  );

  return {
    companyId,
    entity,
    lastPulledVersion: 0,
    updatedAt: now,
  };
}

/* =========================================================
   UPDATE LAST PULLED VERSION
========================================================= */

export async function updateLastPulledVersion(
  companyId: string,
  entity: string,
  version: number
): Promise<void> {
  const now = new Date().toISOString();

  await run(
    `
      INSERT INTO sync_state (
        companyId,
        entity,
        lastPulledVersion,
        updatedAt
      )
      VALUES (?, ?, ?, ?)

      ON CONFLICT(companyId, entity)
      DO UPDATE SET
        lastPulledVersion = excluded.lastPulledVersion,
        updatedAt = excluded.updatedAt
    `,
    [companyId, entity, version, now]
  );
}
