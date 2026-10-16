import { createHash } from "node:crypto";
import type { CreateInventoryCustomFieldInput, InventoryCustomField } from "../../../../../common/types/inventory/InventoryCustomField.js";
import { all, getDirect, runDirect, transaction, afterCommit } from "../../../db.js";
import { notifyPendingChanges } from "../../shared/sync.repository.js";

export async function getInventoryCustomFields(companyId: string): Promise<InventoryCustomField[]> {
  const rows = await all<InventoryCustomField>(
    "SELECT * FROM inventory_custom_fields WHERE companyId = ? AND isDeleted = 0 AND isActive = 1 ORDER BY sortOrder, label, key", [companyId]);
  return rows.map(row => ({ ...row, synced: Boolean(row.synced), isDeleted: Boolean(row.isDeleted) }));
}

export async function updateInventoryCustomField(companyId: string, id: string, change: { label: string } | { isActive: 0 }): Promise<void> {
  await transaction(async () => {
    const existing = await getDirect<InventoryCustomField>(
      "SELECT * FROM inventory_custom_fields WHERE companyId = ? AND _id = ? AND isDeleted = 0 AND isActive = 1", [companyId, id]);
    if (!existing) throw new Error("Champ personnalisé introuvable ou archivé.");
    await runDirect(`UPDATE inventory_custom_fields SET label = ?, isActive = ?, updatedAt = ?, synced = 0
      WHERE companyId = ? AND _id = ?`, [
      "label" in change ? change.label : existing.label,
      "isActive" in change ? change.isActive : existing.isActive,
      new Date().toISOString(), companyId, id,
    ]);
    afterCommit(() => { void notifyPendingChanges(companyId); });
  });
}

export async function insertInventoryCustomField(companyId: string, input: CreateInventoryCustomFieldInput & Pick<InventoryCustomField, "key">): Promise<void> {
  await transaction(async () => {
    if (await getDirect("SELECT 1 FROM inventory_custom_fields WHERE companyId = ? AND entity = ? AND key = ?", [companyId, input.entity, input.key])) {
      throw new Error("Un champ avec la clé générée à partir de ce libellé existe déjà pour cette entité. Choisissez un autre libellé.");
    }
    // The same definition created offline on two devices has one sync identity.
    const id = createHash("sha256").update(JSON.stringify([companyId, input.entity, input.key])).digest("hex");
    const now = new Date().toISOString();
    await runDirect(`INSERT INTO inventory_custom_fields (_id, companyId, entity, key, label, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, companyId, input.entity, input.key, input.label, now, now]);
    afterCommit(() => { void notifyPendingChanges(companyId); });
  });
}
