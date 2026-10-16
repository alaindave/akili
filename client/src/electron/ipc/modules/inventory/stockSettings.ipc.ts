import { ipcMain } from "../../companyIpc.js";
import { createCustomField, getCustomFields, updateCustomField, archiveCustomField } from "../../../services/modules/inventory/inventoryCustomField.service.js";
import { getOpeningStockState, saveOpeningStockDraft, submitOpeningStock } from "../../../services/modules/inventory/openingStock.service.js";
import type { OpeningStockDraft } from "../../../../common/types/inventory/StockSettings.js";
import { requireAuthenticatedCompanyId } from "./inventoryItem.ipc.js";
import type { StockCategoryInput, StockUnitInput, SkuNumberingSettings } from "../../../../common/types/inventory/StockSettings.js";
import { getStockSettings, saveStockCategory, saveStockUnit, archiveStockCategory, archiveStockUnit, saveSkuNumbering } from "../../../database/repositories/modules/inventory/stockSettings.repository.js";

export function registerStockSettingsIpc() {
  ipcMain.handle("inventory:settings:updateCustomField", async (_, companyId: string, input: unknown) => updateCustomField(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:archiveCustomField", async (_, companyId: string, id: unknown) => archiveCustomField(await requireAuthenticatedCompanyId(companyId), id));
  ipcMain.handle("inventory:settings:createCustomField", async (_, companyId: string, input: unknown) => createCustomField(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:getCustomFields", async (_, companyId: string) => getCustomFields(await requireAuthenticatedCompanyId(companyId)));
  ipcMain.handle("inventory:settings:getInitialization", async (_, companyId: string) => getOpeningStockState(await requireAuthenticatedCompanyId(companyId)));
  ipcMain.handle("inventory:settings:saveOpeningDraft", async (_, companyId: string, input: OpeningStockDraft) => saveOpeningStockDraft(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:submitOpeningDraft", async (_, companyId: string, input: OpeningStockDraft) => submitOpeningStock(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:get", async (_, companyId: string) => getStockSettings(await requireAuthenticatedCompanyId(companyId)));
  ipcMain.handle("inventory:settings:saveCategory", async (_, companyId: string, input: StockCategoryInput) => saveStockCategory(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:saveUnit", async (_, companyId: string, input: StockUnitInput) => saveStockUnit(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:archiveCategory", async (_, companyId: string, input: string) => archiveStockCategory(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:archiveUnit", async (_, companyId: string, input: string) => archiveStockUnit(await requireAuthenticatedCompanyId(companyId), input));
  ipcMain.handle("inventory:settings:saveNumbering", async (_, companyId: string, input: SkuNumberingSettings) => saveSkuNumbering(await requireAuthenticatedCompanyId(companyId), input));
}
