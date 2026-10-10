import axios from "axios";
import { app } from "electron";
import { z } from "zod";
import { all, get, getDirect, runDirect, transaction } from "../../../database/db.js";
import { getToken } from "../../../auth.js";
import { getCompanyById, reconcileCompanyInventory, upsertCompany } from "../../../database/repositories/shared/companies.repository.js";
import { pushPendingChanges } from "../../shared/sync/push.service.js";
import { pullEntityByVersion } from "../../shared/sync/pull.service.js";
import { applyInventoryBatch } from "../../../database/repositories/modules/inventory/inventorySync.repository.js";
import { INVENTORY_SYNC_TABLES } from "../../../../common/types/inventory/InventorySync.js";
import type { InventorySyncEntity } from "../../../../common/types/inventory/InventorySync.js";
import type { OpeningStockDraft, OpeningStockState } from "../../../../common/types/inventory/StockSettings.js";
import type Company from "../../../../common/types/shared/Company.js";

const draftSchema = z.object({
  _id: z.string().regex(/^opening:[a-f0-9-]{36}$/i),
  lines: z.array(z.object({
    itemId: z.string().min(1), warehouseId: z.string().min(1),
    quantity: z.number().finite().positive(), unitCost: z.number().finite().nonnegative(),
    lotId: z.string().trim().max(255).optional(), serialNumber: z.string().trim().max(255).optional(),
  })).max(1000),
});
const submitting = new Set<string>();

export async function getOpeningStockState(companyId: string): Promise<OpeningStockState> {
  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Entreprise introuvable.");
  const draft = await get<{ payload: string }>("SELECT payload FROM inventory_opening_drafts WHERE companyId = ?", [companyId]);
  const [items, warehouses, units] = await Promise.all([
    all<OpeningStockState["items"][number]>("SELECT * FROM inventory_items WHERE companyId = ? AND isDeleted = 0 AND isActive = 1 ORDER BY name", [companyId]),
    all<OpeningStockState["warehouses"][number]>("SELECT * FROM inventory_warehouses WHERE companyId = ? AND isDeleted = 0 AND isActive = 1 ORDER BY name", [companyId]),
    all<OpeningStockState["units"][number]>("SELECT * FROM inventory_units WHERE companyId = ? AND isDeleted = 0 ORDER BY name", [companyId]),
  ]);
  return { inventoryInitialized: Boolean(company.inventoryInitialized),
    inventoryInitializedAt: company.inventoryInitializedAt ?? null,
    inventoryInitializationDocumentNumber: company.inventoryInitializationDocumentNumber ?? null,
    draft: draft ? JSON.parse(draft.payload) : null, items, warehouses, units };
}

export async function saveOpeningStockDraft(companyId: string, input: OpeningStockDraft): Promise<OpeningStockDraft> {
  if (submitting.has(companyId)) throw new Error("Une soumission est déjà en cours.");
  return persistDraft(companyId, input);
}

async function persistDraft(companyId: string, input: OpeningStockDraft): Promise<OpeningStockDraft> {
  const draft = draftSchema.parse(input);
  return transaction(async () => {
    const company = await getDirect<Company>("SELECT * FROM companies WHERE companyId = ?", [companyId]);
    if (!company || company.inventoryInitialized) throw new Error("Le stock a déjà été initialisé ou l’entreprise est introuvable.");
    for (const line of draft.lines) {
      const item = await getDirect("SELECT 1 FROM inventory_items WHERE companyId = ? AND _id = ? AND isDeleted = 0 AND isActive = 1", [companyId, line.itemId]);
      const warehouse = await getDirect("SELECT 1 FROM inventory_warehouses WHERE companyId = ? AND _id = ? AND isDeleted = 0 AND isActive = 1", [companyId, line.warehouseId]);
      if (!item || !warehouse || !Number.isFinite(line.quantity * line.unitCost)) throw new Error("Article, entrepôt ou valeur de stock invalide.");
    }
    await runDirect(`INSERT INTO inventory_opening_drafts (companyId, payload, updatedAt) VALUES (?, ?, ?)
      ON CONFLICT(companyId) DO UPDATE SET payload = excluded.payload, updatedAt = excluded.updatedAt`,
      [companyId, JSON.stringify(draft), new Date().toISOString()]);
    return draft;
  });
}

async function pullOpeningStock(companyId: string) {
  await pullEntityByVersion<Company>(companyId, "company", async (companies) => {
    for (const company of companies) await upsertCompany(company);
    return true;
  });
  for (const entity of Object.keys(INVENTORY_SYNC_TABLES) as InventorySyncEntity[]) {
    await pullEntityByVersion<Record<string, unknown>>(companyId, entity, (items) => applyInventoryBatch(companyId, entity, items));
  }
}

export async function submitOpeningStock(companyId: string, input: OpeningStockDraft): Promise<{ warning?: string }> {
  // Persist the request identity before any network I/O so a lost response can be retried.
  if (submitting.has(companyId)) throw new Error("Une soumission est déjà en cours.");
  submitting.add(companyId);
  try {
    const draft = await persistDraft(companyId, input);
    if (!draft.lines.length) throw new Error("Ajoutez au moins un article.");
    const company = await getCompanyById(companyId);
    if (company?.inventoryInitialized) throw new Error("Le stock a déjà été initialisé.");
    const token = await getToken();
    if (!token) throw new Error("Veuillez vous connecter.");
    const pending = await pushPendingChanges(companyId);
    if (pending.pendingChanges) throw new Error("Synchronisez les modifications en attente avant de soumettre le stock initial.");
    const apiUrl = app.isPackaged ? "https://leather-works.onrender.com" : process.env.VITE_API_URL;
    let response;
    try {
      response = await axios.post<{ company: Company }>(`${apiUrl}/sync/opening-stock`, draft, {
        timeout: 90000, headers: { "x-auth-token": token, "x-company-id": companyId },
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        const remoteCompany = error.response.data?.company as Company | undefined;
        if (remoteCompany?.companyId === companyId) await reconcileCompanyInventory(remoteCompany);
        try { await pullOpeningStock(companyId); } catch { /* Ordinary sync will retry the stock download. */ }
        throw new Error("Le stock a déjà été initialisé sur un autre appareil. Les informations de l’entreprise ont été actualisées.");
      }
      if (axios.isAxiosError(error)) throw new Error(error.response?.data?.message ?? "Connexion au serveur requise. Le brouillon est conservé ; réessayez pour confirmer la soumission.");
      throw error;
    }
    if (response.data.company.companyId !== companyId || !response.data.company.inventoryInitialized) throw new Error("Réponse d’initialisation invalide.");
    await reconcileCompanyInventory(response.data.company);
    try {
      await pullOpeningStock(companyId);
    } catch {
      return { warning: "Stock initial validé. Lancez la synchronisation pour terminer le téléchargement des mouvements et des soldes." };
    }
    return {};
  } finally { submitting.delete(companyId); }
}
