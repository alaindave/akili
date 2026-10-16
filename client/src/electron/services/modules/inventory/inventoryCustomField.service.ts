import { z } from "zod";
import { generateCustomFieldKey } from "../../../../common/types/inventory/customFieldValidation.js";
import { getInventoryCustomFields, insertInventoryCustomField, updateInventoryCustomField } from "../../../database/repositories/modules/inventory/inventoryCustomField.repository.js";

const companySchema = z.string().trim().min(1);
const updateSchema = z.object({ id: z.string().trim().min(1), label: z.string().trim().min(1).max(100) }).strict();

export function updateCustomField(companyId: string, input: unknown) {
  const company = companySchema.parse(companyId);
  const { id, label } = updateSchema.parse(input);
  return updateInventoryCustomField(company, id, { label });
}

export function archiveCustomField(companyId: string, id: unknown) {
  return updateInventoryCustomField(companySchema.parse(companyId), z.string().trim().min(1).parse(id), { isActive: 0 });
}
const definitionSchema = z.object({
  entity: z.enum(["ITEM", "CATEGORY", "WAREHOUSE", "LOCATION", "DOCUMENT", "DOCUMENT_LINE"]),
  label: z.string().trim().min(1).max(100),
}).strict();

export function getCustomFields(companyId: string) {
  return getInventoryCustomFields(companySchema.parse(companyId));
}
export function createCustomField(companyId: string, input: unknown) {
  const company = companySchema.parse(companyId);
  const definition = definitionSchema.parse(input);
  return insertInventoryCustomField(company, { ...definition, key: generateCustomFieldKey(definition.label) });
}
