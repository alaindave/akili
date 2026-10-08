import { run, runDirect, get, all } from "../../../db.js";

import type {
  InventoryItem,
  InventoryItemType,
  InventoryTrackingMethod,
  InventoryCostingMethod,
} from "../../../../../common/types/inventory/InventoryItem.js";

export interface InventoryItemListOptions {
  search?: string;
  categoryId?: string;
  itemType?: InventoryItemType;
  baseUnitId?: string;
  trackingMethod?: InventoryTrackingMethod;
  costingMethod?: InventoryCostingMethod;
  isActive?: boolean;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

function deserializeItem(row: InventoryItem): InventoryItem {
  return { ...row, isActive: Boolean(row.isActive), synced: Boolean(row.synced), isDeleted: Boolean(row.isDeleted),
    customFields: typeof row.customFields === "string" ? JSON.parse(row.customFields) : row.customFields ?? undefined };
}

export class InventoryItemRepository {
  /*
   * =========================================================
   * GET BY ID
   * =========================================================
   */

  async getById(companyId: string, _id: string): Promise<InventoryItem | null> {
    const row = await get<InventoryItem>(
      `
        SELECT *
        FROM inventory_items
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
        LIMIT 1
      `,
      [companyId, _id]
    );

    return row ? deserializeItem(row) : null;
  }

  /*
   * =========================================================
   * GET BY ID INCLUDING DELETED
   * =========================================================
   *
   */

  async getByIdIncludingDeleted(
    companyId: string,
    _id: string
  ): Promise<InventoryItem | null> {
    const row = await get<InventoryItem>(
      `
        SELECT *
        FROM inventory_items
        WHERE companyId = ?
          AND _id = ?
        LIMIT 1
      `,
      [companyId, _id]
    );

    return row ? deserializeItem(row) : null;
  }

  /*
   * =========================================================
   * GET BY SKU
   * =========================================================
   */

  async getBySku(
    companyId: string,
    sku: string
  ): Promise<InventoryItem | null> {
    const row = await get<InventoryItem>(
      `
        SELECT *
        FROM inventory_items
        WHERE companyId = ?
          AND sku = ?
          AND isDeleted = 0
        LIMIT 1
      `,
      [companyId, sku]
    );

    return row ? deserializeItem(row) : null;
  }

  /*
   * =========================================================
   * CHECK SKU EXISTS
   * =========================================================
   *
   */

  async skuExists(
    companyId: string,
    sku: string,
    excludeId?: string
  ): Promise<boolean> {
    let sql = `
      SELECT 1
      FROM inventory_items
      WHERE companyId = ?
        AND sku = ?
        AND isDeleted = 0
    `;

    const params: unknown[] = [companyId, sku];

    if (excludeId) {
      sql += ` AND _id != ?`;
      params.push(excludeId);
    }

    sql += ` LIMIT 1`;

    const row = await get<{ "1": number }>(sql, params);

    return row !== null && row !== undefined;
  }

  /*
   * =========================================================
   * LIST ITEMS
   * =========================================================
   */

  async list(
    companyId: string,
    options: InventoryItemListOptions = {}
  ): Promise<InventoryItem[]> {
    const {
      search,
      categoryId,
      itemType,
      baseUnitId,
      trackingMethod,
      costingMethod,
      isActive,
      includeDeleted = false,
      limit = 100,
      offset = 0,
    } = options;

    const conditions: string[] = [`companyId = ?`];

    const params: unknown[] = [companyId];

    /*
     * -------------------------------------------------------
     * Soft deletion
     * -------------------------------------------------------
     */

    if (!includeDeleted) {
      conditions.push(`isDeleted = 0`);
    }

    /*
     * -------------------------------------------------------
     * Active / inactive
     * -------------------------------------------------------
     */

    if (isActive !== undefined) {
      conditions.push(`isActive = ?`);
      params.push(isActive ? 1 : 0);
    }

    /*
     * -------------------------------------------------------
     * Search
     * -------------------------------------------------------
     *
     * Search SKU and item name.
     */

    if (search?.trim()) {
      conditions.push(`
        (
          sku LIKE ?
          OR name LIKE ?
        )
      `);

      const searchValue = `%${search.trim()}%`;

      params.push(searchValue, searchValue);
    }

    /*
     * -------------------------------------------------------
     * Category
     * -------------------------------------------------------
     */

    if (categoryId) {
      conditions.push(`categoryId = ?`);
      params.push(categoryId);
    }

    /*
     * -------------------------------------------------------
     * Item type
     * -------------------------------------------------------
     */

    if (itemType) {
      conditions.push(`itemType = ?`);
      params.push(itemType);
    }

    /*
     * -------------------------------------------------------
     * Base unit
     * -------------------------------------------------------
     */

    if (baseUnitId) {
      conditions.push(`baseUnitId = ?`);
      params.push(baseUnitId);
    }

    /*
     * -------------------------------------------------------
     * Tracking method
     * -------------------------------------------------------
     */

    if (trackingMethod) {
      conditions.push(`trackingMethod = ?`);
      params.push(trackingMethod);
    }

    /*
     * -------------------------------------------------------
     * Costing method
     * -------------------------------------------------------
     */

    if (costingMethod) {
      conditions.push(`costingMethod = ?`);
      params.push(costingMethod);
    }

    /*
     * -------------------------------------------------------
     * Pagination
     * -------------------------------------------------------
     */

    const safeLimit = Math.max(1, Math.min(limit, 500));
    const safeOffset = Math.max(0, offset);

    params.push(safeLimit, safeOffset);

    const rows = await all<InventoryItem>(
      `
        SELECT *
        FROM inventory_items
        WHERE ${conditions.join(" AND ")}
        ORDER BY name COLLATE NOCASE ASC, _id ASC
        LIMIT ?
        OFFSET ?
      `,
      params
    );

    return rows.map(deserializeItem);
  }

  /*
   * =========================================================
   * COUNT ITEMS
   * =========================================================
   */

  async count(
    companyId: string,
    options: Omit<InventoryItemListOptions, "limit" | "offset"> = {}
  ): Promise<number> {
    const {
      search,
      categoryId,
      itemType,
      baseUnitId,
      trackingMethod,
      costingMethod,
      isActive,
      includeDeleted = false,
    } = options;

    const conditions: string[] = [`companyId = ?`];

    const params: unknown[] = [companyId];

    if (!includeDeleted) {
      conditions.push(`isDeleted = 0`);
    }

    if (isActive !== undefined) {
      conditions.push(`isActive = ?`);
      params.push(isActive ? 1 : 0);
    }

    if (search?.trim()) {
      conditions.push(`
        (
          sku LIKE ?
          OR name LIKE ?
        )
      `);

      const searchValue = `%${search.trim()}%`;

      params.push(searchValue, searchValue);
    }

    if (categoryId) {
      conditions.push(`categoryId = ?`);
      params.push(categoryId);
    }

    if (itemType) {
      conditions.push(`itemType = ?`);
      params.push(itemType);
    }

    if (baseUnitId) {
      conditions.push(`baseUnitId = ?`);
      params.push(baseUnitId);
    }

    if (trackingMethod) {
      conditions.push(`trackingMethod = ?`);
      params.push(trackingMethod);
    }

    if (costingMethod) {
      conditions.push(`costingMethod = ?`);
      params.push(costingMethod);
    }

    const row = await get<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM inventory_items
        WHERE ${conditions.join(" AND ")}
      `,
      params
    );

    return row?.count ?? 0;
  }

  /*
   * =========================================================
   * CREATE
   * =========================================================
   */

  async create(item: InventoryItem, insideTransaction = false): Promise<InventoryItem> {
    const execute = insideTransaction ? runDirect : run;
    await execute(
      `
        INSERT INTO inventory_items (
          _id,
          companyId,
          sku,
          name,
          description,
          categoryId,
          itemType,
          baseUnitId,
          trackingMethod,
          costingMethod,
          reorderPoint,
          reorderQuantity,
          customFields,
          isActive,
          createdAt,
          updatedAt,
          serverVersion,
          synced,
          isDeleted
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `,
      [
        item._id,
        item.companyId,
        item.sku,
        item.name,
        item.description ?? null,
        item.categoryId ?? null,
        item.itemType,
        item.baseUnitId,
        item.trackingMethod,
        item.costingMethod ?? null,
        item.reorderPoint ?? null,
        item.reorderQuantity ?? null,
        item.customFields ? JSON.stringify(item.customFields) : null,
        item.isActive ? 1 : 0,
        item.createdAt,
        item.updatedAt,
        item.serverVersion,
        item.synced ? 1 : 0,
        item.isDeleted ? 1 : 0,
      ]
    );

    return item;
  }

  /*
   * =========================================================
   * UPDATE
   * =========================================================
   */

  async update(item: InventoryItem): Promise<InventoryItem> {
    await run(
      `
        UPDATE inventory_items
        SET
          sku = ?,
          name = ?,
          description = ?,
          categoryId = ?,
          itemType = ?,
          baseUnitId = ?,
          trackingMethod = ?,
          costingMethod = ?,
          reorderPoint = ?,
          reorderQuantity = ?,
          customFields = ?,
          isActive = ?,
          updatedAt = ?,
          serverVersion = ?,
          synced = ?,
          isDeleted = ?
        WHERE companyId = ?
          AND _id = ?
      `,
      [
        item.sku,
        item.name,
        item.description ?? null,
        item.categoryId ?? null,
        item.itemType,
        item.baseUnitId,
        item.trackingMethod,
        item.costingMethod ?? null,
        item.reorderPoint ?? null,
        item.reorderQuantity ?? null,
        item.customFields ? JSON.stringify(item.customFields) : null,
        item.isActive ? 1 : 0,
        item.updatedAt,
        item.serverVersion,
        item.synced ? 1 : 0,
        item.isDeleted ? 1 : 0,
        item.companyId,
        item._id,
      ]
    );

    return item;
  }

  /*
   * =========================================================
   * UPDATE LOCAL ITEM
   * =========================================================
   */

  async updateLocal(
    companyId: string,
    id: string,
    data: {
      sku: string;
      name: string;
      description?: string;
      categoryId?: string;
      itemType: InventoryItemType;
      baseUnitId: string;
      trackingMethod: InventoryTrackingMethod;
      costingMethod?: InventoryCostingMethod;
      reorderPoint?: number;
      reorderQuantity?: number;
      customFields?: Record<string, unknown>;
      isActive: boolean;
      updatedAt: string;
    }
  ): Promise<InventoryItem | null> {
    await run(
      `
        UPDATE inventory_items
        SET
          sku = ?,
          name = ?,
          description = ?,
          categoryId = ?,
          itemType = ?,
          baseUnitId = ?,
          trackingMethod = ?,
          costingMethod = ?,
          reorderPoint = ?,
          reorderQuantity = ?,
          customFields = ?,
          isActive = ?,
          updatedAt = ?,
          synced = 0
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [
        data.sku,
        data.name,
        data.description ?? null,
        data.categoryId ?? null,
        data.itemType,
        data.baseUnitId,
        data.trackingMethod,
        data.costingMethod ?? null,
        data.reorderPoint ?? null,
        data.reorderQuantity ?? null,
        data.customFields ? JSON.stringify(data.customFields) : null,
        data.isActive ? 1 : 0,
        data.updatedAt,
        companyId,
        id,
      ]
    );

    return this.getById(companyId, id);
  }

  /*
   * =========================================================
   * SOFT DELETE
   * =========================================================
   */

  async softDelete(
    companyId: string,
    id: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_items
        SET
          isDeleted = 1,
          isActive = 0,
          synced = 0,
          updatedAt = ?
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [updatedAt, companyId, id]
    );
  }

  /*
   * =========================================================
   * RESTORE
   * =========================================================
   */

  async restore(
    companyId: string,
    id: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_items
        SET
          isDeleted = 0,
          isActive = 1,
          synced = 0,
          updatedAt = ?
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 1
      `,
      [updatedAt, companyId, id]
    );
  }

  /*
   * =========================================================
   * ACTIVATE
   * =========================================================
   */

  async activate(
    companyId: string,
    id: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_items
        SET
          isActive = 1,
          synced = 0,
          updatedAt = ?
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [updatedAt, companyId, id]
    );
  }

  /*
   * =========================================================
   * DEACTIVATE
   * =========================================================
   */

  async deactivate(
    companyId: string,
    id: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_items
        SET
          isActive = 0,
          synced = 0,
          updatedAt = ?
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [updatedAt, companyId, id]
    );
  }

  /*
   * =========================================================
   * GET UNSYNCED ITEMS
   * =========================================================
   */

  async getUnsynced(companyId: string, limit = 100): Promise<InventoryItem[]> {
    const safeLimit = Math.max(1, Math.min(limit, 500));

    return all<InventoryItem>(
      `
        SELECT *
        FROM inventory_items
        WHERE companyId = ?
          AND synced = 0
        ORDER BY updatedAt ASC
        LIMIT ?
      `,
      [companyId, safeLimit]
    );
  }

  /*
   * =========================================================
   * MARK SYNCED
   * =========================================================
   */

  async markSynced(
    companyId: string,
    id: string,
    serverVersion: number,
    syncedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_items
        SET
          synced = 1,
          serverVersion = ?,
          updatedAt = ?
        WHERE companyId = ?
          AND _id = ?
      `,
      [serverVersion, syncedAt, companyId, id]
    );
  }

  /*
   * =========================================================
   * GET CHANGED SINCE SERVER VERSION
   * =========================================================
   *
   */

  async getChangedSince(
    companyId: string,
    serverVersion: number,
    limit = 500
  ): Promise<InventoryItem[]> {
    const safeLimit = Math.max(1, Math.min(limit, 1000));

    return all<InventoryItem>(
      `
        SELECT *
        FROM inventory_items
        WHERE companyId = ?
          AND serverVersion > ?
        ORDER BY serverVersion ASC
        LIMIT ?
      `,
      [companyId, serverVersion, safeLimit]
    );
  }

  /*
   * =========================================================
   * GET BY CATEGORY
   * =========================================================
   */

  async getByCategory(
    companyId: string,
    categoryId: string,
    includeInactive = false
  ): Promise<InventoryItem[]> {
    return all<InventoryItem>(
      `
        SELECT *
        FROM inventory_items
        WHERE companyId = ?
          AND categoryId = ?
          AND isDeleted = 0
          ${includeInactive ? "" : "AND isActive = 1"}
        ORDER BY name COLLATE NOCASE ASC, _id ASC
      `,
      [companyId, categoryId]
    );
  }

  /*
   * =========================================================
   * GET ACTIVE ITEMS
   * =========================================================
   */

  async getActive(companyId: string): Promise<InventoryItem[]> {
    return all<InventoryItem>(
      `
        SELECT *
        FROM inventory_items
        WHERE companyId = ?
          AND isActive = 1
          AND isDeleted = 0
        ORDER BY name COLLATE NOCASE ASC, _id ASC
      `,
      [companyId]
    );
  }

  /*
   * =========================================================
   * GET ITEMS BELOW REORDER POINT
   * =========================================================
   */

  async getItemsWithReorderPoint(companyId: string): Promise<InventoryItem[]> {
    return all<InventoryItem>(
      `
        SELECT *
        FROM inventory_items
        WHERE companyId = ?
          AND reorderPoint IS NOT NULL
          AND isActive = 1
          AND isDeleted = 0
        ORDER BY name COLLATE NOCASE ASC, _id ASC
      `,
      [companyId]
    );
  }
}
