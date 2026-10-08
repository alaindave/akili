import type { InventoryCategory } from "./InventoryCategory.js";
import type { InventoryUnit, CreateInventoryUnitInput } from "./InventoryUnit.js";

export interface SkuNumberingSettings {
  enabled: boolean;
}
export interface StockCategoryInput {
  id?: string;
  code?: string;
  name: string;
  isActive: boolean;
}
export type StockUnitInput = CreateInventoryUnitInput & { id?: string };
export interface StockSettingsData {
  categories: InventoryCategory[];
  units: InventoryUnit[];
  numbering: SkuNumberingSettings;
}
export interface StockSettingsApi {
  get(companyId: string): Promise<StockSettingsData>;
  saveCategory(companyId: string, input: StockCategoryInput): Promise<void>;
  saveUnit(companyId: string, input: StockUnitInput): Promise<void>;
  archiveCategory(companyId: string, id: string): Promise<void>;
  archiveUnit(companyId: string, id: string): Promise<void>;
  saveNumbering(companyId: string, input: SkuNumberingSettings): Promise<SkuNumberingSettings>;
}
