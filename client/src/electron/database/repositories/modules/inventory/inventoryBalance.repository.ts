import { InventoryBalance } from "../../../../../common/types/inventory/InventoryItem.js";
import { all, get, run } from "../../../db.js";

export interface InventoryBalanceListOptions {
  itemId?: string;
  warehouseId?: string;
  locationId?: string;
  lotId?: string;
  serialNumber?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export class InventoryBalanceRepository {
  /*
   * =========================================================
   * GET BY ID
   * =========================================================
   */

  async getById(
    companyId: string,
    id: string
  ): Promise<InventoryBalance | null> {
    const row = await get<InventoryBalance>(
      `
        SELECT *
        FROM inventory_balances
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
        LIMIT 1
      `,
      [companyId, id]
    );

    return row ?? null;
  }

  /*
   * =========================================================
   * GET BY ID INCLUDING DELETED
   * =========================================================
   */

  async getByIdIncludingDeleted(
    companyId: string,
    id: string
  ): Promise<InventoryBalance | null> {
    const row = await get<InventoryBalance>(
      `
        SELECT *
        FROM inventory_balances
        WHERE companyId = ?
          AND _id = ?
        LIMIT 1
      `,
      [companyId, id]
    );

    return row ?? null;
  }

  /*
   * =========================================================
   * GET BALANCE BY STOCK BUCKET
   * =========================================================
   *
   * A stock bucket is uniquely identified by:
   *
   * company
   * + item
   * + warehouse
   * + location
   * + lot
   * + serial number
   *
   * NULL values are converted to empty strings so that the
   * lookup matches the unique COALESCE index used by SQLite.
   */

  async getBalance(
    companyId: string,
    itemId: string,
    warehouseId: string,
    locationId?: string,
    lotId?: string,
    serialNumber?: string
  ): Promise<InventoryBalance | null> {
    const row = await get<InventoryBalance>(
      `
        SELECT *
        FROM inventory_balances
        WHERE companyId = ?
          AND itemId = ?
          AND warehouseId = ?
          AND COALESCE(locationId, '') = COALESCE(?, '')
          AND COALESCE(lotId, '') = COALESCE(?, '')
          AND COALESCE(serialNumber, '') = COALESCE(?, '')
          AND isDeleted = 0
        LIMIT 1
      `,
      [
        companyId,
        itemId,
        warehouseId,
        locationId ?? null,
        lotId ?? null,
        serialNumber ?? null,
      ]
    );

    return row ?? null;
  }

  /*
   * =========================================================
   * GET OR CREATE STOCK BUCKET
   * =========================================================
   */

  async getOrCreate(balance: InventoryBalance): Promise<InventoryBalance> {
    const existing = await this.getBalance(
      balance.companyId,
      balance.itemId,
      balance.warehouseId,
      balance.locationId,
      balance.lotId,
      balance.serialNumber
    );

    if (existing) {
      return existing;
    }

    await this.create(balance);

    return balance;
  }

  /*
   * =========================================================
   * LIST BALANCES
   * =========================================================
   */

  async list(
    companyId: string,
    options: InventoryBalanceListOptions = {}
  ): Promise<InventoryBalance[]> {
    const {
      itemId,
      warehouseId,
      locationId,
      lotId,
      serialNumber,
      includeDeleted = false,
      limit = 100,
      offset = 0,
    } = options;

    const conditions: string[] = [`companyId = ?`];

    const params: unknown[] = [companyId];

    if (!includeDeleted) {
      conditions.push(`isDeleted = 0`);
    }

    if (itemId) {
      conditions.push(`itemId = ?`);
      params.push(itemId);
    }

    if (warehouseId) {
      conditions.push(`warehouseId = ?`);
      params.push(warehouseId);
    }

    if (locationId) {
      conditions.push(`locationId = ?`);
      params.push(locationId);
    }

    if (lotId) {
      conditions.push(`lotId = ?`);
      params.push(lotId);
    }

    if (serialNumber) {
      conditions.push(`serialNumber = ?`);
      params.push(serialNumber);
    }

    const safeLimit = Math.max(1, Math.min(limit, 500));

    const safeOffset = Math.max(0, offset);

    params.push(safeLimit, safeOffset);

    return all<InventoryBalance>(
      `
        SELECT *
        FROM inventory_balances
        WHERE ${conditions.join(" AND ")}
        ORDER BY updatedAt DESC
        LIMIT ?
        OFFSET ?
      `,
      params
    );
  }

  /*
   * =========================================================
   * GET ITEM BALANCES
   * =========================================================
   *
   */

  async getByItem(
    companyId: string,
    itemId: string
  ): Promise<InventoryBalance[]> {
    return all<InventoryBalance>(
      `
        SELECT *
        FROM inventory_balances
        WHERE companyId = ?
          AND itemId = ?
          AND isDeleted = 0
        ORDER BY warehouseId, locationId, lotId, serialNumber
      `,
      [companyId, itemId]
    );
  }

  /*
   * =========================================================
   * GET WAREHOUSE BALANCES
   * =========================================================
   */

  async getByWarehouse(
    companyId: string,
    warehouseId: string
  ): Promise<InventoryBalance[]> {
    return all<InventoryBalance>(
      `
        SELECT *
        FROM inventory_balances
        WHERE companyId = ?
          AND warehouseId = ?
          AND isDeleted = 0
        ORDER BY itemId, locationId, lotId, serialNumber
      `,
      [companyId, warehouseId]
    );
  }

  /*
   * =========================================================
   * GET LOCATION BALANCES
   * =========================================================
   */

  async getByLocation(
    companyId: string,
    warehouseId: string,
    locationId: string
  ): Promise<InventoryBalance[]> {
    return all<InventoryBalance>(
      `
        SELECT *
        FROM inventory_balances
        WHERE companyId = ?
          AND warehouseId = ?
          AND locationId = ?
          AND isDeleted = 0
        ORDER BY itemId, lotId, serialNumber
      `,
      [companyId, warehouseId, locationId]
    );
  }

  /*
   * =========================================================
   * CREATE
   * =========================================================
   */

  async create(balance: InventoryBalance): Promise<InventoryBalance> {
    await run(
      `
        INSERT INTO inventory_balances (
          _id,
          companyId,
          itemId,
          warehouseId,
          locationId,
          lotId,
          serialNumber,
          quantityOnHand,
          quantityReserved,
          quantityAvailable,
          averageCost,
          totalValue,
          createdAt,
          updatedAt,
          serverVersion,
          synced,
          isDeleted
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?
        )
      `,
      [
        balance._id,
        balance.companyId,
        balance.itemId,
        balance.warehouseId,
        balance.locationId ?? null,
        balance.lotId ?? null,
        balance.serialNumber ?? null,
        balance.quantityOnHand,
        balance.quantityReserved,
        balance.quantityAvailable,
        balance.averageCost ?? null,
        balance.totalValue ?? null,
        balance.createdAt,
        balance.updatedAt,
        balance.serverVersion,
        balance.synced ? 1 : 0,
        balance.isDeleted ? 1 : 0,
      ]
    );

    return balance;
  }

  /*
   * =========================================================
   * UPDATE
   * =========================================================
   *
   */

  async update(balance: InventoryBalance): Promise<InventoryBalance> {
    await run(
      `
        UPDATE inventory_balances
        SET
          quantityOnHand = ?,
          quantityReserved = ?,
          quantityAvailable = ?,
          averageCost = ?,
          totalValue = ?,
          updatedAt = ?,
          serverVersion = ?,
          synced = ?,
          isDeleted = ?
        WHERE companyId = ?
          AND _id = ?
      `,
      [
        balance.quantityOnHand,
        balance.quantityReserved,
        balance.quantityAvailable,
        balance.averageCost ?? null,
        balance.totalValue ?? null,
        balance.updatedAt,
        balance.serverVersion,
        balance.synced ? 1 : 0,
        balance.isDeleted ? 1 : 0,
        balance.companyId,
        balance._id,
      ]
    );

    return balance;
  }

  /*
   * =========================================================
   * UPDATE QUANTITIES
   * =========================================================
   *
   * This is intentionally narrower than update().
   *
   * The InventoryStockService should calculate the values
   * and then call this method.
   */

  async updateQuantities(
    companyId: string,
    _id: string,
    quantityOnHand: number,
    quantityReserved: number,
    quantityAvailable: number,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_balances
        SET
          quantityOnHand = ?,
          quantityReserved = ?,
          quantityAvailable = ?,
          updatedAt = ?,
          synced = 0
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [
        quantityOnHand,
        quantityReserved,
        quantityAvailable,
        updatedAt,
        companyId,
        _id,
      ]
    );
  }

  /*
   * =========================================================
   * UPDATE COST
   * =========================================================
   */

  async updateCost(
    companyId: string,
    _id: string,
    averageCost: number | null,
    totalValue: number | null,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_balances
        SET
          averageCost = ?,
          totalValue = ?,
          updatedAt = ?,
          synced = 0
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [averageCost, totalValue, updatedAt, companyId, _id]
    );
  }

  /*
   * =========================================================
   * RESERVE STOCK
   * =========================================================
   *
   */

  async reserve(
    companyId: string,
    _id: string,
    quantity: number,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_balances
        SET
          quantityReserved = quantityReserved + ?,
          quantityAvailable = quantityAvailable - ?,
          updatedAt = ?,
          synced = 0
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [quantity, quantity, updatedAt, companyId, _id]
    );
  }

  /*
   * =========================================================
   * RELEASE RESERVED STOCK
   * =========================================================
   */

  async releaseReservation(
    companyId: string,
    _id: string,
    quantity: number,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_balances
        SET
          quantityReserved = quantityReserved - ?,
          quantityAvailable = quantityAvailable + ?,
          updatedAt = ?,
          synced = 0
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [quantity, quantity, updatedAt, companyId, _id]
    );
  }

  /*
   * =========================================================
   * SOFT DELETE
   * =========================================================
   *
   * Normally balances should not be manually deleted.
   * This exists primarily for synchronization/maintenance.
   */

  async softDelete(
    companyId: string,
    _id: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_balances
        SET
          isDeleted = 1,
          updatedAt = ?,
          synced = 0
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 0
      `,
      [updatedAt, companyId, _id]
    );
  }

  /*
   * =========================================================
   * RESTORE
   * =========================================================
   */

  async restore(
    companyId: string,
    _id: string,
    updatedAt: string
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_balances
        SET
          isDeleted = 0,
          updatedAt = ?,
          synced = 0
        WHERE companyId = ?
          AND _id = ?
          AND isDeleted = 1
      `,
      [updatedAt, companyId, _id]
    );
  }

  /*
   * =========================================================
   * GET UNSYNCED BALANCES
   * =========================================================
   */

  async getUnsynced(
    companyId: string,
    limit = 100
  ): Promise<InventoryBalance[]> {
    const safeLimit = Math.max(1, Math.min(limit, 500));

    return all<InventoryBalance>(
      `
        SELECT *
        FROM inventory_balances
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
    _id: string,
    serverVersion: number
  ): Promise<void> {
    await run(
      `
        UPDATE inventory_balances
        SET
          synced = 1,
          serverVersion = ?
        WHERE companyId = ?
          AND _id = ?
      `,
      [serverVersion, companyId, _id]
    );
  }

  /*
   * =========================================================
   * GET CHANGED SINCE SERVER VERSION
   * =========================================================
   */

  async getChangedSince(
    companyId: string,
    serverVersion: number,
    limit = 500
  ): Promise<InventoryBalance[]> {
    const safeLimit = Math.max(1, Math.min(limit, 1000));

    return all<InventoryBalance>(
      `
        SELECT *
        FROM inventory_balances
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
   * COUNT
   * =========================================================
   */

  async count(
    companyId: string,
    options: Omit<InventoryBalanceListOptions, "limit" | "offset"> = {}
  ): Promise<number> {
    const {
      itemId,
      warehouseId,
      locationId,
      lotId,
      serialNumber,
      includeDeleted = false,
    } = options;

    const conditions: string[] = [`companyId = ?`];

    const params: unknown[] = [companyId];

    if (!includeDeleted) {
      conditions.push(`isDeleted = 0`);
    }

    if (itemId) {
      conditions.push(`itemId = ?`);
      params.push(itemId);
    }

    if (warehouseId) {
      conditions.push(`warehouseId = ?`);
      params.push(warehouseId);
    }

    if (locationId) {
      conditions.push(`locationId = ?`);
      params.push(locationId);
    }

    if (lotId) {
      conditions.push(`lotId = ?`);
      params.push(lotId);
    }

    if (serialNumber) {
      conditions.push(`serialNumber = ?`);
      params.push(serialNumber);
    }

    const row = await get<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM inventory_balances
        WHERE ${conditions.join(" AND ")}
      `,
      params
    );

    return row?.count ?? 0;
  }
}
