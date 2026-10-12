import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { inventorySyncModels as models } from "../models/modules/inventory/inventorySync.js";
import { getNextSyncVersion } from "../utils/syncVersion.js";

type Row = Record<string, any>;
export class StockSyncConflict extends Error {
  readonly retryable = false;
  constructor(public code: string, message: string) { super(message); }
}
function fail(message: string): never { throw new StockSyncConflict("STOCK_CONFLICT", message); }
function clean(row: Row): Row {
  const { synced, lastSyncedAt, serverVersion, ...value } = row;
  if (typeof value.customFields === "string") value.customFields = JSON.parse(value.customFields);
  return value;
}
function stable(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}

/** Same MongoDB transaction convention as opening stock; no snapshot balance writes. */
export async function postSyncedInventory(companyId: string, input: Row) {
  if (!input || !input.document || !Array.isArray(input.lines) || !Array.isArray(input.movements) ||
      !input.lines.length || input.lines.length > 1000 || input.movements.length > 2000) fail("Incomplete stock operation.");
  const document = clean(input.document);
  const lines = input.lines.map(clean) as Row[];
  const movements = input.movements.map(clean) as Row[];
  if (input._id !== document._id || document.status !== "POSTED" || document.referenceType === "OPENING_STOCK" ||
      !["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT"].includes(document.type)) fail("Unsupported stock operation.");
  const identities = new Set<string>();
  for (const row of [document, ...lines, ...movements]) {
    if (row.companyId !== companyId || typeof row._id !== "string" || !row._id || identities.has(row._id) || row.isDeleted) fail("Invalid stock identity or company.");
    identities.add(row._id);
  }
  const fingerprint = createHash("sha256").update(stable({document, lines, movements})).digest("hex");
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const existing = await models.inventory_document.findOne({companyId, _id: document._id}).session(session).lean();
      if (existing) {
        if (existing.customFields?.syncFingerprint === fingerprint) return {serverVersion: existing.serverVersion};
        // Legacy partial uploads must never be replayed as fresh stock deltas.
        throw new StockSyncConflict("LEGACY_STOCK_RECONCILIATION", "This stock document already exists. Reconcile its movements and balances before replaying it.");
      }
      if (await models.inventory_document.exists({companyId, documentNumber: document.documentNumber}).session(session))
        fail("Document number already used by another device; change its number before retrying.");
      const now = new Date();
      const used = new Set<string>();
      for (const line of lines) {
        if (line.documentId !== document._id || !Number.isFinite(line.quantity) || line.quantity <= 0) fail("Invalid stock line.");
        const item = await models.inventory_item.findOne({companyId, _id: line.itemId, isDeleted: 0}).session(session).lean();
        const unit = await models.inventory_unit.findOne({companyId, _id: line.unitId, isDeleted: 0}).session(session).lean();
        if (!item || !unit || item.baseUnitId !== line.unitId) fail("Stock item or base unit is missing in this company.");
        const precision = 10 ** unit.decimalPlaces;
        if (Math.abs(line.quantity * precision - Math.round(line.quantity * precision)) > 1e-7) fail("Invalid quantity precision.");
        const changes = movements.filter(movement => movement.documentLineId === line._id);
        if (changes.length !== (document.type === "TRANSFER" ? 2 : 1)) fail("Stock movements do not match the document lines.");
        if (document.type === "TRANSFER" && (changes.filter(row => row.direction === "OUT").length !== 1 || changes.filter(row => row.direction === "IN").length !== 1)) fail("Transfer must contain one outgoing and one incoming movement.");
        changes.sort((a,b) => a.direction === b.direction ? 0 : a.direction === "OUT" ? -1 : 1);
        let transferCost: number | undefined;
        for (const movement of changes) {
          if (movement.documentId !== document._id || movement.itemId !== line.itemId || movement.unitId !== line.unitId || movement.quantity !== line.quantity || used.has(movement._id)) fail("Movement does not match its parent line.");
          used.add(movement._id);
          if (!["IN", "OUT"].includes(movement.direction) || (document.type === "RECEIPT" && movement.direction !== "IN") || (document.type === "ISSUE" && movement.direction !== "OUT")) fail("Invalid stock direction.");
          const warehouseId = document.type === "TRANSFER" ? (movement.direction === "OUT" ? document.sourceWarehouseId : document.destinationWarehouseId) : document.warehouseId;
          if (movement.warehouseId !== warehouseId || !await models.inventory_warehouse.exists({companyId, _id: warehouseId, isDeleted: 0}).session(session)) fail("Warehouse does not belong to this stock operation.");
          if (movement.locationId && !await models.inventory_location.exists({companyId, warehouseId, _id: movement.locationId, isDeleted: 0}).session(session)) fail("Location does not belong to this warehouse.");
          if (item.trackingMethod === "LOT" && !movement.lotId) fail("Lot required.");
          if (item.trackingMethod === "SERIAL" && (!movement.serialNumber || movement.quantity !== 1)) fail("A serial number and quantity one are required.");
          const bucket = {companyId, itemId: movement.itemId, warehouseId, locationId: movement.locationId ?? "", lotId: movement.lotId ?? "", serialNumber: movement.serialNumber ?? ""};
          const balance = await models.inventory_balance.findOne(bucket).session(session).lean();
          const previousQuantity = balance && !balance.isDeleted ? balance.quantityOnHand : 0;
          const reserved = balance && !balance.isDeleted ? balance.quantityReserved : 0;
          const incoming = movement.direction === "IN";
          if (incoming && item.trackingMethod === "SERIAL" && await models.inventory_balance.exists({companyId, itemId: item._id, serialNumber: movement.serialNumber, quantityOnHand: {$gt: 0}, isDeleted: 0}).session(session)) fail("Serial number already in stock.");
          const quantity = Math.round((previousQuantity + (incoming ? 1 : -1) * movement.quantity) * precision) / precision;
          if (quantity < reserved) fail("Another device consumed or reserved this stock. The offline operation has been retained for reconciliation.");
          const cost = incoming ? (document.type === "TRANSFER" ? transferCost : line.unitCost) : (balance?.averageCost ?? 0);
          if (cost == null || !Number.isFinite(cost) || cost < 0) fail("Valid unit cost required.");
          if (!incoming) transferCost = cost;
          const totalValue = quantity === 0 ? 0 : Math.max(0, (balance?.totalValue ?? previousQuantity * (balance?.averageCost ?? 0)) + (incoming ? 1 : -1) * movement.quantity * cost);
          if (!Number.isFinite(totalValue)) fail("Stock value is outside the supported range.");
          const balanceId = balance?._id ?? `balance:${createHash("sha256").update(stable(bucket)).digest("hex")}`;
          await models.inventory_balance.updateOne({companyId, _id: balanceId}, {$set: {...bucket, quantityOnHand: quantity,
            quantityReserved: reserved, quantityAvailable: quantity - reserved, averageCost: quantity ? totalValue / quantity : 0,
            totalValue, updatedAt: now, isDeleted: 0, serverVersion: await getNextSyncVersion("inventory_balance", session)},
            $setOnInsert: {createdAt: now}}, {upsert: true, session, runValidators: true});
          await models.inventory_movement.create([{...movement, unitCost: cost, totalCost: movement.quantity * cost,
            serverVersion: await getNextSyncVersion("inventory_movement", session)}], {session});
        }
        await models.inventory_document_line.create([{...line, serverVersion: await getNextSyncVersion("inventory_document_line", session)}], {session});
      }
      if (used.size !== movements.length) fail("Operation contains orphan movements.");
      const serverVersion = await getNextSyncVersion("inventory_document", session);
      await models.inventory_document.create([{...document, customFields: {...document.customFields, syncFingerprint: fingerprint}, serverVersion}], {session});
      return {serverVersion};
    });
  } finally { await session.endSession(); }
}
