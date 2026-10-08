import { InventoryBase } from "./InventoryBase.js";

export interface InventoryUnit extends InventoryBase {
  code: string;
  name: string;
  category: "QUANTITY" | "WEIGHT" | "VOLUME" | "LENGTH" | "AREA";
  decimalPlaces: number;
  isBaseUnit: boolean;
}

export interface InventoryUnitConversion extends InventoryBase {
  itemId?: string;
  fromUnitId: string;
  toUnitId: string;
  factor: number;
}

export type CreateInventoryUnitInput = Pick<InventoryUnit, "code" | "name" | "category" | "decimalPlaces">;
