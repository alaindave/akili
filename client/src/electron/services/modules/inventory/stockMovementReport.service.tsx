import { dialog } from "electron";
import fs from "fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";

import { getCompanyById } from "../../../database/repositories/shared/companies.repository.js";
import { getOfflineUserById } from "../../../database/repositories/shared/offline_users.repository.js";
import { InventoryDocumentRepository } from "../../../database/repositories/modules/inventory/inventoryDocument.repository.js";
import { InventoryDocumentLineRepository } from "../../../database/repositories/modules/inventory/inventoryDocumentLines.repository.js";
import { InventoryItemRepository } from "../../../database/repositories/modules/inventory/inventoryItem.repository.js";
import { InventoryWarehouseRepository } from "../../../database/repositories/modules/inventory/inventoryWarehouse.repository.js";
import { getStockSettings } from "../../../database/repositories/modules/inventory/stockSettings.repository.js";
import StockMovementReportDocument from "../../../reports/inventory/stock-movement-report.js";
import type { StockMovementReportData } from "../../../../common/types/inventory/StockMovementReport.js";

const documentRepository = new InventoryDocumentRepository();
const documentLineRepository = new InventoryDocumentLineRepository();
const itemRepository = new InventoryItemRepository();
const warehouseRepository = new InventoryWarehouseRepository();

async function loadAll<T>(
  list: (options: { limit: number; offset: number }) => Promise<T[]>
) {
  const result: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await list({ limit: 100, offset });
    result.push(...page);
    if (page.length < 100) return result;
  }
}

export async function getStockMovementDocumentData(
  companyId: string,
  documentId: string
): Promise<StockMovementReportData> {
  if (
    typeof companyId !== "string" ||
    !companyId.trim() ||
    typeof documentId !== "string" ||
    !documentId.trim()
  ) {
    throw new Error("Paramètres du mouvement de stock invalides.");
  }

  const document = await documentRepository.getById(companyId, documentId);
  if (!document) {
    throw new Error("Document introuvable dans cette entreprise.");
  }
  if (document.type !== "RECEIPT" && document.type !== "ISSUE") {
    throw new Error("Seules les entrées et sorties de stock peuvent être téléchargées.");
  }

  const [lines, items, warehouses, settings, company] = await Promise.all([
    documentLineRepository.getByDocument(companyId, documentId),
    loadAll((options) =>
      itemRepository.list(companyId, { ...options, includeDeleted: true })
    ),
    loadAll((options) =>
      warehouseRepository.list(companyId, { ...options, includeDeleted: true })
    ),
    getStockSettings(companyId),
    getCompanyById(companyId),
  ]);

  if (!company) {
    throw new Error("Entreprise introuvable.");
  }

  let responsible = document.postedBy
    ? `Utilisateur indisponible (${document.postedBy})`
    : "Non renseign\u00e9";
  if (document.postedBy) {
    try {
      const user = await getOfflineUserById(document.postedBy);
      if (user?.companyId === companyId)
        responsible =
          `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
          user.email;
    } catch {
      /* Keep the document readable when its author is unavailable locally. */
    }
  }

  return {
    company,
    document,
    lines,
    items,
    warehouses,
    units: settings.units,
    responsible,
  };
}

export async function saveStockMovementReport(
  companyId: string,
  documentId: string
) {
  const data = await getStockMovementDocumentData(companyId, documentId);
  const receipt = data.document.type === "RECEIPT";
  const reference = data.document.documentNumber
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .slice(0, 80);
  const destination = await dialog.showSaveDialog({
    title: receipt ? "Enregistrer le bon d’entrée" : "Enregistrer le bon de sortie",
    defaultPath: `bon-${receipt ? "entree" : "sortie"}-${reference}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (destination.canceled || !destination.filePath) return { canceled: true };
  const buffer = await renderToBuffer(
    <StockMovementReportDocument data={data} />
  );
  await fs.writeFile(destination.filePath, buffer);
  return { canceled: false, filePath: destination.filePath };
}
