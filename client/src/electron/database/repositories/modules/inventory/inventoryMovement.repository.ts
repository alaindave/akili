import type { InventoryMovement } from "../../../../../common/types/inventory/InventoryMovement.js";
import { all, get, run } from "../../../db.js";

export interface InventoryMovementListOptions {
  itemId?: string;
  warehouseId?: string;
  locationId?: string;
  lotId?: string;
  serialNumber?: string;
  documentId?: string;
  documentLineId?: string;
  movementType?: InventoryMovement["movementType"];
  direction?: InventoryMovement["direction"];
  referenceType?: string;
  referenceId?: string;
  fromDate?: string;
  toDate?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export class InventoryMovementRepository {
  // ---------------------------------------------------------------------------
  // GET BY ID
  // ---------------------------------------------------------------------------

  async getById(
    companyId: string,
    id: string
  ): Promise<InventoryMovement | null> {
    return get<InventoryMovement | null>(
      `
        SELECT *
        FROM inventory_movements
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
    _id: string
  ): Promise<InventoryMovement | null> {
    return get<InventoryMovement | null>(
      `
        SELECT *
        FROM inventory_movements
        WHERE companyId = ?
          AND _id = ?
        LIMIT 1
      `,
      [companyId, _id]
    );
  }

  // ---------------------------------------------------------------------------
  // GET BY MOVEMENT ID
  // ---------------------------------------------------------------------------

  async getByMovementId(
    companyId: string,
    movementId: string
  ): Promise<InventoryMovement | null> {
    return get<InventoryMovement | null>(
      `
        SELECT *
        FROM inventory_movements
        WHERE companyId = ?
          AND movementId = ?
          AND isDeleted = 0
        LIMIT 1
      `,
      [companyId, movementId]
    );
  }

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  async list(
    companyId: string,
    options: InventoryMovementListOptions = {}
  ): Promise<InventoryMovement[]> {
    const {
      itemId,
      warehouseId,
      locationId,
      lotId,
      serialNumber,
      documentId,
      documentLineId,
      movementType,
      direction,
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

    if (itemId) {
      conditions.push("itemId = ?");
      params.push(itemId);
    }

    if (warehouseId) {
      conditions.push("warehouseId = ?");
      params.push(warehouseId);
    }

    if (locationId) {
      conditions.push("locationId = ?");
      params.push(locationId);
    }

    if (lotId) {
      conditions.push("lotId = ?");
      params.push(lotId);
    }

    if (serialNumber) {
      conditions.push("serialNumber = ?");
      params.push(serialNumber);
    }

    if (documentId) {
      conditions.push("documentId = ?");
      params.push(documentId);
    }

    if (documentLineId) {
      conditions.push("documentLineId = ?");
      params.push(documentLineId);
    }

    if (movementType) {
      conditions.push("movementType = ?");
      params.push(movementType);
    }

    if (direction) {
      conditions.push("direction = ?");
      params.push(direction);
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
      conditions.push("occurredAt >= ?");
      params.push(fromDate);
    }

    if (toDate) {
      conditions.push("occurredAt <= ?");
      params.push(toDate);
    }

    params.push(limit, offset);

    return all<InventoryMovement>(
      `
        SELECT *
        FROM inventory_movements
        WHERE ${conditions.join(" AND ")}
        ORDER BY occurredAt DESC, createdAt DESC
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
    options: Omit<InventoryMovementListOptions, "limit" | "offset"> = {}
  ): Promise<number> {
    const {
      itemId,
      warehouseId,
      locationId,
      lotId,
      serialNumber,
      documentId,
      documentLineId,
      movementType,
      direction,
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

    if (itemId) {
      conditions.push("itemId = ?");
      params.push(itemId);
    }

    if (warehouseId) {
      conditions.push("warehouseId = ?");
      params.push(warehouseId);
    }

    if (locationId) {
      conditions.push("locationId = ?");
      params.push(locationId);
    }

    if (lotId) {
      conditions.push("lotId = ?");
      params.push(lotId);
    }

    if (serialNumber) {
      conditions.push("serialNumber = ?");
      params.push(serialNumber);
    }

    if (documentId) {
      conditions.push("documentId = ?");
      params.push(documentId);
    }

    if (documentLineId) {
      conditions.push("documentLineId = ?");
      params.push(documentLineId);
    }

    if (movementType) {
      conditions.push("movementType = ?");
      params.push(movementType);
    }

    if (direction) {
      conditions.push("direction = ?");
      params.push(direction);
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
      conditions.push("occurredAt >= ?");
      params.push(fromDate);
    }

    if (toDate) {
      conditions.push("occurredAt <= ?");
      params.push(toDate);
    }

    const result = await get<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM inventory_movements
        WHERE ${conditions.join(" AND ")}
      `,
      params
    );

    return result?.count ?? 0;
  }

  // ---------------------------------------------------------------------------
  // DOCUMENT
  // ---------------------------------------------------------------------------

  async getByDocument(
    companyId: string,
    documentId: string
  ): Promise<InventoryMovement[]> {
    return all<InventoryMovement>(
      `
        SELECT *
        FROM inventory_movements
        WHERE companyId = ?
          AND documentId = ?
          AND isDeleted = 0
        ORDER BY createdAt ASC
      `,
      [companyId, documentId]
    );
  }

  async getByDocumentLine(
    companyId: string,
    documentLineId: string
  ): Promise<InventoryMovement[]> {
    return all<InventoryMovement>(
      `
        SELECT *
        FROM inventory_movements
        WHERE companyId = ?
          AND documentLineId = ?
          AND isDeleted = 0
        ORDER BY createdAt ASC
      `,
      [companyId, documentLineId]
    );
  }

  // ---------------------------------------------------------------------------
  // ITEM HISTORY
  // ---------------------------------------------------------------------------

  async getItemHistory(
    companyId: string,
    itemId: string,
    limit = 100,
    offset = 0
  ): Promise<InventoryMovement[]> {
    return all<InventoryMovement>(
      `
        SELECT *
        FROM inventory_movements
        WHERE companyId = ?
          AND itemId = ?
          AND isDeleted = 0
        ORDER BY occurredAt DESC, createdAt DESC
        LIMIT ?
        OFFSET ?
      `,
      [companyId, itemId, limit, offset]
    );
  }

  // ---------------------------------------------------------------------------
  // WAREHOUSE HISTORY
  // ---------------------------------------------------------------------------

  async getWarehouseHistory(
    companyId: string,
    warehouseId: string,
    limit = 100,
    offset = 0
  ): Promise<InventoryMovement[]> {
    return all<InventoryMovement>(
      `
        SELECT *
        FROM inventory_movements
        WHERE companyId = ?
          AND warehouseId = ?
          AND isDeleted = 0
        ORDER BY occurredAt DESC, createdAt DESC
        LIMIT ?
        OFFSET ?
      `,
      [companyId, warehouseId, limit, offset]
    );
  }

  // ---------------------------------------------------------------------------
  // LOT HISTORY
  // ---------------------------------------------------------------------------

  async getLotHistory(
    companyId: string,
    itemId: string,
    lotId: string,
    limit = 100,
    offset = 0
  ): Promise<InventoryMovement[]> {
    return all<InventoryMovement>(
      `
        SELECT *
        FROM inventory_movements
        WHERE companyId = ?
          AND itemId = ?
          AND lotId = ?
          AND isDeleted = 0
        ORDER BY occurredAt DESC, createdAt DESC
        LIMIT ?
        OFFSET ?
      `,
      [companyId, itemId, lotId, limit, offset]
    );
  }

  // ---------------------------------------------------------------------------
  // SERIAL HISTORY
  // ---------------------------------------------------------------------------

  async getSerialHistory(
    companyId: string,
    itemId: string,
    serialNumber: string
  ): Promise<InventoryMovement[]> {
    return all<InventoryMovement>(
      `
        SELECT *
        FROM inventory_movements
        WHERE companyId = ?
          AND itemId = ?
          AND serialNumber = ?
          AND isDeleted = 0
        ORDER BY occurredAt ASC, createdAt ASC
      `,
      [companyId, itemId, serialNumber]
    );
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(movement: InventoryMovement): Promise<void> {
    await run(
      `
        INSERT INTO inventory_movements (
          _id,
          companyId,
          movementId,
          documentId,
          documentLineId,
          itemId,
          warehouseId,
          locationId,
          lotId,
          serialNumber,
          quantity,
          unitId,
          direction,
          unitCost,
          totalCost,
          movementType,
          occurredAt,
          referenceType,
          referenceId,
          createdAt,
          updatedAt,
          serverVersion,
          synced,
          isDeleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        movement._id,
        movement.companyId,
        movement.movementId,
        movement.documentId,
        movement.documentLineId,
        movement.itemId,
        movement.warehouseId,
        movement.locationId ?? null,
        movement.lotId ?? null,
        movement.serialNumber ?? null,
        movement.quantity,
        movement.unitId,
        movement.direction,
        movement.unitCost ?? null,
        movement.totalCost ?? null,
        movement.movementType,
        movement.occurredAt,
        movement.referenceType ?? null,
        movement.referenceId ?? null,
        movement.createdAt,
        movement.updatedAt,
        movement.serverVersion,
        movement.synced ? 1 : 0,
        movement.isDeleted ? 1 : 0,
      ]
    );
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(movement: InventoryMovement): Promise<void> {
    await run(
      `
        UPDATE inventory_movements
        SET
          documentId = ?,
          documentLineId = ?,
          itemId = ?,
          warehouseId = ?,
          locationId = ?,
          lotId = ?,
          serialNumber = ?,
          quantity = ?,
          unitId = ?,
          direction = ?,
          unitCost = ?,
          totalCost = ?,
          movementType = ?,
          occurredAt = ?,
          referenceType = ?,
          referenceId = ?,
          updatedAt = ?,
          serverVersion = ?,
          synced = ?,
          isDeleted = ?
        WHERE companyId = ?
          AND _id = ?
      `,
      [
        movement.documentId,
        movement.documentLineId,
        movement.itemId,
        movement.warehouseId,
        movement.locationId ?? null,
        movement.lotId ?? null,
        movement.serialNumber ?? null,
        movement.quantity,
        movement.unitId,
        movement.direction,
        movement.unitCost ?? null,
        movement.totalCost ?? null,
        movement.movementType,
        movement.occurredAt,
        movement.referenceType ?? null,
        movement.referenceId ?? null,
        movement.updatedAt,
        movement.serverVersion,
        movement.synced ? 1 : 0,
        movement.isDeleted ? 1 : 0,
        movement.companyId,
        movement._id,
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
        InventoryMovement,
        | "quantity"
        | "unitCost"
        | "totalCost"
        | "occurredAt"
        | "referenceType"
        | "referenceId"
      >
    >
  ): Promise<void> {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.quantity !== undefined) {
      fields.push("quantity = ?");
      params.push(data.quantity);
    }

    if (data.unitCost !== undefined) {
      fields.push("unitCost = ?");
      params.push(data.unitCost);
    }

    if (data.totalCost !== undefined) {
      fields.push("totalCost = ?");
      params.push(data.totalCost);
    }

    if (data.occurredAt !== undefined) {
      fields.push("occurredAt = ?");
      params.push(data.occurredAt);
    }

    if (data.referenceType !== undefined) {
      fields.push("referenceType = ?");
      params.push(data.referenceType);
    }

    if (data.referenceId !== undefined) {
      fields.push("referenceId = ?");
      params.push(data.referenceId);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push("synced = 0");

    params.push(companyId, id);

    await run(
      `
        UPDATE inventory_movements
        SET ${fields.join(", ")}
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      params
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
        UPDATE inventory_movements
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
        UPDATE inventory_movements
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
  ): Promise<InventoryMovement[]> {
    return all<InventoryMovement>(
      `
        SELECT *
        FROM inventory_movements
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
        UPDATE inventory_movements
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
  ): Promise<InventoryMovement[]> {
    return all<InventoryMovement>(
      `
        SELECT *
        FROM inventory_movements
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
        DELETE FROM inventory_movements
        WHERE companyId = ?
          AND _id = ?
      `,
      [companyId, id]
    );
  }
}
