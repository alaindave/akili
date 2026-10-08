import { getSkuNumbering } from "./stockSettings.repository.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { all, run } from "../../../db.js";
import type { InventoryUnit, CreateInventoryUnitInput } from "../../../../../common/types/inventory/InventoryUnit.js";
import type { InventoryCategory } from "../../../../../common/types/inventory/InventoryCategory.js";

const companySchema = z.string().trim().min(1);
const unitSchema = z.object({
  code: z.string().trim().min(1).max(30).transform(value => value.toUpperCase()),
  name: z.string().trim().min(1).max(100),
  category: z.enum(["QUANTITY", "WEIGHT", "VOLUME", "LENGTH", "AREA"]),
  decimalPlaces: z.number().int().min(0).max(10),
});

export async function getInventoryCatalogOptions(companyId: string) {
  const company = companySchema.parse(companyId);
  const [units, categories, numbering] = await Promise.all([
    all<InventoryUnit>("SELECT * FROM inventory_units WHERE companyId = ? AND isDeleted = 0 ORDER BY name COLLATE NOCASE", [company]),
    all<InventoryCategory>("SELECT * FROM inventory_categories WHERE companyId = ? AND isDeleted = 0 AND isActive = 1 ORDER BY name COLLATE NOCASE", [company]),
    getSkuNumbering(company),
  ]);
  return {
    numbering,
    units: units.map(unit => ({ ...unit, isBaseUnit: Boolean(unit.isBaseUnit), synced: Boolean(unit.synced), isDeleted: Boolean(unit.isDeleted) })),
    categories: categories.map(category => ({ ...category, isActive: Boolean(category.isActive), synced: Boolean(category.synced), isDeleted: Boolean(category.isDeleted), customFields: typeof category.customFields === "string" ? JSON.parse(category.customFields) : category.customFields })),
  };
}

export async function createInventoryUnit(companyId: string, input: CreateInventoryUnitInput): Promise<InventoryUnit> {
  const company = companySchema.parse(companyId);
  const data = unitSchema.parse(input);
  const now = new Date().toISOString();
  const unit: InventoryUnit = { ...data, _id: randomUUID(), companyId: company, isBaseUnit: false, createdAt: now, updatedAt: now, serverVersion: 0, synced: false, isDeleted: false };
  try {
    await run(`INSERT INTO inventory_units (_id, companyId, code, name, category, decimalPlaces, isBaseUnit, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`, [unit._id, company, unit.code, unit.name, unit.category, unit.decimalPlaces, now, now]);
  } catch (error) {
    if ((error as { code?: string }).code?.startsWith("SQLITE_CONSTRAINT")) throw new Error("Une unité avec ce code existe déjà.");
    throw error;
  }
  return unit;
}
