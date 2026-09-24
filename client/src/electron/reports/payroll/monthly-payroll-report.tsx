import { getPayrollPaymentMethod, payrollPaymentLabels, PayrollPaymentFilter } from "../../../common/types/payroll/payrollPayment.js";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import Company from "../../../common/types/Company.js";
import {
  PayrollResult,
  PayrollRun,
  PayrollStatus,
} from "../../../common/types/payroll/Payroll.js";

const statusColors: Record<
  PayrollStatus,
  { color: string; backgroundColor: string }
> = {
  BROUILLON: { color: "#92400E", backgroundColor: "#FEF3C7" },
  VERIFICATION: { color: "#1D4ED8", backgroundColor: "#DBEAFE" },
  APPROUVÉ: { color: "#166534", backgroundColor: "#DCFCE7" },
  PAYÉ: { color: "#6B21A8", backgroundColor: "#F3E8FF" },
  ANNULÉ: { color: "#991B1B", backgroundColor: "#FEE2E2" },
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 35,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1F2937",
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  company: { width: "48%" },
  companyName: { fontSize: 15, fontWeight: "bold", marginBottom: 4 },
  details: { fontSize: 7.5, color: "#6B7280", marginBottom: 2 },
  report: { width: "48%", alignItems: "flex-end" },
  title: { fontSize: 17, fontWeight: "bold", marginBottom: 5 },
  period: { fontSize: 11, fontWeight: "bold", marginBottom: 5 },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
    marginBottom: 14,
  },
  summary: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    marginBottom: 16,
    minHeight: 45,
  },
  summaryItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
  },
  summaryLabel: { fontSize: 6.5, color: "#6B7280", marginBottom: 3 },
  summaryValue: { fontSize: 11, fontWeight: "bold" },
  table: { borderWidth: 1, borderColor: "#D1D5DB" },
  row: {
    flexDirection: "row",
    minHeight: 29,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableHeader: {
    backgroundColor: "#F3F4F6",
    fontWeight: "bold",
    minHeight: 27,
  },
  cell: { paddingHorizontal: 5, paddingVertical: 6, fontSize: 7.5 },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 3,
    fontSize: 6.5,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 35,
    right: 35,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 6,
    fontSize: 7.5,
    color: "#6B7280",
  },
});

function StatusBadge({ status }: { status: PayrollStatus }) {
  return (
    <Text
      style={[
        styles.badge,
        statusColors[status] ?? {
          color: "#374151",
          backgroundColor: "#F3F4F6",
        },
      ]}
    >
      {status}
    </Text>
  );
}

export function MonthlyPayrollReportDocument({
  company,
  run,
  results,
  department,
  currency,
  paymentMethod = "all",
}: {
  company: Company;
  run: PayrollRun;
  results: PayrollResult[];
  department: string | null;
  currency: string;
  paymentMethod?: PayrollPaymentFilter;
}) {
  const money = (value: number) =>
    `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
      .format(Math.ceil(value))
      .replace(/[\u202f\u00a0]/g, " ")} ${currency}`;
  const period = new Date(run.year, run.month - 1, 1).toLocaleDateString(
    "fr-FR",
    { month: "long", year: "numeric" }
  );
  const totals = results.reduce(
    (sum, row) => ({
      base: sum.base + row.baseSalary,
      earnings: sum.earnings + row.totalEarnings,
      deductions: sum.deductions + row.totalDeductions,
      net: sum.net + row.netSalary,
    }),
    { base: 0, earnings: 0, deductions: 0, net: 0 }
  );
  const summary = [
    ["EMPLOYÉS", String(results.length)],
    ["SALAIRES", money(totals.base)],
    ["RÉMUNÉRATIONS", money(totals.earnings)],
    ["DÉDUCTIONS", money(totals.deductions)],
    ["NET", money(totals.net)],
  ];
  const columns = [
    "Employé",
    "Département",
    "Compte / Paiement",
    "Salaire de base",
    "Rémunérations",
    "Déductions",
    "Salaire net",
  ];
  const widths = ["20%", "12%", "12%", "14%", "14%", "14%", "14%"];
  return (
    <Document
      title={`Rapport mensuel de paie - ${period}`}
      author={company.name}
      creator="Akili"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.company}>
            <Text style={styles.companyName}>{company.name}</Text>
            <Text style={styles.details}>{company.address}</Text>
            <Text style={styles.details}>
              {[company.city, company.country].filter(Boolean).join(", ")}
            </Text>
            <Text style={styles.details}>{company.email}</Text>
          </View>
          <View style={styles.report}>
            <Text style={styles.title}>RAPPORT MENSUEL DE PAIE</Text>
            <Text style={styles.period}>{period}</Text>
            <Text style={styles.details}>
              {department === null
                ? "Tous les départements"
                : department || "Sans département"}
            </Text>
            <Text style={styles.details}>{payrollPaymentLabels[paymentMethod]}</Text>
            <StatusBadge status={run.status} />
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.summary} wrap={false}>
          {summary.map(([label, value]) => (
            <View key={label} style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.table}>
          <View style={[styles.row, styles.tableHeader]} fixed>
            {columns.map((label, index) => (
              <Text
                key={label}
                style={[
                  styles.cell,
                  {
                    width: widths[index],
                    textAlign: index >= 3 ? "right" : "left",
                  },
                ]}
              >
                {label}
              </Text>
            ))}
          </View>
          {results.map((row, index) => (
            <View key={row._id ?? index} style={styles.row} wrap={false}>
              {[
                [row.firstName, row.lastName].filter(Boolean).join(" ") ||
                  row.employeeId ||
                  "--",
                row.department?.trim() || "Sans département",
                getPayrollPaymentMethod(row.accountNumber) === "bank"
                  ? row.accountNumber!.trim()
                  : payrollPaymentLabels.cash,
                money(row.baseSalary),
                money(row.totalEarnings),
                money(row.totalDeductions),
                money(row.netSalary),
              ].map((value, i) => (
                <Text
                  key={i}
                  style={[
                    styles.cell,
                    { width: widths[i], textAlign: i >= 3 ? "right" : "left" },
                  ]}
                >
                  {value}
                </Text>
              ))}
            </View>
          ))}
          {results.length === 0 && (
            <Text style={styles.cell}>Aucun résultat pour ces filtres.</Text>
          )}
          <View style={[styles.row, styles.tableHeader]} wrap={false}>
            <Text style={[styles.cell, { width: "44%" }]}>TOTAL</Text>
            {[totals.base, totals.earnings, totals.deductions, totals.net].map(
              (value, i) => (
                <Text
                  key={i}
                  style={[
                    styles.cell,
                    { width: widths[i + 3], textAlign: "right" },
                  ]}
                >
                  {money(value)}
                </Text>
              )
            )}
          </View>
        </View>
        <View style={styles.footer} fixed>
          <Text>Généré par Akili</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} sur ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
