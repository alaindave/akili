import { z } from "zod";

export const customFieldKeySchema = z.string().trim().min(1).max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "La clé doit commencer par une lettre minuscule et contenir uniquement lettres minuscules, chiffres et underscores.")
  .refine(key => !["constructor", "prototype", "__proto__"].includes(key), "Clé réservée.");

export const customFieldValuesSchema = z.record(customFieldKeySchema, z.string().max(2000))
  .refine(values => Object.keys(values).length <= 100, "Maximum 100 champs personnalisés.");

/** Only used at creation: labels can change without renaming stored values. */
export function generateCustomFieldKey(label: string): string {
  let key = label.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!key) {
    throw new Error("Le libellé doit contenir au moins une lettre latine ou un chiffre pour générer la clé.");
  }
  if (!/^[a-z]/.test(key) || ["constructor", "prototype"].includes(key)) key = `field_${key}`;
  return customFieldKeySchema.parse(key.slice(0, 64).replace(/_+$/g, ""));
}
