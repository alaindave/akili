import { categorySkuPrefix } from "../../../../../common/types/inventory/sku.js";
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { all, get, getDirect, runDirect, transaction } from "../../../db.js";
import type { InventoryCategory } from "../../../../../common/types/inventory/InventoryCategory.js";
import type { InventoryUnit } from "../../../../../common/types/inventory/InventoryUnit.js";
import type { SkuNumberingSettings, StockCategoryInput, StockUnitInput, StockSettingsData } from "../../../../../common/types/inventory/StockSettings.js";

const companySchema = z.string().trim().min(1);
const idSchema = z.string().uuid();
const categorySchema = z.object({ id: idSchema.optional(), code: z.string().trim().max(30).transform(value => value.toUpperCase()).optional(), name: z.string().trim().min(1).max(100), isActive: z.boolean() });
const unitSchema = z.object({ id: idSchema.optional(), code: z.string().trim().min(1).max(30).transform(value => value.toUpperCase()), name: z.string().trim().min(1).max(100), category: z.enum(["QUANTITY", "WEIGHT", "VOLUME", "LENGTH", "AREA"]), decimalPlaces: z.number().int().min(0).max(10) });
const numberingSchema = z.object({ enabled: z.boolean() });
export const defaultSkuNumbering: SkuNumberingSettings = { enabled: false };

export async function getSkuNumbering(companyId: string): Promise<SkuNumberingSettings> {
  const row = await get<SkuNumberingSettings>("SELECT enabled FROM inventory_sku_settings WHERE companyId = ?", [companySchema.parse(companyId)]);
  return row ? { ...row, enabled: Boolean(row.enabled) } : { ...defaultSkuNumbering };
}
export async function getStockSettings(companyId: string): Promise<StockSettingsData> {
  const company = companySchema.parse(companyId);
  const [categories, units, numbering] = await Promise.all([
    all<InventoryCategory>("SELECT * FROM inventory_categories WHERE companyId = ? AND isDeleted = 0 ORDER BY name COLLATE NOCASE", [company]),
    all<InventoryUnit>("SELECT * FROM inventory_units WHERE companyId = ? AND isDeleted = 0 ORDER BY name COLLATE NOCASE", [company]),
    getSkuNumbering(company),
  ]);
  return { categories: categories.map(row => ({ ...row, isActive: Boolean(row.isActive), synced: Boolean(row.synced), isDeleted: false })), units: units.map(row => ({ ...row, isBaseUnit: Boolean(row.isBaseUnit), synced: Boolean(row.synced), isDeleted: false })), numbering };
}
export async function saveSkuNumbering(companyId: string, input: SkuNumberingSettings) {
  const company = companySchema.parse(companyId);
  const value = numberingSchema.parse(input);
  return transaction(async () => {
    await runDirect(`INSERT INTO inventory_sku_settings (companyId, enabled)
      VALUES (?, ?) ON CONFLICT(companyId) DO UPDATE SET enabled = excluded.enabled`,
      [company, Number(value.enabled)]);
    return value;
  });
}
export async function withGeneratedSku<T>(companyId: string, categoryId: string | undefined, create: (sku: string) => Promise<T>): Promise<T> {
  const company = companySchema.parse(companyId);
  return transaction(async () => {
    const settings = await getDirect<SkuNumberingSettings>("SELECT enabled FROM inventory_sku_settings WHERE companyId = ?", [company]);
    if (!settings?.enabled) throw new Error("La numérotation automatique n’est pas activée dans les paramètres de stocks.");
    const category = categoryId ? await getDirect<{ name: string }>("SELECT name FROM inventory_categories WHERE companyId = ? AND _id = ? AND isDeleted = 0 AND isActive = 1", [company, categoryId]) : null;
    if (!category) throw new Error("Sélectionnez une catégorie pour générer la référence SKU.");
    const prefix = categorySkuPrefix(category.name);
    if (Array.from(prefix).length < 3) throw new Error("Le nom de la catégorie doit contenir au moins trois lettres pour générer une référence SKU.");
    for (let attempt = 0; attempt < 1000; attempt++) {
      const sku = `${prefix}-${String(randomInt(0, 100000)).padStart(5, "0")}`;
      // Archived items also retain their unique references.
      const exists = await getDirect("SELECT 1 FROM inventory_items WHERE companyId = ? AND sku = ?", [company, sku]);
      if (!exists) return create(sku);
    }
    throw new Error("Impossible de générer une référence unique. Veuillez réessayer.");
  });
}
export async function saveStockCategory(companyId: string, input: StockCategoryInput): Promise<void> {
  const company = companySchema.parse(companyId);
  const data = categorySchema.parse(input);
  await transaction(async () => {
    if (data.id && !await getDirect("SELECT 1 FROM inventory_categories WHERE companyId = ? AND _id = ? AND isDeleted = 0", [company, data.id])) throw new Error("Catégorie introuvable.");
    const duplicate = await getDirect("SELECT 1 FROM inventory_categories WHERE companyId = ? AND _id != ? AND ((? IS NOT NULL AND code = ?) OR (isDeleted = 0 AND lower(name) = lower(?)))", [company, data.id ?? "", data.code || null, data.code || null, data.name]);
    if (duplicate) throw new Error("Une catégorie avec ce code ou ce nom existe déjà.");
    const now = new Date().toISOString();
    if (data.id) await runDirect("UPDATE inventory_categories SET code = ?, name = ?, isActive = ?, updatedAt = ?, synced = 0 WHERE companyId = ? AND _id = ?", [data.code || null, data.name, Number(data.isActive), now, company, data.id]);
    else await runDirect("INSERT INTO inventory_categories (_id, companyId, code, name, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)", [randomUUID(), company, data.code || null, data.name, Number(data.isActive), now, now]);
  });
}
export async function saveStockUnit(companyId: string, input: StockUnitInput): Promise<void> {
  const company = companySchema.parse(companyId);
  const data = unitSchema.parse(input);
  await transaction(async () => {
    const existing = data.id ? await getDirect<InventoryUnit>("SELECT * FROM inventory_units WHERE companyId = ? AND _id = ? AND isDeleted = 0", [company, data.id]) : null;
    if (data.id && !existing) throw new Error("Unité introuvable.");
    if (await getDirect("SELECT 1 FROM inventory_units WHERE companyId = ? AND code = ? AND _id != ?", [company, data.code, data.id ?? ""])) throw new Error("Une unité avec ce code existe déjà.");
    if (existing && existing.category !== data.category && await getDirect("SELECT 1 FROM inventory_items WHERE companyId = ? AND baseUnitId = ?", [company, data.id])) throw new Error("La mesure d’une unité utilisée par un article ne peut pas être modifiée.");
    const now = new Date().toISOString();
    if (data.id) await runDirect("UPDATE inventory_units SET code = ?, name = ?, category = ?, decimalPlaces = ?, updatedAt = ?, synced = 0 WHERE companyId = ? AND _id = ?", [data.code, data.name, data.category, data.decimalPlaces, now, company, data.id]);
    else await runDirect("INSERT INTO inventory_units (_id, companyId, code, name, category, decimalPlaces, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [randomUUID(), company, data.code, data.name, data.category, data.decimalPlaces, now, now]);
  });
}
async function archive(companyId: string, id: string, kind: "category" | "unit") {
  const company = companySchema.parse(companyId);
  idSchema.parse(id);
  const table = kind === "category" ? "inventory_categories" : "inventory_units";
  const field = kind === "category" ? "categoryId" : "baseUnitId";
  await transaction(async () => {
    if (!await getDirect(`SELECT 1 FROM ${table} WHERE companyId = ? AND _id = ? AND isDeleted = 0`, [company, id])) throw new Error("Élément introuvable.");
    if (await getDirect(`SELECT 1 FROM inventory_items WHERE companyId = ? AND ${field} = ?`, [company, id])) throw new Error("Cet élément est utilisé par un article et ne peut pas être archivé.");
    if (kind === "category" && await getDirect("SELECT 1 FROM inventory_categories WHERE companyId = ? AND parentId = ? AND isDeleted = 0", [company, id])) throw new Error("Cette catégorie contient des sous-catégories.");
    await runDirect(`UPDATE ${table} SET isDeleted = 1, synced = 0, updatedAt = ? WHERE companyId = ? AND _id = ?`, [new Date().toISOString(), company, id]);
  });
}
export const archiveStockCategory = (companyId: string, id: string) => archive(companyId, id, "category");
export const archiveStockUnit = (companyId: string, id: string) => archive(companyId, id, "unit");
