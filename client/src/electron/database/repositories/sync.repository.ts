import { BrowserWindow } from "electron";
import { SyncQueueItem } from "../../../common/types/Sync.js";
import { all, run } from "../db.js";

export async function notifyPendingChanges(companyId: string): Promise<void> {
  try {
    const pendingItems = await getUnsyncedItems(companyId);
    const pendingChanges = pendingItems.length;

    console.log("PENDING CHANGES UPDATED:", {
      companyId,
      pendingChanges,
    });

    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send("sync:pending-changes", {
          companyId,
          pendingChanges,
          timestamp: new Date().toISOString(),
        });
      }
    });
  } catch (error) {
    console.error("FAILED TO NOTIFY PENDING CHANGES:", error);
  }
}

export async function addToSyncQueue(
  item: Omit<SyncQueueItem, "_id" | "synced" | "createdAt">
): Promise<number> {
  if (!item.companyId) {
    throw new Error("SYNC QUEUE: companyId is required");
  }

  const result = await run(
    `
      INSERT INTO sync_queue (
        companyId,
        entity,
        entityId,
        operation,
        payload
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [item.companyId, item.entity, item.entityId, item.operation, item.payload]
  );

  await notifyPendingChanges(item.companyId);

  return result.lastID;
}

export async function getUnsyncedItems(
  companyId: string
): Promise<SyncQueueItem[]> {
  if (!companyId) {
    throw new Error("SYNC QUEUE: companyId is required");
  }

  return all(
    `
      SELECT *
      FROM sync_queue
      WHERE companyId = ?
        AND synced = 0
      ORDER BY createdAt ASC
    `,
    [companyId]
  );
}

export async function markManySynced(
  companyId: string,
  ids: string[]
): Promise<void> {
  if (!companyId) {
    throw new Error("SYNC QUEUE: companyId is required");
  }

  if (!ids.length) return;

  const placeholders = ids.map(() => "?").join(",");

  await run(
    `
      UPDATE sync_queue
      SET synced = 1
      WHERE companyId = ?
        AND _id IN (${placeholders})
    `,
    [companyId, ...ids]
  );

  await notifyPendingChanges(companyId);
}

export async function deleteSyncedItems(companyId: string): Promise<void> {
  if (!companyId) {
    throw new Error("SYNC QUEUE: companyId is required");
  }

  await run(
    `
      DELETE FROM sync_queue
      WHERE companyId = ?
        AND synced = 1
    `,
    [companyId]
  );

  await notifyPendingChanges(companyId);
}
