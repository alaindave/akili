export function getMonthName(month: number) {
  // If your input is 1-indexed (1-12), subtract 1 because JS months are 0-indexed (0-11)
  const zeroBasedMonth = month - 1;

  // Create a dummy date (using year 2000 to avoid leap year shifts)
  const date = new Date(2000, zeroBasedMonth, 1);

  // Format and return the month name
  return date.toLocaleString("fr-FR", { month: "long" });
}
