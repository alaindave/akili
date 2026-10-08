// Keep the preview and persisted SKU prefix consistent, including accented names.
export function categorySkuPrefix(name: string): string {
  return Array.from(name.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^\p{L}]/gu, "")).slice(0, 3).join("");
}
