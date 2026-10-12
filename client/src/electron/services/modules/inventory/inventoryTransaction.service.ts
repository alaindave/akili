import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import type { InventoryBalance } from "../../../../common/types/inventory/InventoryItem.js";
import type { InventoryMovement } from "../../../../common/types/inventory/InventoryMovement.js";
import type {
  InventoryTransactionInput,
  InventoryTransactionResult,
} from "../../../../common/types/inventory/InventoryTransaction.js";
import {
  InventoryTransactionRepository,
  type BalanceBucket,
} from "../../../database/repositories/modules/inventory/inventoryTransaction.repository.js";

const id = z.string().trim().min(1).max(255);
const optionalId = id.optional();
const schema = z
  .object({
    requestId: z.string().uuid(),
    type: z.enum(["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT"]),
    date: z.string().datetime({ offset: true }),
    reference: z.string().trim().max(255),
    reason: z
      .string()
      .trim()
      .min(1, "Indiquez le motif de l’opération.")
      .max(2000),
    warehouseId: id,
    locationId: optionalId,
    destinationWarehouseId: optionalId,
    destinationLocationId: optionalId,
    adjustmentDirection: z.enum(["IN", "OUT"]).optional(),
    lines: z
      .array(
        z
          .object({
            itemId: id,
            quantity: z.number().finite().positive(),
            unitCost: z.number().finite().nonnegative().optional(),
            lotId: optionalId,
            serialNumber: optionalId,
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict();

export class InventoryTransactionService {
  constructor(
    private readonly repository = new InventoryTransactionRepository()
  ) {}

  async post(
    companyId: string,
    responsibleUserId: string,
    input: InventoryTransactionInput
  ): Promise<InventoryTransactionResult> {
    id.parse(companyId);
    id.parse(responsibleUserId);
    const draft = schema.parse(input);
    const transfer = draft.type === "TRANSFER";
    if (transfer && !draft.destinationWarehouseId)
      throw new Error("Sélectionnez l’entrepôt de destination.");
    if (
      transfer &&
      draft.warehouseId === draft.destinationWarehouseId &&
      draft.locationId === draft.destinationLocationId
    ) {
      throw new Error("La source et la destination doivent être différentes.");
    }
    if (draft.type === "ADJUSTMENT" && !draft.adjustmentDirection)
      throw new Error("Choisissez le sens de l’ajustement.");
    const outgoing =
      draft.type === "ISSUE" ||
      transfer ||
      (draft.type === "ADJUSTMENT" && draft.adjustmentDirection === "OUT");
    const documentId = `stock:${draft.requestId}`;
    const fingerprint = JSON.stringify(draft);
    return this.repository.withTransaction(async () => {
      const previous = await this.repository.getDocument(companyId, documentId);
      if (previous) {
        const fields =
          typeof previous.customFields === "string"
            ? JSON.parse(previous.customFields)
            : previous.customFields;
        if (
          fields?.transactionRequest !== fingerprint ||
          previous.postedBy !== responsibleUserId
        ) {
          throw new Error(
            "Cette opération a déjà été enregistrée avec des données différentes. Fermez le formulaire et ouvrez une nouvelle opération."
          );
        }
        return { documentId, documentNumber: previous.documentNumber };
      }
      const validatePlace = async (
        warehouseId: string,
        locationId?: string
      ) => {
        if (!(await this.repository.getWarehouse(companyId, warehouseId)))
          throw new Error(
            "Entrepôt inactif ou introuvable dans cette entreprise."
          );
        if (
          locationId &&
          !(await this.repository.getLocation(
            companyId,
            warehouseId,
            locationId
          ))
        ) {
          throw new Error(
            "L’emplacement sélectionné n’appartient pas à cet entrepôt ou est inactif."
          );
        }
      };
      await validatePlace(draft.warehouseId, draft.locationId);
      if (transfer)
        await validatePlace(
          draft.destinationWarehouseId!,
          draft.destinationLocationId
        );
      const createdAt = new Date();
      const now = createdAt.toISOString();
      const base = {
        companyId,
        createdAt: now,
        updatedAt: now,
        serverVersion: 0,
        synced: false,
        isDeleted: false,
      };
      const prefixes = {
        RECEIPT: "ENT",
        ISSUE: "SOR",
        TRANSFER: "TRA",
        ADJUSTMENT: "ADJ",
      };
      const pad = (value: number) => String(value).padStart(2, "0");
      const date = `${pad(createdAt.getDate())}${pad(
        createdAt.getMonth() + 1
      )}${pad(createdAt.getFullYear() % 100)}`;
      const time = `${pad(createdAt.getHours())}${pad(createdAt.getMinutes())}`;
      const numberPrefix = `${prefixes[draft.type]}-${date}-${time}-`;
      // Include deleted documents: their numbers remain reserved by the unique constraint.
      const usedNumbers = new Set(
        (await this.repository.getDocumentNumbers(companyId, numberPrefix)).map(
          (entry) => entry.documentNumber
        )
      );
      const candidates = Array.from(
        { length: 1000 },
        (_, index) => `${numberPrefix}${String(index + 1).padStart(4, "0")}`
      ).filter((number) => !usedNumbers.has(number));
      if (!candidates.length)
        throw new Error(
          "Tous les numéros de document de cette minute sont utilisés. Réessayez à la minute suivante."
        );
      const documentNumber = candidates[randomInt(candidates.length)];
      await this.repository.createDocument({
        ...base,
        _id: documentId,
        documentNumber,
        type: draft.type,
        status: "POSTED",
        warehouseId: transfer ? undefined : draft.warehouseId,
        sourceWarehouseId: transfer ? draft.warehouseId : undefined,
        destinationWarehouseId: transfer
          ? draft.destinationWarehouseId
          : undefined,
        documentDate: draft.date,
        postedAt: now,
        postedBy: responsibleUserId,
        referenceType: "MANUAL",
        referenceId: draft.reference,
        reason: draft.reason,
        customFields: {
          transactionRequest: fingerprint,
          sourceLocationId: draft.locationId,
          destinationLocationId: draft.destinationLocationId,
          adjustmentDirection: draft.adjustmentDirection,
        },
      });

      for (const [index, line] of draft.lines.entries()) {
        const item = await this.repository.getItem(companyId, line.itemId);
        if (!item)
          throw new Error(
            "Article inactif ou introuvable dans cette entreprise."
          );
        if (item.costingMethod && item.costingMethod !== "AVERAGE") {
          throw new Error(
            `${item.name} : la comptabilisation ${item.costingMethod} n’est pas encore disponible.`
          );
        }
        const unit = await this.repository.getUnit(companyId, item.baseUnitId);
        if (!unit) throw new Error(`${item.name} : unité de base introuvable.`);
        const precision = 10 ** unit.decimalPlaces;
        if (
          Math.abs(
            line.quantity * precision - Math.round(line.quantity * precision)
          ) > 1e-7
        ) {
          throw new Error(
            `${item.name} : la quantité accepte ${unit.decimalPlaces} décimale(s).`
          );
        }
        if (item.trackingMethod === "LOT" && !line.lotId)
          throw new Error(`${item.name} : lot obligatoire.`);
        if (
          item.trackingMethod === "SERIAL" &&
          (!line.serialNumber || line.quantity !== 1)
        ) {
          throw new Error(
            `${item.name} : indiquez un numéro de série et une quantité de 1.`
          );
        }
        const bucket: BalanceBucket = {
          companyId,
          itemId: item._id,
          warehouseId: draft.warehouseId,
          locationId: draft.locationId ?? "",
          lotId: line.lotId ?? "",
          serialNumber: line.serialNumber ?? "",
        };
        const balances = await this.repository.getBalances(bucket);
        if (balances.length > 1)
          throw new Error(
            "Plusieurs soldes existent pour cet emplacement. Réconciliez les stocks avant de continuer."
          );
        const source = balances[0];
        if (outgoing && (!source || source.isDeleted)) {
          throw new Error(`${item.name} : aucun stock pour cet emplacement et ce lot ou numéro de série. Sélectionnez un stock existant.`);
        }
        const sourceQuantity =
          source && !source.isDeleted ? source.quantityOnHand : 0;
        const reserved =
          source && !source.isDeleted ? source.quantityReserved : 0;
        const available =
          Math.round((sourceQuantity - reserved) * precision) / precision;
        if (outgoing && line.quantity > available)
          throw new Error(`${item.name} : stock disponible insuffisant (${available} disponible, ${reserved} réservé, ${line.quantity} demandé).`);
        const sourceValue =
          source && !source.isDeleted
            ? source.totalValue ?? sourceQuantity * (source.averageCost ?? 0)
            : 0;
        const unitCost = outgoing
          ? sourceValue / sourceQuantity
          : line.unitCost;
        if (
          unitCost === undefined ||
          !Number.isFinite(unitCost) ||
          unitCost < 0
        )
          throw new Error(`${item.name} : coût unitaire requis ou invalide.`);
        if (
          !outgoing &&
          line.serialNumber &&
          (await this.repository.hasSerial(
            companyId,
            item._id,
            line.serialNumber
          ))
        ) {
          throw new Error(
            `${item.name} : ce numéro de série est déjà en stock.`
          );
        }
        const totalCost = line.quantity * unitCost;
        if (!Number.isFinite(totalCost))
          throw new Error("Valeur de stock trop élevée.");
        const lineId = `${documentId}:line:${index + 1}`;
        const common = {
          ...base,
          documentId,
          itemId: item._id,
          quantity: line.quantity,
          unitId: item.baseUnitId,
          unitCost,
          warehouseId: bucket.warehouseId,
          locationId: bucket.locationId,
          lotId: bucket.lotId,
          serialNumber: bucket.serialNumber,
        };
        await this.repository.createLine({
          ...common,
          _id: lineId,
          lineNumber: index + 1,
          customFields: transfer
            ? {
                destinationWarehouseId: draft.destinationWarehouseId,
                destinationLocationId: draft.destinationLocationId,
              }
            : undefined,
        });

        const apply = async (
          target: BalanceBucket,
          balance: InventoryBalance | undefined,
          direction: "IN" | "OUT",
          movementType: InventoryMovement["movementType"]
        ) => {
          const before =
            balance && !balance.isDeleted ? balance.quantityOnHand : 0;
          const held =
            balance && !balance.isDeleted ? balance.quantityReserved : 0;
          const value =
            balance && !balance.isDeleted
              ? balance.totalValue ?? before * (balance.averageCost ?? 0)
              : 0;
          const quantityOnHand =
            Math.round(
              (before + (direction === "IN" ? line.quantity : -line.quantity)) *
                precision
            ) / precision;
          const totalValue =
            quantityOnHand === 0
              ? 0
              : Math.max(
                  0,
                  value + (direction === "IN" ? totalCost : -totalCost)
                );
          if (
            !Number.isFinite(quantityOnHand) ||
            !Number.isFinite(totalValue) ||
            quantityOnHand < held
          )
            throw new Error("Quantité ou valeur de stock invalide.");
          // Snapshot sync orders changes by updatedAt, including repeated lines
          // that touch one balance within the same millisecond.
          const updatedAt =
            balance && balance.updatedAt >= now
              ? new Date(
                  new Date(balance.updatedAt).getTime() + 1
                ).toISOString()
              : now;
          await this.repository.saveBalance(
            {
              ...base,
              ...balance,
              ...target,
              _id: balance?._id ?? randomUUID(),
              quantityOnHand,
              quantityReserved: held,
              quantityAvailable:
                Math.round((quantityOnHand - held) * precision) / precision,
              totalValue,
              averageCost: quantityOnHand ? totalValue / quantityOnHand : 0,
              updatedAt,
              synced: false,
              isDeleted: false,
            },
            Boolean(balance)
          );
          const movementId = `${lineId}:${direction}`;
          await this.repository.createMovement({
            ...common,
            ...target,
            _id: movementId,
            movementId,
            documentLineId: lineId,
            totalCost,
            direction,
            movementType,
            occurredAt: draft.date,
            referenceType: "MANUAL",
            referenceId: draft.reference,
          });
        };
        await apply(
          bucket,
          source,
          outgoing ? "OUT" : "IN",
          draft.type === "TRANSFER" ? "TRANSFER_OUT" : draft.type
        );
        if (transfer) {
          const destination = {
            ...bucket,
            warehouseId: draft.destinationWarehouseId!,
            locationId: draft.destinationLocationId ?? "",
          };
          const destinationBalances = await this.repository.getBalances(
            destination
          );
          if (destinationBalances.length > 1)
            throw new Error(
              "Plusieurs soldes existent à destination. Réconciliez les stocks avant de continuer."
            );
          await apply(destination, destinationBalances[0], "IN", "TRANSFER_IN");
        }
      }
      await this.repository.queuePostedDocument(companyId, documentId);
      return { documentId, documentNumber };
    });
  }
}

export const inventoryTransactionService = new InventoryTransactionService();
