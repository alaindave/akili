import { withGeneratedSku } from "../../../database/repositories/modules/inventory/stockSettings.repository.js";
import { getInventoryCatalogOptions, createInventoryUnit } from "../../../database/repositories/modules/inventory/inventoryCatalog.repository.js";
import type { CreateInventoryUnitInput } from "../../../../common/types/inventory/InventoryUnit.js";
import { randomUUID } from "crypto";

import {
  InventoryItemRepository,
  type InventoryItemListOptions,
} from "../../../database/repositories/modules/inventory/inventoryItem.repository.js";

import type {
  InventoryCostingMethod,
  InventoryItem,
  InventoryItemType,
  InventoryTrackingMethod,
} from "../../../../common/types/inventory/InventoryItem.js";

export interface CreateInventoryItemInput {
  autoGenerateSku?: boolean;
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
  isActive?: boolean;
}

export interface UpdateInventoryItemInput {
  id: string;
  sku?: string;
  name?: string;
  description?: string;
  categoryId?: string | null;
  itemType?: InventoryItemType;
  baseUnitId?: string;
  trackingMethod?: InventoryTrackingMethod;
  costingMethod?: InventoryCostingMethod | null;
  reorderPoint?: number | null;
  reorderQuantity?: number | null;
  customFields?: Record<string, unknown> | null;
  isActive?: boolean;
}

export class InventoryItemService {
  private readonly repository: InventoryItemRepository;

  constructor(repository = new InventoryItemRepository()) {
    this.repository = repository;
  }

  async getCatalogOptions(companyId: string) {
    this.validateCompanyId(companyId);
    return getInventoryCatalogOptions(companyId);
  }

  async createUnit(companyId: string, input: CreateInventoryUnitInput) {
    this.validateCompanyId(companyId);
    return createInventoryUnit(companyId, input);
  }

  /**
   * Get an item by ID.
   */
  async getById(companyId: string, id: string): Promise<InventoryItem | null> {
    this.validateCompanyId(companyId);
    this.validateId(id);

    return this.repository.getById(companyId, id);
  }

  /**
   * Get an item by SKU.
   */
  async getBySku(
    companyId: string,
    sku: string
  ): Promise<InventoryItem | null> {
    this.validateCompanyId(companyId);

    const normalizedSku = this.normalizeSku(sku);

    return this.repository.getBySku(companyId, normalizedSku);
  }

  /**
   * Check whether an SKU already exists.
   */
  async skuExists(
    companyId: string,
    sku: string,
    excludeId?: string
  ): Promise<boolean> {
    this.validateCompanyId(companyId);

    const normalizedSku = this.normalizeSku(sku);

    if (excludeId) {
      this.validateId(excludeId);
    }

    return this.repository.skuExists(companyId, normalizedSku, excludeId);
  }

  /**
   * List inventory items.
   */
  async list(
    companyId: string,
    options: InventoryItemListOptions = {}
  ): Promise<InventoryItem[]> {
    this.validateCompanyId(companyId);

    return this.repository.list(companyId, options);
  }

  /**
   * Count inventory items.
   */
  async count(
    companyId: string,
    options: InventoryItemListOptions = {}
  ): Promise<number> {
    this.validateCompanyId(companyId);

    return this.repository.count(companyId, options);
  }

  /**
   * Create an inventory item.
   */
  async create(
    companyId: string,
    input: CreateInventoryItemInput
  ): Promise<InventoryItem> {
    this.validateCompanyId(companyId);

    const sku = input.autoGenerateSku === true ? "" : this.normalizeSku(input.sku);
    const name = this.normalizeName(input.name);

    this.validateItemType(input.itemType);
    this.validateTrackingMethod(input.trackingMethod);

    if (input.costingMethod !== undefined) {
      this.validateCostingMethod(input.costingMethod);
    }

    this.validateQuantityFields(input.reorderPoint, input.reorderQuantity);

    if (!input.baseUnitId?.trim()) {
      throw new Error("Base unit is required.");
    }

    const options = await this.getCatalogOptions(companyId);
    if (!options.units.some(unit => unit._id === input.baseUnitId.trim())) {
      throw new Error("Sélectionnez une unité valide pour cette entreprise.");
    }
    if (input.categoryId && !options.categories.some(category => category._id === input.categoryId)) {
      throw new Error("Sélectionnez une catégorie valide pour cette entreprise.");
    }
    if (input.isActive !== undefined && typeof input.isActive !== "boolean") {
      throw new Error("Le statut de l’article est invalide.");
    }
    const skuExists = await this.repository.skuExists(companyId, sku);

    if (skuExists) {
      throw new Error(`Un article avec la référence "${sku}" existe déjà.`);
    }

    const now = new Date().toISOString();

    const item: InventoryItem = {
      _id: randomUUID(),
      companyId,
      sku,
      name,
      description: this.normalizeOptionalString(input.description),
      categoryId: this.normalizeOptionalString(input.categoryId),
      itemType: input.itemType,
      baseUnitId: input.baseUnitId.trim(),
      trackingMethod: input.trackingMethod,
      costingMethod: input.costingMethod,
      reorderPoint: input.reorderPoint,
      reorderQuantity: input.reorderQuantity,
      customFields: input.customFields,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      serverVersion: 0,
      synced: false,
      isDeleted: false,
    };

    return input.autoGenerateSku === true
      ? withGeneratedSku(companyId, item.categoryId, generated => this.repository.create({ ...item, sku: generated }, true))
      : this.repository.create(item);
  }

  /**
   * Update an inventory item.
   */
  async update(
    companyId: string,
    input: UpdateInventoryItemInput
  ): Promise<InventoryItem> {
    this.validateCompanyId(companyId);
    this.validateId(input.id);

    const existing = await this.repository.getById(companyId, input.id);

    if (!existing) {
      throw new Error(`Inventory item not found: ${input.id}`);
    }

    if (existing.isDeleted) {
      throw new Error("Cannot update a deleted inventory item.");
    }

    const data: InventoryItem = { ...existing };

    if (input.sku !== undefined) {
      data.sku = this.normalizeSku(input.sku);

      const skuExists = await this.repository.skuExists(
        companyId,
        data.sku,
        input.id
      );

      if (skuExists) {
        throw new Error(
          `An inventory item with SKU "${data.sku}" already exists.`
        );
      }
    }

    if (input.name !== undefined) {
      data.name = this.normalizeName(input.name);
    }

    if (input.description !== undefined) {
      data.description = this.normalizeOptionalString(input.description);
    }

    if (input.categoryId !== undefined) {
      data.categoryId = this.normalizeOptionalString(input.categoryId);
    }

    if (input.baseUnitId !== undefined) {
      if (!input.baseUnitId.trim()) {
        throw new Error("Base unit is required.");
      }

      data.baseUnitId = input.baseUnitId.trim();
    }

    if (input.itemType !== undefined) {
      this.validateItemType(input.itemType);
      data.itemType = input.itemType;
    }

    if (input.trackingMethod !== undefined) {
      this.validateTrackingMethod(input.trackingMethod);
      data.trackingMethod = input.trackingMethod;
    }

    if (input.costingMethod !== undefined) {
      if (input.costingMethod !== null) {
        this.validateCostingMethod(input.costingMethod);
      }
      data.costingMethod = input.costingMethod ?? undefined;
    }

    this.validateQuantityFields(
      input.reorderPoint === null ? undefined : input.reorderPoint,
      input.reorderQuantity === null ? undefined : input.reorderQuantity
    );

    const updatedAt = new Date().toISOString();

    if (input.reorderPoint !== undefined) {
      data.reorderPoint = input.reorderPoint ?? undefined;
    }
    if (input.reorderQuantity !== undefined) {
      data.reorderQuantity = input.reorderQuantity ?? undefined;
    }
    if (input.customFields !== undefined) {
      data.customFields = input.customFields ?? undefined;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    return this.repository.update({
      ...data,
      updatedAt,
      synced: false,
    });
  }

  /**
   * Soft-delete an inventory item.
   */
  async softDelete(
    companyId: string,
    id: string,
    updatedAt?: string
  ): Promise<void> {
    this.validateCompanyId(companyId);
    this.validateId(id);

    const existing = await this.repository.getById(companyId, id);

    if (!existing) {
      throw new Error(`Inventory item not found: ${id}`);
    }

    if (existing.isDeleted) {
      return;
    }

    /*
     * An item should normally not be deleted if it has already
     * participated in inventory transactions.
     *
     * That stronger validation can be added later through
     * InventoryMovementRepository / InventoryDocumentRepository.
     *
     * For now we use soft deletion.
     */
    await this.repository.softDelete(
      companyId,
      id,
      updatedAt ?? new Date().toISOString()
    );
  }

  /**
   * Restore a deleted inventory item.
   */
  async restore(
    companyId: string,
    id: string,
    updatedAt?: string
  ): Promise<void> {
    this.validateCompanyId(companyId);
    this.validateId(id);

    const existing = await this.repository.getByIdIncludingDeleted(
      companyId,
      id
    );

    if (!existing) {
      throw new Error(`Inventory item not found: ${id}`);
    }

    if (!existing.isDeleted) {
      return;
    }

    await this.repository.restore(
      companyId,
      id,
      updatedAt ?? new Date().toISOString()
    );
  }

  /**
   * Activate an inventory item.
   */
  async activate(
    companyId: string,
    id: string,
    updatedAt?: string
  ): Promise<void> {
    this.validateCompanyId(companyId);
    this.validateId(id);

    const existing = await this.repository.getById(companyId, id);

    if (!existing) {
      throw new Error(`Inventory item not found: ${id}`);
    }

    if (existing.isDeleted) {
      throw new Error("Cannot activate a deleted inventory item.");
    }

    if (existing.isActive) {
      return;
    }

    await this.repository.activate(
      companyId,
      id,
      updatedAt ?? new Date().toISOString()
    );
  }

  /**
   * Deactivate an inventory item.
   */
  async deactivate(
    companyId: string,
    id: string,
    updatedAt?: string
  ): Promise<void> {
    this.validateCompanyId(companyId);
    this.validateId(id);

    const existing = await this.repository.getById(companyId, id);

    if (!existing) {
      throw new Error(`Inventory item not found: ${id}`);
    }

    if (existing.isDeleted) {
      throw new Error("Cannot deactivate a deleted inventory item.");
    }

    if (!existing.isActive) {
      return;
    }

    await this.repository.deactivate(
      companyId,
      id,
      updatedAt ?? new Date().toISOString()
    );
  }

  /**
   * Get items belonging to a category.
   */
  async getByCategory(
    companyId: string,
    categoryId: string,
    includeInactive = false
  ): Promise<InventoryItem[]> {
    this.validateCompanyId(companyId);

    if (!categoryId?.trim()) {
      throw new Error("Category ID is required.");
    }

    return this.repository.getByCategory(
      companyId,
      categoryId.trim(),
      includeInactive
    );
  }

  /**
   * Get all active inventory items.
   */
  async getActive(companyId: string): Promise<InventoryItem[]> {
    this.validateCompanyId(companyId);

    return this.repository.getActive(companyId);
  }

  /**
   * Get items that have a reorder point configured.
   */
  async getItemsWithReorderPoint(companyId: string): Promise<InventoryItem[]> {
    this.validateCompanyId(companyId);

    return this.repository.getItemsWithReorderPoint(companyId);
  }

  private validateCompanyId(companyId: string): void {
    if (!companyId?.trim()) {
      throw new Error("Company ID is required.");
    }
  }

  private validateId(id: string): void {
    if (!id?.trim()) {
      throw new Error("ID is required.");
    }
  }

  private normalizeSku(sku: string): string {
    const normalized = sku?.trim().toUpperCase();

    if (!normalized) {
      throw new Error("SKU is required.");
    }

    if (normalized.length > 100) {
      throw new Error("SKU cannot exceed 100 characters.");
    }

    return normalized;
  }

  private normalizeName(name: string): string {
    const normalized = name?.trim();

    if (!normalized) {
      throw new Error("Item name is required.");
    }

    if (normalized.length > 255) {
      throw new Error("Item name cannot exceed 255 characters.");
    }

    return normalized;
  }

  private normalizeOptionalString(value?: string | null): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    const normalized = value.trim();

    return normalized || undefined;
  }

  private validateQuantityFields(
    reorderPoint?: number,
    reorderQuantity?: number
  ): void {
    if (reorderPoint !== undefined && reorderPoint !== null) {
      if (!Number.isFinite(reorderPoint) || reorderPoint < 0) {
        throw new Error(
          "Reorder point must be a number greater than or equal to 0."
        );
      }
    }

    if (reorderQuantity !== undefined && reorderQuantity !== null) {
      if (!Number.isFinite(reorderQuantity) || reorderQuantity <= 0) {
        throw new Error("Reorder quantity must be greater than 0.");
      }
    }
  }

  private validateItemType(itemType: InventoryItemType): void {
    const validTypes: InventoryItemType[] = [
      "RAW_MATERIAL",
      "COMPONENT",
      "SEMI_FINISHED",
      "FINISHED_GOOD",
      "CONSUMABLE",
    ];

    if (!validTypes.includes(itemType)) {
      throw new Error(`Invalid inventory item type: ${itemType}`);
    }
  }

  private validateTrackingMethod(
    trackingMethod: InventoryTrackingMethod
  ): void {
    const validMethods: InventoryTrackingMethod[] = ["NONE", "LOT", "SERIAL"];

    if (!validMethods.includes(trackingMethod)) {
      throw new Error(`Invalid inventory tracking method: ${trackingMethod}`);
    }
  }

  private validateCostingMethod(costingMethod: InventoryCostingMethod): void {
    const validMethods: InventoryCostingMethod[] = [
      "AVERAGE",
      "FIFO",
      "STANDARD",
    ];

    if (!validMethods.includes(costingMethod)) {
      throw new Error(`Invalid inventory costing method: ${costingMethod}`);
    }
  }
}

export const inventoryItemService = new InventoryItemService();
