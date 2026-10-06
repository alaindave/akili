import { InventoryBase } from "./InventoryBase.js";

export type InventoryCustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "DECIMAL"
  | "BOOLEAN"
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
  required: boolean;
  defaultValue?: unknown;
  options?: Array<{
    value: string;
    label: string;
  }>;
  sortOrder: number;
  isActive: boolean;
}
