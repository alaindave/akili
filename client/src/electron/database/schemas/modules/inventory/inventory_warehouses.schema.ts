import { run } from "../../../db.js";

export async function createInventoryWarehouseTable() {
  /*
   * =========================================================
   * INVENTORY WAREHOUSES
   * =========================================================
   */

  await run(`
    CREATE TABLE IF NOT EXISTS inventory_warehouses (
      _id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      address TEXT,
      type TEXT,
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
      UNIQUE(companyId, code),
      CHECK (length(trim(code)) > 0),
      CHECK (length(trim(name)) > 0)
    );
  `);

  /*
   * =========================================================
   * INVENTORY WAREHOUSES - INDEXES
   * =========================================================
   */

  // General company lookup
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_company
    ON inventory_warehouses(companyId);
  `);

  // Active/inactive warehouses
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_company_active
    ON inventory_warehouses(companyId, isActive);
  `);

  // Soft-delete filtering
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_company_deleted
    ON inventory_warehouses(companyId, isDeleted);
  `);

  // Synchronization
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_sync
    ON inventory_warehouses(companyId, synced, updatedAt);
  `);

  // Server version synchronization
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_server_version
    ON inventory_warehouses(companyId, serverVersion);
  `);

  /*
   * =========================================================
   * INVENTORY LOCATIONS
   * =========================================================
   */

  await run(`
    CREATE TABLE IF NOT EXISTS inventory_locations (
      _id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      warehouseId TEXT NOT NULL,
      parentId TEXT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      locationType TEXT NOT NULL,
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
      UNIQUE(companyId, warehouseId, code),
      CHECK (length(trim(code)) > 0),
      CHECK (length(trim(name)) > 0),
      CHECK (length(trim(locationType)) > 0)
    );
  `);

  /*
   * =========================================================
   * INVENTORY LOCATIONS - INDEXES
   * =========================================================
   */

  // General company lookup
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_locations_company
    ON inventory_locations(companyId);
  `);

  // Get all locations belonging to a warehouse
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_locations_warehouse
    ON inventory_locations(companyId, warehouseId);
  `);

  // Active locations in a warehouse
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_locations_warehouse_active
    ON inventory_locations(companyId, warehouseId, isActive);
  `);

  // Parent-child location hierarchy
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_locations_parent
    ON inventory_locations(companyId, warehouseId, parentId);
  `);

  // Location type filtering
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_locations_type
    ON inventory_locations(companyId, warehouseId, locationType);
  `);

  // Soft-delete filtering
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_locations_deleted
    ON inventory_locations(companyId, warehouseId, isDeleted);
  `);

  // Synchronization
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_locations_sync
    ON inventory_locations(companyId, synced, updatedAt);
  `);

  // Server version synchronization
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_locations_server_version
    ON inventory_locations(companyId, serverVersion);
  `);

  console.log("INVENTORY WAREHOUSES AND LOCATIONS TABLES INITIALIZED");
}
