import { InventoryBase } from "../../../../../common/types/inventory/InventoryBase.js";
import { all, get, run } from "../../../db.js";

export interface InventoryDocumentLine extends InventoryBase {
  documentId: string;
  lineNumber: number;
  itemId: string;
  quantity: number;
  unitId: string;
  unitCost?: number;
  warehouseId?: string;
  locationId?: string;
  lotId?: string;
  serialNumber?: string;
  description?: string;
  customFields?: Record<string, unknown>;
}

export interface InventoryDocumentLineListOptions {
  documentId?: string;
  itemId?: string;
  warehouseId?: string;
  locationId?: string;
  lotId?: string;
  serialNumber?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateInventoryDocumentLineInput {
  _id: string;
  companyId: string;
  documentId: string;
  lineNumber: number;
  itemId: string;
  quantity: number;
  unitId: string;
  unitCost?: number;
  warehouseId?: string;
  locationId?: string;
  lotId?: string;
  serialNumber?: string;
  description?: string;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  serverVersion?: number;
  synced?: boolean;
  isDeleted?: boolean;
}

export interface UpdateInventoryDocumentLineInput {
  lineNumber?: number;
  itemId?: string;
  quantity?: number;
  unitId?: string;
  unitCost?: number | null;
  warehouseId?: string | null;
  locationId?: string | null;
  lotId?: string | null;
  serialNumber?: string | null;
  description?: string | null;
  customFields?: Record<string, unknown> | null;
  updatedAt: string;
}

export class InventoryDocumentLineRepository {
  /**
   * Get a line by ID.
   */
  async getById(
    companyId: string,
    id: string
  ): Promise<InventoryDocumentLine | null> {
    const row = await get<InventoryDocumentLineRow>(
      `
        SELECT *
        FROM inventory_document_lines
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
        LIMIT 1
      `,
      [companyId, id]
    );

    return row ? this.mapRow(row) : null;
  }

  /**
   * Get a line by ID, including soft-deleted records.
   */
  async getByIdIncludingDeleted(
    companyId: string,
    id: string
  ): Promise<InventoryDocumentLine | null> {
    const row = await get<InventoryDocumentLineRow>(
      `
        SELECT *
        FROM inventory_document_lines
        WHERE companyId = ?
          AND _id = ?
        LIMIT 1
      `,
      [companyId, id]
    );

    return row ? this.mapRow(row) : null;
  }

  /**
   * Get all lines belonging to a document.
   *
   * Ordered by lineNumber so the result can be used directly
   * to render the document.
   */
  async getByDocument(
    companyId: string,
    documentId: string,
    includeDeleted = false
  ): Promise<InventoryDocumentLine[]> {
    const rows = await all<InventoryDocumentLineRow>(
      `
        SELECT *
        FROM inventory_document_lines
        WHERE companyId = ?
          AND documentId = ?
          ${includeDeleted ? "" : "AND isDeleted = 0"}
        ORDER BY lineNumber ASC
      `,
      [companyId, documentId]
    );

    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Get a specific line number within a document.
   */
  async getByDocumentAndLineNumber(
    companyId: string,
    documentId: string,
    lineNumber: number
  ): Promise<InventoryDocumentLine | null> {
    const row = await get<InventoryDocumentLineRow>(
      `
        SELECT *
        FROM inventory_document_lines
        WHERE companyId = ?
          AND documentId = ?
          AND lineNumber = ?
          AND isDeleted = 0
        LIMIT 1
      `,
      [companyId, documentId, lineNumber]
    );

    return row ? this.mapRow(row) : null;
  }

  async lineNumberExists(
    companyId: string,
    documentId: string,
    lineNumber: number,
    excludeId?: string
  ): Promise<boolean> {
    const row = await get<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM inventory_document_lines
        WHERE companyId = ?
          AND documentId = ?
          AND lineNumber = ?
          AND isDeleted = 0
          ${excludeId ? "AND _id != ?" : ""}
      `,
      excludeId
        ? [companyId, documentId, lineNumber, excludeId]
        : [companyId, documentId, lineNumber]
    );

    return (row?.count ?? 0) > 0;
  }

  /**
   * Get the next available line number for a document.
   */
  async getNextLineNumber(
    companyId: string,
    documentId: string
  ): Promise<number> {
    const row = await get<{ maxLineNumber: number | null }>(
      `
        SELECT MAX(lineNumber) AS maxLineNumber
        FROM inventory_document_lines
        WHERE companyId = ?
          AND documentId = ?
          AND isDeleted = 0
      `,
      [companyId, documentId]
    );

    return (row?.maxLineNumber ?? 0) + 1;
  }

  async getNextLineNumberIncludingDeleted(
    companyId: string,
    documentId: string
  ): Promise<number> {
    const row = await get<{ maxLineNumber: number | null }>(
      `
        SELECT MAX(lineNumber) AS maxLineNumber
        FROM inventory_document_lines
        WHERE companyId = ?
          AND documentId = ?
      `,
      [companyId, documentId]
    );

    return (row?.maxLineNumber ?? 0) + 1;
  }

  /**
   * List document lines with filters.
   */
  async list(
    companyId: string,
    options: InventoryDocumentLineListOptions = {}
  ): Promise<InventoryDocumentLine[]> {
    const {
      documentId,
      itemId,
      warehouseId,
      locationId,
      lotId,
      serialNumber,
      includeDeleted = false,
      limit = 100,
      offset = 0,
    } = options;

    const conditions: string[] = ["companyId = ?"];
    const params: unknown[] = [companyId];

    if (!includeDeleted) {
      conditions.push("isDeleted = 0");
    }

    if (documentId) {
      conditions.push("documentId = ?");
      params.push(documentId);
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

    const rows = await all<InventoryDocumentLineRow>(
      `
        SELECT *
        FROM inventory_document_lines
        WHERE ${conditions.join(" AND ")}
        ORDER BY documentId ASC, lineNumber ASC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Count document lines.
   */
  async count(
    companyId: string,
    options: Omit<InventoryDocumentLineListOptions, "limit" | "offset"> = {}
  ): Promise<number> {
    const {
      documentId,
      itemId,
      warehouseId,
      locationId,
      lotId,
      serialNumber,
      includeDeleted = false,
    } = options;

    const conditions: string[] = ["companyId = ?"];
    const params: unknown[] = [companyId];

    if (!includeDeleted) {
      conditions.push("isDeleted = 0");
    }

    if (documentId) {
      conditions.push("documentId = ?");
      params.push(documentId);
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

    const row = await get<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM inventory_document_lines
        WHERE ${conditions.join(" AND ")}
      `,
      params
    );

    return row?.count ?? 0;
  }

  /**
   * Create a document line.
   */
  async create(
    line: CreateInventoryDocumentLineInput
  ): Promise<InventoryDocumentLine> {
    await run(
      `
        INSERT INTO inventory_document_lines (
          _id,
          companyId,
          documentId,
          lineNumber,
          itemId,
          quantity,
          unitId,
          unitCost,
          warehouseId,
          locationId,
          lotId,
          serialNumber,
          description,
          customFields,
          createdAt,
          updatedAt,
          serverVersion,
          synced,
          isDeleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        line._id,
        line.companyId,
        line.documentId,
        line.lineNumber,
        line.itemId,
        line.quantity,
        line.unitId,
        line.unitCost ?? null,
        line.warehouseId ?? null,
        line.locationId ?? null,
        line.lotId ?? null,
        line.serialNumber ?? null,
        line.description ?? null,
        line.customFields ? JSON.stringify(line.customFields) : null,
        line.createdAt,
        line.updatedAt,
        line.serverVersion ?? 0,
        line.synced ? 1 : 0,
        line.isDeleted ? 1 : 0,
      ]
    );

    const created = await this.getByIdIncludingDeleted(
      line.companyId,
      line._id
    );

    if (!created) {
      throw new Error(
        `Failed to retrieve created inventory document line: ${line._id}`
      );
    }

    return created;
  }

  async update(
    companyId: string,
    _id: string,
    data: UpdateInventoryDocumentLineInput
  ): Promise<InventoryDocumentLine> {
    const existing = await this.getByIdIncludingDeleted(companyId, _id);

    if (!existing) {
      throw new Error(`Inventory document line not found: ${_id}`);
    }

    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.lineNumber !== undefined) {
      fields.push("lineNumber = ?");
      params.push(data.lineNumber);
    }

    if (data.itemId !== undefined) {
      fields.push("itemId = ?");
      params.push(data.itemId);
    }

    if (data.quantity !== undefined) {
      fields.push("quantity = ?");
      params.push(data.quantity);
    }

    if (data.unitId !== undefined) {
      fields.push("unitId = ?");
      params.push(data.unitId);
    }

    if (data.unitCost !== undefined) {
      fields.push("unitCost = ?");
      params.push(data.unitCost);
    }

    if (data.warehouseId !== undefined) {
      fields.push("warehouseId = ?");
      params.push(data.warehouseId);
    }

    if (data.locationId !== undefined) {
      fields.push("locationId = ?");
      params.push(data.locationId);
    }

    if (data.lotId !== undefined) {
      fields.push("lotId = ?");
      params.push(data.lotId);
    }

    if (data.serialNumber !== undefined) {
      fields.push("serialNumber = ?");
      params.push(data.serialNumber);
    }

    if (data.description !== undefined) {
      fields.push("description = ?");
      params.push(data.description);
    }

    if (data.customFields !== undefined) {
      fields.push("customFields = ?");
      params.push(
        data.customFields === null ? null : JSON.stringify(data.customFields)
      );
    }

    fields.push("updatedAt = ?");
    params.push(data.updatedAt);

    fields.push("synced = 0");

    params.push(companyId, _id);

    await run(
      `
        UPDATE inventory_document_lines
        SET ${fields.join(", ")}
        WHERE companyId = ?
          AND _id = ?
      `,
      params
    );

    const updated = await this.getByIdIncludingDeleted(companyId, _id);

    if (!updated) {
      throw new Error(
        `Failed to retrieve updated inventory document line: ${_id}`
      );
    }

    return updated;
  }

  async updateLocal(
    companyId: string,
    _id: string,
    data: Partial<Omit<UpdateInventoryDocumentLineInput, "updatedAt">>,
    updatedAt: string
  ): Promise<InventoryDocumentLine> {
    return this.update(companyId, _id, {
      ...data,
      updatedAt,
    });
  }

  async softDelete(
    companyId: string,
    _id: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_document_lines
        SET
          isDeleted = 1,
          synced = 0,
          updatedAt = ?
        WHERE companyId = ?
          AND _id = ?
      `,
      [updatedAt, companyId, _id]
    );
  }

  async restore(
    companyId: string,
    _id: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_document_lines
        SET
          isDeleted = 0,
          synced = 0,
          updatedAt = ?
        WHERE companyId = ?
          AND _id = ?
      `,
      [updatedAt, companyId, _id]
    );
  }

  async getUnsynced(
    companyId: string,
    limit = 100
  ): Promise<InventoryDocumentLine[]> {
    const rows = await all<InventoryDocumentLineRow>(
      `
        SELECT *
        FROM inventory_document_lines
        WHERE companyId = ?
          AND synced = 0
        ORDER BY updatedAt ASC
        LIMIT ?
      `,
      [companyId, limit]
    );

    return rows.map((row) => this.mapRow(row));
  }

  async markSynced(
    companyId: string,
    id: string,
    serverVersion: number
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_document_lines
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
  ): Promise<InventoryDocumentLine[]> {
    const rows = await all<InventoryDocumentLineRow>(
      `
        SELECT *
        FROM inventory_document_lines
        WHERE companyId = ?
          AND serverVersion > ?
        ORDER BY serverVersion ASC
        LIMIT ?
      `,
      [companyId, serverVersion, limit]
    );

    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Get all lines for an item.
   */
  async getByItem(
    companyId: string,
    itemId: string,
    includeDeleted = false
  ): Promise<InventoryDocumentLine[]> {
    const rows = await all<InventoryDocumentLineRow>(
      `
        SELECT *
        FROM inventory_document_lines
        WHERE companyId = ?
          AND itemId = ?
          ${includeDeleted ? "" : "AND isDeleted = 0"}
        ORDER BY createdAt ASC
      `,
      [companyId, itemId]
    );

    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Get all lines associated with a warehouse.
   */
  async getByWarehouse(
    companyId: string,
    warehouseId: string,
    includeDeleted = false
  ): Promise<InventoryDocumentLine[]> {
    const rows = await all<InventoryDocumentLineRow>(
      `
        SELECT *
        FROM inventory_document_lines
        WHERE companyId = ?
          AND warehouseId = ?
          ${includeDeleted ? "" : "AND isDeleted = 0"}
        ORDER BY createdAt ASC
      `,
      [companyId, warehouseId]
    );

    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Get lines associated with a lot.
   */
  async getByLot(
    companyId: string,
    lotId: string,
    includeDeleted = false
  ): Promise<InventoryDocumentLine[]> {
    const rows = await all<InventoryDocumentLineRow>(
      `
        SELECT *
        FROM inventory_document_lines
        WHERE companyId = ?
          AND lotId = ?
          ${includeDeleted ? "" : "AND isDeleted = 0"}
        ORDER BY createdAt ASC
      `,
      [companyId, lotId]
    );

    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Get lines associated with a serial number.
   */
  async getBySerialNumber(
    companyId: string,
    serialNumber: string,
    includeDeleted = false
  ): Promise<InventoryDocumentLine[]> {
    const rows = await all<InventoryDocumentLineRow>(
      `
        SELECT *
        FROM inventory_document_lines
        WHERE companyId = ?
          AND serialNumber = ?
          ${includeDeleted ? "" : "AND isDeleted = 0"}
        ORDER BY createdAt ASC
      `,
      [companyId, serialNumber]
    );

    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Get the total quantity of an item across document lines.
   *
   */
  async getTotalQuantityForItem(
    companyId: string,
    itemId: string
  ): Promise<number> {
    const row = await get<{ totalQuantity: number | null }>(
      `
        SELECT SUM(quantity) AS totalQuantity
        FROM inventory_document_lines
        WHERE companyId = ?
          AND itemId = ?
          AND isDeleted = 0
      `,
      [companyId, itemId]
    );

    return row?.totalQuantity ?? 0;
  }

  /**
   * Permanently delete a line.
   */
  async hardDelete(companyId: string, id: string): Promise<void> {
    await run(
      `
        DELETE FROM inventory_document_lines
        WHERE companyId = ?
          AND _id = ?
      `,
      [companyId, id]
    );
  }

  /**
   * Convert SQLite row to domain object.
   */
  private mapRow(row: InventoryDocumentLineRow): InventoryDocumentLine {
    return {
      _id: row._id,
      companyId: row.companyId,
      documentId: row.documentId,
      lineNumber: row.lineNumber,
      itemId: row.itemId,
      quantity: row.quantity,
      unitId: row.unitId,
      unitCost: row.unitCost ?? undefined,
      warehouseId: row.warehouseId ?? undefined,
      locationId: row.locationId ?? undefined,
      lotId: row.lotId ?? undefined,
      serialNumber: row.serialNumber ?? undefined,
      description: row.description ?? undefined,
      customFields: this.parseCustomFields(row.customFields),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      serverVersion: row.serverVersion,
      synced: row.synced === 1,
      isDeleted: row.isDeleted === 1,
    };
  }

  private parseCustomFields(
    value: string | null
  ): Record<string, unknown> | undefined {
    if (!value) {
      return undefined;
    }

    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
}

interface InventoryDocumentLineRow {
  _id: string;
  companyId: string;
  documentId: string;
  lineNumber: number;
  itemId: string;
  quantity: number;
  unitId: string;
  unitCost: number | null;
  warehouseId: string | null;
  locationId: string | null;
  lotId: string | null;
  serialNumber: string | null;
  description: string | null;
  customFields: string | null;
  createdAt: string;
  updatedAt: string;
  serverVersion: number;
  synced: number;
  isDeleted: number;
}
