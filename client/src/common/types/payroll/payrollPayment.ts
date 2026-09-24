export type PayrollPaymentFilter = "all" | "bank" | "cash";

export const payrollPaymentLabels: Record<PayrollPaymentFilter, string> = {
  all: "Tous les modes de paiement",
  bank: "Compte bancaire",
  cash: "Espèces (cash)",
};

export function getPayrollPaymentMethod(accountNumber?: string | null): "bank" | "cash" {
  const account = accountNumber?.trim();
  return !account || account.toLowerCase() === "cash" ? "cash" : "bank";
}

export function matchesPayrollFilters(
  row: { department?: string | null; accountNumber?: string | null },
  department: string | null,
  paymentMethod: PayrollPaymentFilter
) {
  return (department === null || (row.department?.trim() ?? "") === department)
    && (paymentMethod === "all" || getPayrollPaymentMethod(row.accountNumber) === paymentMethod);
}
