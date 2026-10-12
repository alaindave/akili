import { all, allDirect, getDirect, runDirect, transaction, afterCommit } from "../../../db.js";
import { addToSyncQueue, notifyPendingChanges } from "../../shared/sync.repository.js";

type Row = Record<string, unknown> & { _id: string; updatedAt: string };
interface StockOperation {
  _id: string;
  document: Row;
  lines: Row[];
  movements: Row[];
}

/** Capture the complete operation and archive its old per-row queue entries atomically. */
export async function queuePostedDocument(companyId: string, documentId: string) {
  return transaction(async () => {
    const queued = await getDirect<{ payload: string }>("SELECT payload FROM sync_queue WHERE companyId = ? AND entity = 'inventory_transaction' AND entityId = ? AND synced = 0", [companyId, documentId]);
    const document = await getDirect<Row>("SELECT * FROM inventory_documents WHERE companyId = ? AND _id = ?", [companyId, documentId]);
    if (!document || document.status !== "POSTED" || document.referenceType === "OPENING_STOCK") return;
    const lines = await allDirect<Row>("SELECT * FROM inventory_document_lines WHERE companyId = ? AND documentId = ? ORDER BY lineNumber", [companyId, documentId]);
    const movements = await allDirect<Row>("SELECT * FROM inventory_movements WHERE companyId = ? AND documentId = ? ORDER BY _id", [companyId, documentId]);
    if (!lines.length || !movements.length) return; // Preserve incomplete legacy records for review.
    if (lines.some(line => !movements.some(movement => movement.documentLineId === line._id)) ||
        movements.some(movement => !lines.some(line => line._id === movement.documentLineId))) return;
    if (queued) {
      const captured = JSON.parse(queued.payload) as StockOperation;
      // Never hide changes that are absent from the immutable queued operation.
      if (JSON.stringify(captured.document) !== JSON.stringify(document) ||
          JSON.stringify(captured.lines) !== JSON.stringify(lines) ||
          JSON.stringify(captured.movements) !== JSON.stringify(movements)) return;
    }
    const balanceIds: string[] = [];
    for (const movement of movements) {
      const balance = await getDirect<Row>(`SELECT _id FROM inventory_balances WHERE companyId = ? AND itemId = ? AND warehouseId = ?
        AND COALESCE(locationId, '') = ? AND COALESCE(lotId, '') = ? AND COALESCE(serialNumber, '') = ?`,
      [companyId, movement.itemId, movement.warehouseId, movement.locationId ?? "", movement.lotId ?? "", movement.serialNumber ?? ""]);
      if (balance && !balanceIds.includes(balance._id)) balanceIds.push(balance._id);
    }
    const ids = new Set([`inventory_document:${documentId}`, ...lines.map(row => `inventory_document_line:${row._id}`),
      ...movements.map(row => `inventory_movement:${row._id}`), ...balanceIds.map(id => `inventory_balance:${id}`)]);
    const pending = await allDirect<Row>("SELECT * FROM sync_queue WHERE companyId = ? AND synced = 0 AND entity IN ('inventory_document','inventory_document_line','inventory_movement','inventory_balance')", [companyId]);
    const captured = pending.filter(row => ids.has(`${row.entity}:${row.entityId}`));
    if (!queued) await addToSyncQueue({ companyId, entity: "inventory_transaction", entityId: documentId, operation: "create",
      payload: JSON.stringify({ _id: documentId, companyId, updatedAt: document.updatedAt, document, lines, movements, balanceIds }) }, true);
    // Rows remain stored for historical recovery; the new aggregate is now durable.
    for (const row of captured) await runDirect("UPDATE sync_queue SET synced = 1 WHERE companyId = ? AND _id = ?", [companyId, row._id]);
    afterCommit(() => { void notifyPendingChanges(companyId); });
  });
}

export async function recoverStockOperations(companyId: string) {
  const documents = await all<{ _id: string }>("SELECT _id FROM inventory_documents WHERE companyId = ? AND synced = 0 AND status = 'POSTED' AND COALESCE(referenceType, '') != 'OPENING_STOCK'", [companyId]);
  for (const document of documents) await queuePostedDocument(companyId, document._id);
}

export async function acknowledgeStockOperation(companyId: string, data: StockOperation, queueId: string) {
  await transaction(async () => {
  await runDirect("UPDATE sync_queue SET synced = 1 WHERE companyId = ? AND entity = 'inventory_transaction' AND entityId = ? AND _id = ?", [companyId, data._id, queueId]);
  for (const [table, rows] of [
    ["inventory_documents", [data.document]], ["inventory_document_lines", data.lines], ["inventory_movements", data.movements],
  ] as Array<[string, Row[]]>) {
    for (const row of rows) await runDirect(`UPDATE ${table} SET synced = 1 WHERE companyId = ? AND _id = ? AND updatedAt = ?`, [companyId, row._id, row.updatedAt]);
  }
  if (await getDirect("SELECT 1 FROM sync_queue WHERE companyId = ? AND entity = 'inventory_transaction' AND synced = 0 LIMIT 1", [companyId])) return;
  const accepted = await allDirect<{ payload: string }>("SELECT payload FROM sync_queue WHERE companyId = ? AND entity = 'inventory_transaction' AND synced = 1", [companyId]);
  for (const entry of accepted) {
    for (const id of JSON.parse(entry.payload).balanceIds ?? []) await runDirect(`UPDATE inventory_balances SET synced = 1 WHERE companyId = ? AND _id = ?
      AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE companyId = ? AND entity = 'inventory_balance' AND entityId = ? AND synced = 0)`, [companyId, id, companyId, id]);
  }
  });
}
