import mongoose from "mongoose";
import { randomUUID } from "crypto";
import Company from "../models/shared/company.model.js";
import { inventorySyncModels as models } from "../models/modules/inventory/inventorySync.js";
import { getNextSyncVersion } from "../utils/syncVersion.js";

export class OpeningStockError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "OpeningStockError";
  }
}

interface OpeningLine {
  itemId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  lotId?: string;
  serialNumber?: string;
}

export interface OpeningStockInput {
  _id: string;
  lines: OpeningLine[];
}

export function validateOpeningStock(input: OpeningStockInput) {
  if (
    !input ||
    typeof input._id !== "string" ||
    !/^opening:[a-f0-9-]{36}$/i.test(input._id) ||
    !Array.isArray(input.lines) ||
    !input.lines.length ||
    input.lines.length > 1000
  ) {
    throw new OpeningStockError(
      "INVALID_OPENING_STOCK",
      "Ajoutez entre 1 et 1000 lignes de stock."
    );
  }

  const buckets = new Set<string>();

  for (const line of input.lines) {
    if (
      !line ||
      typeof line.itemId !== "string" ||
      !line.itemId ||
      typeof line.warehouseId !== "string" ||
      !line.warehouseId ||
      !Number.isFinite(line.quantity) ||
      line.quantity <= 0 ||
      !Number.isFinite(line.unitCost) ||
      line.unitCost < 0 ||
      !Number.isFinite(line.quantity * line.unitCost) ||
      (line.lotId != null && typeof line.lotId !== "string") ||
      (line.serialNumber != null && typeof line.serialNumber !== "string")
    ) {
      throw new OpeningStockError(
        "INVALID_OPENING_LINE",
        "Article, entrepôt, quantité positive et prix valide obligatoires."
      );
    }

    const key = JSON.stringify([
      line.itemId,
      line.warehouseId,
      line.lotId ?? "",
      line.serialNumber ?? "",
    ]);

    if (buckets.has(key)) {
      throw new OpeningStockError(
        "DUPLICATE_OPENING_LINE",
        "Un article ne peut figurer deux fois dans le même emplacement de stock."
      );
    }

    buckets.add(key);
  }
}

/**
 * Posts opening stock atomically.
 *
 * The company initialization flag, inventory document, document lines,
 * movements, and balances commit together.
 *
 * Repeated requests using the same document ID are idempotent.
 */
export async function postOpeningStock(
  companyId: string,
  postedBy: string,
  input: OpeningStockInput
) {
  validateOpeningStock(input);

  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const company = await Company.findOne({
        companyId,
        isDeleted: 0,
      })
        .session(session)
        .lean();

      if (!company) {
        throw new OpeningStockError(
          "COMPANY_NOT_FOUND",
          "Entreprise introuvable."
        );
      }

      // Idempotency: a retry of the same successfully posted document
      // must not create duplicate stock movements.
      if (company.inventoryInitialized) {
        if (company.inventoryInitializationDocumentId === input._id) {
          return {
            company,
            documentId: input._id,
          };
        }

        throw new OpeningStockError(
          "INVENTORY_ALREADY_INITIALIZED",
          "Le stock a déjà été initialisé sur un autre appareil."
        );
      }

      const now = new Date();
      const year = now.getUTCFullYear();

      const previous = await models.inventory_document
        .findOne({
          companyId,
          documentNumber: new RegExp(`^INI-${year}-[0-9]{4}$`),
        })
        .sort({ documentNumber: -1 })
        .session(session)
        .lean();

      const sequence = previous
        ? Number(previous.documentNumber.slice(-4)) + 1
        : 1;

      if (sequence > 9999) {
        throw new OpeningStockError(
          "NUMBER_EXHAUSTED",
          "Numérotation INI épuisée."
        );
      }

      const documentNumber = `INI-${year}-${String(sequence).padStart(4, "0")}`;

      const state = {
        inventoryInitialized: true,
        inventoryInitializedAt: now.toISOString(),
        inventoryInitializationDocumentId: input._id,
        inventoryInitializationDocumentNumber: documentNumber,
        updatedAt: now.toISOString(),
        serverVersion: await getNextSyncVersion("company", session),
      };

      // Claim initialization exactly once for this company.
      const claimed = await Company.updateOne(
        {
          companyId,
          inventoryInitialized: { $ne: true },
        },
        {
          $set: state,
        },
        {
          session,
        }
      );

      if (claimed.modifiedCount !== 1) {
        throw new OpeningStockError(
          "INVENTORY_ALREADY_INITIALIZED",
          "Le stock a déjà été initialisé."
        );
      }

      const base = {
        companyId,
        createdAt: now,
        updatedAt: now,
        isDeleted: 0,
      };

      await models.inventory_document.create(
        [
          {
            ...base,
            _id: input._id,
            documentNumber,
            type: "RECEIPT",
            status: "POSTED",
            referenceType: "OPENING_STOCK",
            documentDate: now,
            postedAt: now,
            postedBy,
            serverVersion: await getNextSyncVersion(
              "inventory_document",
              session
            ),
          },
        ],
        { session }
      );

      const serials = new Set<string>();

      for (const [index, line] of input.lines.entries()) {
        const item = await models.inventory_item
          .findOne({
            _id: line.itemId,
            companyId,
            isDeleted: 0,
            isActive: true,
          })
          .session(session)
          .lean();

        const warehouse = await models.inventory_warehouse
          .findOne({
            _id: line.warehouseId,
            companyId,
            isDeleted: 0,
            isActive: true,
          })
          .session(session)
          .lean();

        if (!item || !warehouse) {
          throw new OpeningStockError(
            "INVALID_REFERENCE",
            "Article ou entrepôt inactif, introuvable ou appartenant à une autre entreprise."
          );
        }

        const unit = await models.inventory_unit
          .findOne({
            _id: item.baseUnitId,
            companyId,
            isDeleted: 0,
          })
          .session(session)
          .lean();

        if (
          !unit ||
          Math.abs(
            line.quantity * 10 ** unit.decimalPlaces -
              Math.round(line.quantity * 10 ** unit.decimalPlaces)
          ) > 1e-6
        ) {
          throw new OpeningStockError(
            "INVALID_QUANTITY",
            "La quantité ne respecte pas la précision de l’unité."
          );
        }

        if (item.trackingMethod === "LOT" && !line.lotId?.trim()) {
          throw new OpeningStockError(
            "LOT_REQUIRED",
            "Le lot est obligatoire pour cet article."
          );
        }

        if (item.trackingMethod === "SERIAL") {
          const key = `${item._id}:${line.serialNumber}`;

          if (
            !line.serialNumber?.trim() ||
            line.quantity !== 1 ||
            serials.has(key)
          ) {
            throw new OpeningStockError(
              "INVALID_SERIAL",
              "Chaque numéro de série doit être unique, avec une quantité de 1."
            );
          }

          serials.add(key);

          const existingSerial = await models.inventory_balance
            .exists({
              companyId,
              itemId: item._id,
              serialNumber: line.serialNumber,
              quantityOnHand: { $gt: 0 },
            })
            .session(session);

          if (existingSerial) {
            throw new OpeningStockError(
              "INVALID_SERIAL",
              "Ce numéro de série est déjà en stock."
            );
          }
        }

        const lineId = `${input._id}:line:${index + 1}`;

        const fields = {
          itemId: item._id,
          warehouseId: warehouse._id,
          quantity: line.quantity,
          unitId: item.baseUnitId,
          unitCost: line.unitCost,
          lotId: line.lotId ?? "",
          serialNumber: line.serialNumber ?? "",
        };

        await models.inventory_document_line.create(
          [
            {
              ...base,
              ...fields,
              _id: lineId,
              documentId: input._id,
              lineNumber: index + 1,
              serverVersion: await getNextSyncVersion(
                "inventory_document_line",
                session
              ),
            },
          ],
          { session }
        );

        await models.inventory_movement.create(
          [
            {
              ...base,
              ...fields,
              _id: `${lineId}:movement`,
              movementId: `${lineId}:movement`,
              documentId: input._id,
              documentLineId: lineId,
              direction: "IN",
              movementType: "RECEIPT",
              referenceType: "OPENING_STOCK",
              occurredAt: now,
              totalCost: line.quantity * line.unitCost,
              serverVersion: await getNextSyncVersion(
                "inventory_movement",
                session
              ),
            },
          ],
          { session }
        );

        // Identify the balance bucket for this item and tracking data.
        const bucket = {
          companyId,
          itemId: item._id,
          warehouseId: warehouse._id,
          locationId: "",
          lotId: fields.lotId,
          serialNumber: fields.serialNumber,
        };

        // Load the complete Mongoose document so document validators
        // can inspect both quantityOnHand and quantityReserved.
        const balanceDoc = await models.inventory_balance
          .findOne(bucket)
          .session(session);

        const previousQuantityOnHand = balanceDoc?.quantityOnHand ?? 0;

        const quantityReserved = balanceDoc?.quantityReserved ?? 0;

        const quantityOnHand = previousQuantityOnHand + line.quantity;

        const previousTotalValue =
          balanceDoc?.totalValue ??
          previousQuantityOnHand * (balanceDoc?.averageCost ?? 0);

        const totalValue = previousTotalValue + line.quantity * line.unitCost;

        if (!Number.isFinite(quantityOnHand) || !Number.isFinite(totalValue)) {
          throw new OpeningStockError(
            "INVALID_TOTAL",
            "Valeur de stock trop élevée."
          );
        }

        if (quantityReserved < 0 || quantityReserved > quantityOnHand) {
          throw new OpeningStockError(
            "INVALID_RESERVED_QUANTITY",
            "La quantité réservée ne peut pas dépasser le stock disponible en main."
          );
        }

        const serverVersion = await getNextSyncVersion(
          "inventory_balance",
          session
        );

        if (balanceDoc) {
          balanceDoc.quantityOnHand = quantityOnHand;
          balanceDoc.quantityReserved = quantityReserved;
          balanceDoc.quantityAvailable = quantityOnHand - quantityReserved;
          balanceDoc.totalValue = totalValue;
          balanceDoc.averageCost = totalValue / quantityOnHand;
          balanceDoc.updatedAt = now;
          balanceDoc.serverVersion = serverVersion;
          balanceDoc.isDeleted = 0;

          await balanceDoc.save({ session });
        } else {
          const newBalance = new models.inventory_balance({
            ...bucket,
            _id: randomUUID(),
            quantityOnHand,
            quantityReserved: 0,
            quantityAvailable: quantityOnHand,
            totalValue,
            averageCost: totalValue / quantityOnHand,
            createdAt: now,
            updatedAt: now,
            serverVersion,
            isDeleted: 0,
          });

          await newBalance.save({ session });
        }
      }

      return {
        company: {
          ...company,
          ...state,
        },
        documentId: input._id,
      };
    });
  } finally {
    await session.endSession();
  }
}
