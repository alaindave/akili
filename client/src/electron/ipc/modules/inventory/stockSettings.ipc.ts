import { ipcMain } from "electron";
import { requireAuthenticatedCompanyId } from "./inventoryItem.ipc.js";
import type { StockCategoryInput, StockUnitInput, SkuNumberingSettings } from "../../../../common/types/inventory/StockSettings.js";
import { getStockSettings, saveStockCategory, saveStockUnit, archiveStockCategory, archiveStockUnit, saveSkuNumbering } from "../../../database/repositories/modules/inventory/stockSettings.repository.js";

export function registerStockSettingsIpc() {
  ipcMain.handle("inventory:settings:get", async (_, companyId: string) => getStockSettings(await requireAuthenticatedCompanyId(companyId)));
  ipcMain.handle("inventory:settings:saveCategory", async (_, companyId: string, input: StockCategoryInput) => saveStockCategory(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:saveUnit", async (_, companyId: string, input: StockUnitInput) => saveStockUnit(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:archiveCategory", async (_, companyId: string, input: string) => archiveStockCategory(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:archiveUnit", async (_, companyId: string, input: string) => archiveStockUnit(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:saveNumbering", async (_, companyId: string, input: SkuNumberingSettings) => saveSkuNumbering(await requireAuthenticatedCompanyId(companyId), input));
}
