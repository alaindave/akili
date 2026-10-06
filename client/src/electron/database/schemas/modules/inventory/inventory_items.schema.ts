import { run } from "../../../db.js";

export async function createInventoryItemsTable() {
  /*
   * =========================================================
   * INVENTORY ITEMS
   * =========================================================
   */

  await run(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      _id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      categoryId TEXT,
      itemType TEXT NOT NULL,
      baseUnitId TEXT NOT NULL,
      trackingMethod TEXT NOT NULL,
      costingMethod TEXT,
      reorderPoint REAL,
      reorderQuantity REAL,
      customFields TEXT,
      isActive INTEGER NOT NULL DEFAULT 1
        CHECK (isActive IN (0, 1)),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      synced INTEGER NOT NULL DEFAULT 0
        CHECK (synced IN (0, 1)),
      isDeleted INTEGER NOT NULL DEFAULT 0
        CHECK (isDeleted IN (0, 1)),

      UNIQUE(companyId, sku),

      CHECK (
        reorderPoint IS NULL
        OR reorderPoint >= 0
      ),

      CHECK (
        reorderQuantity IS NULL
        OR reorderQuantity > 0
      )
    );
  `);

  /*
   * =========================================================
   * INVENTORY ITEMS - INDEXES
   * =========================================================
   */

  // Main multi-company filtering
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_company
    ON inventory_items(companyId);
  `);

  // Active items for a company
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_company_active
    ON inventory_items(companyId, isActive);
  `);

  // Soft-deleted / active filtering
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_company_deleted
    ON inventory_items(companyId, isDeleted);
  `);

  // Category filtering
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_company_category
    ON inventory_items(companyId, categoryId);
  `);

  // Item type filtering
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_company_type
    ON inventory_items(companyId, itemType);
  `);

  // Base unit lookup
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_company_unit
    ON inventory_items(companyId, baseUnitId);
  `);

  // Tracking method filtering
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_company_tracking
    ON inventory_items(companyId, trackingMethod);
  `);

  // Updated records - useful for synchronization
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_company_updated
    ON inventory_items(companyId, updatedAt);
  `);

  // Sync queue / synchronization queries
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_sync
    ON inventory_items(companyId, synced, updatedAt);
  `);

  // Server synchronization version
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_server_version
    ON inventory_items(companyId, serverVersion);
  `);

  /*
   * =========================================================
   * INVENTORY CATEGORIES
   * =========================================================
   */

  await run(`
    CREATE TABLE IF NOT EXISTS inventory_categories (
      _id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      code TEXT,
      name TEXT NOT NULL,
      parentId TEXT,
      isActive INTEGER NOT NULL DEFAULT 1
        CHECK (isActive IN (0, 1)),
      customFields TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      synced INTEGER NOT NULL DEFAULT 0
        CHECK (synced IN (0, 1)),
      isDeleted INTEGER NOT NULL DEFAULT 0
        CHECK (isDeleted IN (0, 1)),

      UNIQUE(companyId, code)
    );
  `);

  /*
   * =========================================================
   * INVENTORY CATEGORIES - INDEXES
   * =========================================================
   */

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_categories_company
    ON inventory_categories(companyId);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_categories_company_active
    ON inventory_categories(companyId, isActive);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_categories_company_deleted
    ON inventory_categories(companyId, isDeleted);
  `);

  // Parent-child category tree
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_categories_company_parent
    ON inventory_categories(companyId, parentId);
  `);

  // Useful for synchronization
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_categories_sync
    ON inventory_categories(companyId, synced, updatedAt);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_categories_server_version
    ON inventory_categories(companyId, serverVersion);
  `);

  /*
   * =========================================================
   * INVENTORY UNITS
   * =========================================================
   */

  await run(`
    CREATE TABLE IF NOT EXISTS inventory_units (
      _id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      decimalPlaces INTEGER NOT NULL DEFAULT 0
        CHECK (decimalPlaces >= 0 AND decimalPlaces <= 10),
      isBaseUnit INTEGER NOT NULL DEFAULT 0
        CHECK (isBaseUnit IN (0, 1)),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      synced INTEGER NOT NULL DEFAULT 0
        CHECK (synced IN (0, 1)),

      isDeleted INTEGER NOT NULL DEFAULT 0
        CHECK (isDeleted IN (0, 1)),

      UNIQUE(companyId, code)
    );
  `);

  /*
   * =========================================================
   * INVENTORY UNITS - INDEXES
   * =========================================================
   */

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_units_company
    ON inventory_units(companyId);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_units_company_category
    ON inventory_units(companyId, category);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_units_company_base
    ON inventory_units(companyId, isBaseUnit);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_units_company_active
    ON inventory_units(companyId, isDeleted);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_units_sync
    ON inventory_units(companyId, synced, updatedAt);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_units_server_version
    ON inventory_units(companyId, serverVersion);
  `);

  console.log("INVENTORY TABLES INITIALIZED");
}
