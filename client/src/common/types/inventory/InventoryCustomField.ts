import type { InventoryBase } from "./InventoryBase.js";

export const inventoryCustomFieldEntities = {
  ITEM: "Article", CATEGORY: "Catégorie", WAREHOUSE: "Entrepôt",
  LOCATION: "Emplacement", DOCUMENT: "Document", DOCUMENT_LINE: "Ligne de document",
} as const;

export type InventoryCustomFieldEntity = keyof typeof inventoryCustomFieldEntities;
export interface UpdateInventoryCustomFieldInput {
  id: string;
  label: string;
}
export interface CreateInventoryCustomFieldInput {
  entity: InventoryCustomFieldEntity;
  label: string;
}

export type InventoryCustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "DECIMAL"
  | "DATE"
  | "SELECT"
  | "MULTI_SELECT";

export interface InventoryCustomField extends InventoryBase {
  entity:
    | "ITEM"
    | "CATEGORY"
    | "WAREHOUSE"
    | "LOCATION"
    | "DOCUMENT"
    | "DOCUMENT_LINE";
  key: string;
  label: string;
  type: InventoryCustomFieldType;
  required: number;
  defaultValue?: unknown;
  options?: Array<{
    value: string;
    label: string;
  }>;
  sortOrder: number;
  isActive: number;
}
