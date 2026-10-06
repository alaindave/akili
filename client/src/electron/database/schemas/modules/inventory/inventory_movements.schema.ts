import { run } from "../../../db.js";

export async function createInventoryMovementsTables() {
  /*
   * =========================================================
   * INVENTORY MOVEMENTS TABLE
   * =========================================================
   */

  await run(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      _id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      movementId TEXT NOT NULL,
      documentId TEXT NOT NULL,
      documentLineId TEXT NOT NULL,
      itemId TEXT NOT NULL,
      warehouseId TEXT NOT NULL,
      locationId TEXT,
      lotId TEXT,
      serialNumber TEXT,
      quantity REAL NOT NULL
        CHECK (quantity > 0),
      unitId TEXT NOT NULL,
      direction TEXT NOT NULL
        CHECK (direction IN ('IN', 'OUT')),
      unitCost REAL,
      totalCost REAL,
      movementType TEXT NOT NULL,
      occurredAt TEXT NOT NULL,
      referenceType TEXT,
      referenceId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      synced INTEGER NOT NULL DEFAULT 0
        CHECK (synced IN (0, 1)),
      isDeleted INTEGER NOT NULL DEFAULT 0
        CHECK (isDeleted IN (0, 1)),
      UNIQUE(companyId, movementId),

      CHECK (
        unitCost IS NULL
        OR unitCost >= 0
      ),

      CHECK (
        totalCost IS NULL
        OR totalCost >= 0
      )
    );
  `);

  /*
   * =========================================================
   * INVENTORY BALANCES TABLE
   * =========================================================
   */

  await run(`
    CREATE TABLE IF NOT EXISTS inventory_balances (
      _id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      itemId TEXT NOT NULL,
      warehouseId TEXT NOT NULL,
      locationId TEXT,
      lotId TEXT,
      serialNumber TEXT,
      quantityOnHand REAL NOT NULL DEFAULT 0,
      quantityReserved REAL NOT NULL DEFAULT 0,
      quantityAvailable REAL NOT NULL DEFAULT 0,
      averageCost REAL,
      totalValue REAL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      synced INTEGER NOT NULL DEFAULT 0
        CHECK (synced IN (0, 1)),
      isDeleted INTEGER NOT NULL DEFAULT 0
        CHECK (isDeleted IN (0, 1)),

      CHECK (quantityOnHand >= 0),
      CHECK (quantityReserved >= 0),
      CHECK (quantityAvailable >= 0),
      CHECK (
        quantityReserved <= quantityOnHand
        OR quantityOnHand < 0
      ),
      CHECK (
        averageCost IS NULL
        OR averageCost >= 0
      ),
      CHECK (
        totalValue IS NULL
        OR totalValue >= 0
      )
    );
  `);

  /*
   * =========================================================
   * INVENTORY DOCUMENTS TABLE
   * =========================================================
   */

  await run(`
    CREATE TABLE IF NOT EXISTS inventory_documents (
      _id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      documentNumber TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      warehouseId TEXT,
      sourceWarehouseId TEXT,
      destinationWarehouseId TEXT,
      referenceType TEXT,
      referenceId TEXT,
      reason TEXT,
      documentDate TEXT NOT NULL,
      postedAt TEXT,
      postedBy TEXT,
      cancelledAt TEXT,
      cancelledBy TEXT,
      notes TEXT,
      customFields TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      synced INTEGER NOT NULL DEFAULT 0
        CHECK (synced IN (0, 1)),
      isDeleted INTEGER NOT NULL DEFAULT 0
        CHECK (isDeleted IN (0, 1)),
      UNIQUE(companyId, documentNumber)
    );
  `);

  /*
   * =========================================================
   * INVENTORY DOCUMENT LINES
   * =========================================================
   */

  await run(`
    CREATE TABLE IF NOT EXISTS inventory_document_lines (
      _id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      documentId TEXT NOT NULL,
      lineNumber INTEGER NOT NULL,
      itemId TEXT NOT NULL,
      quantity REAL NOT NULL
        CHECK (quantity > 0),
      unitId TEXT NOT NULL,
      unitCost REAL,
      warehouseId TEXT,
      locationId TEXT,
      lotId TEXT,
      serialNumber TEXT,
      description TEXT,
      customFields TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      synced INTEGER NOT NULL DEFAULT 0
        CHECK (synced IN (0, 1)),
      isDeleted INTEGER NOT NULL DEFAULT 0
        CHECK (isDeleted IN (0, 1)),
      UNIQUE(companyId, documentId, lineNumber),

      CHECK (lineNumber > 0),
      CHECK (
        unitCost IS NULL
        OR unitCost >= 0
      )
    );
  `);

  /*
   * =========================================================
   * INVENTORY MOVEMENTS - INDEXES
   * =========================================================
   */

  // Main company lookup
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_company
    ON inventory_movements(companyId);
  `);

  // Item movement history
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_item
    ON inventory_movements(companyId, itemId);
  `);

  // Item movement history ordered by date
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_occurred
    ON inventory_movements(companyId, itemId, occurredAt);
  `);

  // Warehouse stock movement history
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse
    ON inventory_movements(companyId, warehouseId, occurredAt);
  `);

  // Location movement history
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_location
    ON inventory_movements(
      companyId,
      warehouseId,
      locationId,
      occurredAt
    );
  `);

  // Lot traceability
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_lot
    ON inventory_movements(
      companyId,
      itemId,
      lotId,
      occurredAt
    );
  `);

  // Serial number traceability
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_serial
    ON inventory_movements(
      companyId,
      itemId,
      serialNumber,
      occurredAt
    );
  `);

  // Find all movements belonging to a document
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_document
    ON inventory_movements(
      companyId,
      documentId
    );
  `);

  // Find the movement generated from a specific document line
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_document_line
    ON inventory_movements(
      companyId,
      documentId,
      documentLineId
    );
  `);

  // Movement type reporting/filtering
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_type
    ON inventory_movements(
      companyId,
      movementType,
      occurredAt
    );
  `);

  // IN / OUT filtering
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_direction
    ON inventory_movements(
      companyId,
      direction,
      occurredAt
    );
  `);

  // Generic cross-module references
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference
    ON inventory_movements(
      companyId,
      referenceType,
      referenceId
    );
  `);

  // Offline synchronization
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_sync
    ON inventory_movements(
      companyId,
      synced,
      updatedAt
    );
  `);

  // Server synchronization version
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_server_version
    ON inventory_movements(
      companyId,
      serverVersion
    );
  `);

  /*
   * =========================================================
   * INVENTORY BALANCES - UNIQUE STOCK BUCKET
   * =========================================================
   
   */

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_balances_stock_bucket
    ON inventory_balances (
      companyId,
      itemId,
      warehouseId,
      COALESCE(locationId, ''),
      COALESCE(lotId, ''),
      COALESCE(serialNumber, '')
    );
  `);

  /*
   * =========================================================
   * INVENTORY BALANCES - INDEXES
   * =========================================================
   */

  // Main company lookup
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_balances_company
    ON inventory_balances(companyId);
  `);

  // Item stock across warehouses
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_balances_item
    ON inventory_balances(
      companyId,
      itemId
    );
  `);

  // Item stock in a specific warehouse
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_balances_item_warehouse
    ON inventory_balances(
      companyId,
      itemId,
      warehouseId
    );
  `);

  // Warehouse stock
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_balances_warehouse
    ON inventory_balances(
      companyId,
      warehouseId,
      itemId
    );
  `);

  // Location stock
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_balances_location
    ON inventory_balances(
      companyId,
      warehouseId,
      locationId,
      itemId
    );
  `);

  // Lot stock / traceability
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_balances_lot
    ON inventory_balances(
      companyId,
      itemId,
      lotId
    );
  `);

  // Serial number lookup
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_balances_serial
    ON inventory_balances(
      companyId,
      itemId,
      serialNumber
    );
  `);

  // Synchronization
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_balances_sync
    ON inventory_balances(
      companyId,
      synced,
      updatedAt
    );
  `);

  // Server synchronization version
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_balances_server_version
    ON inventory_balances(
      companyId,
      serverVersion
    );
  `);

  /*
   * =========================================================
   * INVENTORY DOCUMENTS - INDEXES
   * =========================================================
   */

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_documents_company
    ON inventory_documents(companyId);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_documents_type
    ON inventory_documents(
      companyId,
      type,
      documentDate
    );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_documents_status
    ON inventory_documents(
      companyId,
      status,
      documentDate
    );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_documents_warehouse
    ON inventory_documents(
      companyId,
      warehouseId,
      documentDate
    );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_documents_source_warehouse
    ON inventory_documents(
      companyId,
      sourceWarehouseId,
      documentDate
    );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_documents_destination_warehouse
    ON inventory_documents(
      companyId,
      destinationWarehouseId,
      documentDate
    );
  `);

  // Cross-module lookup
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_documents_reference
    ON inventory_documents(
      companyId,
      referenceType,
      referenceId
    );
  `);

  // Date filtering/reporting
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_documents_date
    ON inventory_documents(
      companyId,
      documentDate
    );
  `);

  // Synchronization
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_documents_sync
    ON inventory_documents(
      companyId,
      synced,
      updatedAt
    );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_documents_server_version
    ON inventory_documents(
      companyId,
      serverVersion
    );
  `);

  /*
   * =========================================================
   * INVENTORY DOCUMENT LINES - INDEXES
   * =========================================================
   */

  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_company
    ON inventory_document_lines(companyId);
  `);

  // Get all lines belonging to a document
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_document
    ON inventory_document_lines(
      companyId,
      documentId
    );
  `);

  // Item history / documents containing an item
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_item
    ON inventory_document_lines(
      companyId,
      itemId
    );
  `);

  // Item + document lookup
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_item_document
    ON inventory_document_lines(
      companyId,
      itemId,
      documentId
    );
  `);

  // Warehouse-specific lines
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_warehouse
    ON inventory_document_lines(
      companyId,
      warehouseId,
      itemId
    );
  `);

  // Location-specific lines
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_location
    ON inventory_document_lines(
      companyId,
      warehouseId,
      locationId,
      itemId
    );
  `);

  // Lot traceability
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_lot
    ON inventory_document_lines(
      companyId,
      itemId,
      lotId
    );
  `);

  // Serial traceability
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_serial
    ON inventory_document_lines(
      companyId,
      itemId,
      serialNumber
    );
  `);

  // Synchronization
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_sync
    ON inventory_document_lines(
      companyId,
      synced,
      updatedAt
    );
  `);

  // Server synchronization version
  await run(`
    CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_server_version
    ON inventory_document_lines(
      companyId,
      serverVersion
    );
  `);

  console.log(
    "INVENTORY MOVEMENTS, BALANCES, DOCUMENTS AND DOCUMENT LINES TABLES INITIALIZED"
  );
}
