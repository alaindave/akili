import type { InventoryItem } from "../../../../common/types/inventory/InventoryItem.js";
import type { CreateNotificationQueueInput } from "../../../database/repositories/shared/notificationQueue.repository.js";

function stockStatus(quantity: number, reorderPoint?: number | null) {
  if (quantity <= 0) return "OUT";
  if (reorderPoint != null && quantity <= reorderPoint) return "LOW";
  return "NORMAL";
}

/** Build one alert for a completed stock transition, never for intermediate lines. */
export function buildStockAlert(
  companyId: string,
  recipientEmail: string | null | undefined,
  item: InventoryItem,
  before: number,
  after: number,
  documentId: string,
  documentNumber: string
): CreateNotificationQueueInput | null {
  const email = recipientEmail?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const status = stockStatus(after, item.reorderPoint);
  if (status === "NORMAL" || status === stockStatus(before, item.reorderPoint)) {
    return null;
  }
  const label = status === "OUT" ? "Rupture de stock" : "Stock faible";
  return {
    companyId,
    type: "inventory",
    recipientEmail: email,
    entityId: `${documentId}:stock-alert:${item._id}`,
    title: `${label} — ${item.name} (${item.sku})`,
    message: [
      `${label} : ${item.name}`,
      `SKU : ${item.sku}`,
      `Quantité disponible (tous les entrepôts) : ${after}`,
      `Seuil de réapprovisionnement : ${item.reorderPoint ?? "Non défini"}`,
      `Document : ${documentNumber}`,
    ].join("\n"),
  };
}
