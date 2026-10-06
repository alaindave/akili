import type {
  InventoryDocument,
  InventoryDocumentStatus,
  InventoryDocumentType,
} from "../../../../../common/types/inventory/InventoryDocument.js";
import { all, get, run } from "../../../db.js";

export interface InventoryDocumentListOptions {
  type?: InventoryDocumentType;
  status?: InventoryDocumentStatus;
  warehouseId?: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  referenceType?: string;
  referenceId?: string;
  fromDate?: string;
  toDate?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export class InventoryDocumentRepository {
  // ---------------------------------------------------------------------------
  // GET BY ID
  // ---------------------------------------------------------------------------

  async getById(
    companyId: string,
    id: string
  ): Promise<InventoryDocument | null> {
    return get<InventoryDocument | null>(
      `
        SELECT *
        FROM inventory_documents
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
        LIMIT 1
      `,
      [companyId, id]
    );
  }

  async getByIdIncludingDeleted(
    companyId: string,
    id: string
  ): Promise<InventoryDocument | null> {
    return get<InventoryDocument | null>(
      `
        SELECT *
        FROM inventory_documents
        WHERE companyId = ?
          AND _id = ?
        LIMIT 1
      `,
      [companyId, id]
    );
  }

  // ---------------------------------------------------------------------------
  // GET BY DOCUMENT NUMBER
  // ---------------------------------------------------------------------------

  async getByDocumentNumber(
    companyId: string,
    documentNumber: string
  ): Promise<InventoryDocument | null> {
    return get<InventoryDocument | null>(
      `
        SELECT *
        FROM inventory_documents
        WHERE companyId = ?
          AND documentNumber = ?
          AND isDeleted = 0
        LIMIT 1
      `,
      [companyId, documentNumber]
    );
  }

  async documentNumberExists(
    companyId: string,
    documentNumber: string,
    excludeId?: string
  ): Promise<boolean> {
    let sql = `
      SELECT 1 AS found
      FROM inventory_documents
      WHERE companyId = ?
        AND documentNumber = ?
        AND isDeleted = 0
    `;

    const params: unknown[] = [companyId, documentNumber];

    if (excludeId) {
      sql += ` AND _id != ?`;
      params.push(excludeId);
    }

    sql += ` LIMIT 1`;

    const result = await get<{ found: number }>(sql, params);

    return result !== undefined && result !== null;
  }

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  async list(
    companyId: string,
    options: InventoryDocumentListOptions = {}
  ): Promise<InventoryDocument[]> {
    const {
      type,
      status,
      warehouseId,
      sourceWarehouseId,
      destinationWarehouseId,
      referenceType,
      referenceId,
      fromDate,
      toDate,
      includeDeleted = false,
      limit = 100,
      offset = 0,
    } = options;

    const conditions: string[] = ["companyId = ?"];

    const params: unknown[] = [companyId];

    if (!includeDeleted) {
      conditions.push("isDeleted = 0");
    }

    if (type) {
      conditions.push("type = ?");
      params.push(type);
    }

    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }

    if (warehouseId) {
      conditions.push("warehouseId = ?");
      params.push(warehouseId);
    }

    if (sourceWarehouseId) {
      conditions.push("sourceWarehouseId = ?");
      params.push(sourceWarehouseId);
    }

    if (destinationWarehouseId) {
      conditions.push("destinationWarehouseId = ?");
      params.push(destinationWarehouseId);
    }

    if (referenceType) {
      conditions.push("referenceType = ?");
      params.push(referenceType);
    }

    if (referenceId) {
      conditions.push("referenceId = ?");
      params.push(referenceId);
    }

    if (fromDate) {
      conditions.push("documentDate >= ?");
      params.push(fromDate);
    }

    if (toDate) {
      conditions.push("documentDate <= ?");
      params.push(toDate);
    }

    params.push(limit, offset);

    return all<InventoryDocument>(
      `
        SELECT *
        FROM inventory_documents
        WHERE ${conditions.join(" AND ")}
        ORDER BY documentDate DESC, createdAt DESC
        LIMIT ?
        OFFSET ?
      `,
      params
    );
  }

  // ---------------------------------------------------------------------------
  // COUNT
  // ---------------------------------------------------------------------------

  async count(
    companyId: string,
    options: Omit<InventoryDocumentListOptions, "limit" | "offset"> = {}
  ): Promise<number> {
    const {
      type,
      status,
      warehouseId,
      sourceWarehouseId,
      destinationWarehouseId,
      referenceType,
      referenceId,
      fromDate,
      toDate,
      includeDeleted = false,
    } = options;

    const conditions: string[] = ["companyId = ?"];

    const params: unknown[] = [companyId];

    if (!includeDeleted) {
      conditions.push("isDeleted = 0");
    }

    if (type) {
      conditions.push("type = ?");
      params.push(type);
    }

    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }

    if (warehouseId) {
      conditions.push("warehouseId = ?");
      params.push(warehouseId);
    }

    if (sourceWarehouseId) {
      conditions.push("sourceWarehouseId = ?");
      params.push(sourceWarehouseId);
    }

    if (destinationWarehouseId) {
      conditions.push("destinationWarehouseId = ?");
      params.push(destinationWarehouseId);
    }

    if (referenceType) {
      conditions.push("referenceType = ?");
      params.push(referenceType);
    }

    if (referenceId) {
      conditions.push("referenceId = ?");
      params.push(referenceId);
    }

    if (fromDate) {
      conditions.push("documentDate >= ?");
      params.push(fromDate);
    }

    if (toDate) {
      conditions.push("documentDate <= ?");
      params.push(toDate);
    }

    const result = await get<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM inventory_documents
        WHERE ${conditions.join(" AND ")}
      `,
      params
    );

    return result?.count ?? 0;
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(document: InventoryDocument): Promise<void> {
    await run(
      `
        INSERT INTO inventory_documents (
          _id,
          companyId,
          documentNumber,
          type,
          status,
          warehouseId,
          sourceWarehouseId,
          destinationWarehouseId,
          referenceType,
          referenceId,
          reason,
          documentDate,
          postedAt,
          postedBy,
          cancelledAt,
          cancelledBy,
          notes,
          customFields,
          createdAt,
          updatedAt,
          serverVersion,
          synced,
          isDeleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        document._id,
        document.companyId,
        document.documentNumber,
        document.type,
        document.status,
        document.warehouseId ?? null,
        document.sourceWarehouseId ?? null,
        document.destinationWarehouseId ?? null,
        document.referenceType ?? null,
        document.referenceId ?? null,
        document.reason ?? null,
        document.documentDate,
        document.postedAt ?? null,
        document.postedBy ?? null,
        document.cancelledAt ?? null,
        document.cancelledBy ?? null,
        document.notes ?? null,
        document.customFields ? JSON.stringify(document.customFields) : null,
        document.createdAt,
        document.updatedAt,
        document.serverVersion,
        document.synced ? 1 : 0,
        document.isDeleted ? 1 : 0,
      ]
    );
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(document: InventoryDocument): Promise<void> {
    await run(
      `
        UPDATE inventory_documents
        SET
          documentNumber = ?,
          type = ?,
          status = ?,
          warehouseId = ?,
          sourceWarehouseId = ?,
          destinationWarehouseId = ?,
          referenceType = ?,
          referenceId = ?,
          reason = ?,
          documentDate = ?,
          postedAt = ?,
          postedBy = ?,
          cancelledAt = ?,
          cancelledBy = ?,
          notes = ?,
          customFields = ?,
          updatedAt = ?,
          serverVersion = ?,
          synced = ?,
          isDeleted = ?
        WHERE companyId = ?
          AND _id = ?
      `,
      [
        document.documentNumber,
        document.type,
        document.status,
        document.warehouseId ?? null,
        document.sourceWarehouseId ?? null,
        document.destinationWarehouseId ?? null,
        document.referenceType ?? null,
        document.referenceId ?? null,
        document.reason ?? null,
        document.documentDate,
        document.postedAt ?? null,
        document.postedBy ?? null,
        document.cancelledAt ?? null,
        document.cancelledBy ?? null,
        document.notes ?? null,
        document.customFields ? JSON.stringify(document.customFields) : null,
        document.updatedAt,
        document.serverVersion,
        document.synced ? 1 : 0,
        document.isDeleted ? 1 : 0,
        document.companyId,
        document._id,
      ]
    );
  }

  // ---------------------------------------------------------------------------
  // LOCAL UPDATE
  // ---------------------------------------------------------------------------

  async updateLocal(
    companyId: string,
    id: string,
    data: Partial<
      Pick<
        InventoryDocument,
        | "documentNumber"
        | "type"
        | "warehouseId"
        | "sourceWarehouseId"
        | "destinationWarehouseId"
        | "referenceType"
        | "referenceId"
        | "reason"
        | "documentDate"
        | "notes"
        | "customFields"
      >
    >,
    updatedAt: string
  ): Promise<void> {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.documentNumber !== undefined) {
      fields.push("documentNumber = ?");
      params.push(data.documentNumber);
    }

    if (data.type !== undefined) {
      fields.push("type = ?");
      params.push(data.type);
    }

    if (data.warehouseId !== undefined) {
      fields.push("warehouseId = ?");
      params.push(data.warehouseId);
    }

    if (data.sourceWarehouseId !== undefined) {
      fields.push("sourceWarehouseId = ?");
      params.push(data.sourceWarehouseId);
    }

    if (data.destinationWarehouseId !== undefined) {
      fields.push("destinationWarehouseId = ?");
      params.push(data.destinationWarehouseId);
    }

    if (data.referenceType !== undefined) {
      fields.push("referenceType = ?");
      params.push(data.referenceType);
    }

    if (data.referenceId !== undefined) {
      fields.push("referenceId = ?");
      params.push(data.referenceId);
    }

    if (data.reason !== undefined) {
      fields.push("reason = ?");
      params.push(data.reason);
    }

    if (data.documentDate !== undefined) {
      fields.push("documentDate = ?");
      params.push(data.documentDate);
    }

    if (data.notes !== undefined) {
      fields.push("notes = ?");
      params.push(data.notes);
    }

    if (data.customFields !== undefined) {
      fields.push("customFields = ?");
      params.push(data.customFields ? JSON.stringify(data.customFields) : null);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push("updatedAt = ?");
    params.push(updatedAt);

    fields.push("synced = 0");

    params.push(companyId, id);

    await run(
      `
        UPDATE inventory_documents
        SET ${fields.join(", ")}
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      params
    );
  }

  // ---------------------------------------------------------------------------
  // STATUS
  // ---------------------------------------------------------------------------

  async updateStatus(
    companyId: string,
    id: string,
    status: InventoryDocumentStatus,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_documents
        SET
          status = ?,
          updatedAt = ?,
          synced = 0
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [status, updatedAt, companyId, id]
    );
  }

  // ---------------------------------------------------------------------------
  // POST
  // ---------------------------------------------------------------------------

  async markPosted(
    companyId: string,
    id: string,
    postedAt: string,
    postedBy: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_documents
        SET
          status = 'POSTED',
          postedAt = ?,
          postedBy = ?,
          updatedAt = ?,
          synced = 0
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [postedAt, postedBy, updatedAt, companyId, id]
    );
  }

  // ---------------------------------------------------------------------------
  // CANCEL
  // ---------------------------------------------------------------------------

  async markCancelled(
    companyId: string,
    id: string,
    cancelledAt: string,
    cancelledBy: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_documents
        SET
          status = 'CANCELLED',
          cancelledAt = ?,
          cancelledBy = ?,
          updatedAt = ?,
          synced = 0
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [cancelledAt, cancelledBy, updatedAt, companyId, id]
    );
  }

  // ---------------------------------------------------------------------------
  // SOFT DELETE
  // ---------------------------------------------------------------------------

  async softDelete(
    companyId: string,
    id: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_documents
        SET
          isDeleted = 1,
          synced = 0,
          updatedAt = ?
        WHERE companyId = ?
          AND _id = ?
      `,
      [updatedAt, companyId, id]
    );
  }

  // ---------------------------------------------------------------------------
  // RESTORE
  // ---------------------------------------------------------------------------

  async restore(
    companyId: string,
    id: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_documents
        SET
          isDeleted = 0,
          synced = 0,
          updatedAt = ?
        WHERE companyId = ?
          AND _id = ?
      `,
      [updatedAt, companyId, id]
    );
  }

  // ---------------------------------------------------------------------------
  // SYNC
  // ---------------------------------------------------------------------------

  async getUnsynced(
    companyId: string,
    limit = 100
  ): Promise<InventoryDocument[]> {
    return all<InventoryDocument>(
      `
        SELECT *
        FROM inventory_documents
        WHERE companyId = ?
          AND synced = 0
        ORDER BY updatedAt ASC
        LIMIT ?
      `,
      [companyId, limit]
    );
  }

  async markSynced(
    companyId: string,
    id: string,
    serverVersion: number
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_documents
        SET
          synced = 1,
          serverVersion = ?
        WHERE companyId = ?
          AND _id = ?
      `,
      [serverVersion, companyId, id]
    );
  }

  async getChangedSince(
    companyId: string,
    serverVersion: number,
    limit = 100
  ): Promise<InventoryDocument[]> {
    return all<InventoryDocument>(
      `
        SELECT *
        FROM inventory_documents
        WHERE companyId = ?
          AND serverVersion > ?
        ORDER BY serverVersion ASC
        LIMIT ?
      `,
      [companyId, serverVersion, limit]
    );
  }

  // ---------------------------------------------------------------------------
  // HARD DELETE
  // ---------------------------------------------------------------------------

  async hardDelete(companyId: string, id: string): Promise<void> {
    await run(
      `
        DELETE FROM inventory_documents
        WHERE companyId = ?
          AND _id = ?
      `,
      [companyId, id]
    );
  }
}
