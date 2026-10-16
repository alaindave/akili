import type { InventoryCategory } from "./InventoryCategory.js";
import type {
  InventoryUnit,
  CreateInventoryUnitInput,
} from "./InventoryUnit.js";
import type { InventoryItem } from "./InventoryItem.js";
import type {
  InventoryWarehouse,
  InventoryLocation,
} from "./InventoryWarehouse.js";
import type { InventoryCustomField, CreateInventoryCustomFieldInput, UpdateInventoryCustomFieldInput } from "./InventoryCustomField.js";

export interface OpeningStockLine {
  itemId: string;
  warehouseId: string;
  locationId?: string;
  quantity: number;
  unitCost: number;
  lotId?: string;
  serialNumber?: string;
}
export interface OpeningStockDraft {
  _id: string;
  lines: OpeningStockLine[];
}
export interface OpeningStockState {
  inventoryInitialized: boolean;
  inventoryInitializedAt: string | null;
  inventoryInitializationDocumentNumber: string | null;
  draft: OpeningStockDraft | null;
  items: InventoryItem[];
  warehouses: InventoryWarehouse[];
  locations: InventoryLocation[];
  units: InventoryUnit[];
}

export interface SkuNumberingSettings {
  enabled: boolean;
}
export interface StockCategoryInput {
  customFields?: Record<string, string>;
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
  customFields: InventoryCustomField[];
}

export interface StockSettingsApi {
  updateCustomField(companyId: string, input: UpdateInventoryCustomFieldInput): Promise<void>;
  archiveCustomField(companyId: string, id: string): Promise<void>;
  createCustomField(companyId: string, input: CreateInventoryCustomFieldInput): Promise<void>;
  getCustomFields(companyId: string): Promise<InventoryCustomField[]>;
  getInitialization(companyId: string): Promise<OpeningStockState>;
  saveOpeningDraft(
    companyId: string,
    input: OpeningStockDraft
  ): Promise<OpeningStockDraft>;
  submitOpeningDraft(
    companyId: string,
    input: OpeningStockDraft
  ): Promise<{ warning?: string }>;
  get(companyId: string): Promise<StockSettingsData>;
  saveCategory(companyId: string, input: StockCategoryInput): Promise<void>;
  saveUnit(companyId: string, input: StockUnitInput): Promise<void>;
  archiveCategory(companyId: string, id: string): Promise<void>;
  archiveUnit(companyId: string, id: string): Promise<void>;
  saveNumbering(
    companyId: string,
    input: SkuNumberingSettings
  ): Promise<SkuNumberingSettings>;
}
