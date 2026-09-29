import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import {
  PayslipDocumentData,
  payslipPeriod,
  payslipRows,
} from "../../../common/types/payroll/PayslipDocument.js";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 58,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#171717",
  },

  /*
   * Header
   */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d4",
    paddingBottom: 18,
    marginBottom: 20,
  },

  company: {
    width: "55%",
  },

  titleBlock: {
    width: "40%",
    textAlign: "right",
  },

  companyName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },

  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },

  detail: {
    fontSize: 8,
    lineHeight: 1.5,
    color: "#525252",
  },

  /*
   * Employee information
   *
   * One vertical column, matching the desktop payslip.
   */
  identity: {
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d4",
    marginBottom: 20,
    paddingBottom: 8,
  },

  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 5,
  },

  label: {
    width: "32%",
    fontSize: 8,
    color: "#525252",
  },

  value: {
    width: "68%",
    fontSize: 9,
    fontWeight: "bold",
  },

  /*
   * Payroll sections
   */
  sections: {
    flexDirection: "row",
    width: "100%",
  },

  section: {
    width: "50%",
    borderWidth: 1,
    borderColor: "#d4d4d4",
  },

  sectionLeft: {
    marginRight: 6,
  },

  sectionRight: {
    marginLeft: 6,
  },

  sectionHeader: {
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d4",
    paddingVertical: 9,
    paddingHorizontal: 10,
  },

  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  /*
   * Payroll rows
   *
   * Both sections use exactly the same number of rows.
   * This guarantees that the Total rows align horizontally.
   */
  row: {
    flexDirection: "row",
    minHeight: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },

  description: {
    width: "62%",
    paddingRight: 6,
    fontSize: 8.5,
  },

  amount: {
    width: "38%",
    textAlign: "right",
    fontSize: 8.5,
    fontWeight: "bold",
  },

  /*
   * Section total
   */
  totals: {
    flexDirection: "row",
    minHeight: 34,
    borderTopWidth: 2,
    borderTopColor: "#171717",
    paddingVertical: 9,
    paddingHorizontal: 8,
    backgroundColor: "#ffffff",
  },

  totalLabel: {
    width: "62%",
    fontSize: 8.5,
    fontWeight: "bold",
  },

  totalAmount: {
    width: "38%",
    textAlign: "right",
    fontSize: 8.5,
    fontWeight: "bold",
  },

  /*
   * Net salary
   */
  net: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#171717",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 20,
  },

  netLabel: {
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  netAmount: {
    fontSize: 11,
    fontWeight: "bold",
  },

  /*
   * Bottom footer
   */
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#d4d4d4",
    paddingTop: 8,
    fontSize: 7,
    color: "#525252",
  },
});
const formatMoney = (value: number, currency: string): string => {
  const amount = Math.round(Number(value) || 0);

  const formattedAmount = amount
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return `${formattedAmount} ${currency}`.trim();
};

export default function PayslipReportDocument({
  data,
}: {
  data: PayslipDocumentData;
}) {
  const { company, employee, payroll, currency } = data;

  const rows = payslipRows(data);

  const earnings = rows.filter((row) => row.earning !== null);

  const deductions = rows.filter((row) => row.deduction !== null);

  /*
   * Important:
   *
   * Both sections must have the same number of physical rows.
   * If Rémunérations has 5 items and Retenues has 2 items,
   * the Retenues section receives 3 empty rows.
   *
   * This keeps both Total rows on the same horizontal line.
   */
  const maxRows = Math.max(earnings.length, deductions.length);

  return (
    <Document
      title={`Bulletin de paie - ${employee.firstName} ${employee.lastName} - ${payroll.month}/${payroll.year}`}
      author={company.name}
    >
      <Page size="A4" style={styles.page}>
        {/* =========================================================
            HEADER
        ========================================================= */}

        <View style={styles.header} wrap={false}>
          {/* Company */}
          <View style={styles.company}>
            <Text style={styles.companyName}>{company.name}</Text>

            {!!company.legalName && company.legalName !== company.name && (
              <Text style={styles.detail}>{company.legalName}</Text>
            )}

            <Text style={styles.detail}>
              {[company.address, company.city, company.country]
                .filter(Boolean)
                .join(", ")}
            </Text>

            {!!company.phone && (
              <Text style={styles.detail}>{company.phone}</Text>
            )}

            {!!company.email && (
              <Text style={styles.detail}>{company.email}</Text>
            )}
          </View>

          {/* Payslip title / status */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>BULLETIN DE PAIE</Text>

            <Text style={styles.detail}>
              Période du {payslipPeriod(payroll.month, payroll.year)}
            </Text>

            <Text style={styles.detail}>Statut : {payroll.status}</Text>
          </View>
        </View>

        {/* =========================================================
            EMPLOYEE INFORMATION
        ========================================================= */}

        <View style={styles.identity} wrap={false}>
          {[
            ["Nom de l’employé", `${employee.firstName} ${employee.lastName}`],
            ["Matricule", employee.matricule || "—"],
            ["Département", employee.department || "—"],
            ["Poste", employee.role || "—"],
          ].map(([label, value]) => (
            <View style={styles.field} key={label}>
              <Text style={styles.label}>{label}</Text>

              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>

        {/* =========================================================
            PAYROLL SECTIONS
        ========================================================= */}

        <View style={styles.sections} wrap={false}>
          {/* =======================================================
              RÉMUNÉRATIONS
          ======================================================= */}

          <View style={[styles.section, styles.sectionLeft]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>RÉMUNÉRATIONS</Text>
            </View>

            {Array.from({
              length: maxRows,
            }).map((_, index) => {
              const row = earnings[index];

              return (
                <View style={styles.row} key={`earning-${index}`} wrap={false}>
                  <Text style={styles.description}>{row?.label || "—"}</Text>

                  <Text style={styles.amount}>
                    {row ? formatMoney(row.earning!, currency) : "—"}
                  </Text>
                </View>
              );
            })}

            {/* Total rémunérations */}
            <View style={styles.totals} wrap={false}>
              <Text style={styles.totalLabel}>Total</Text>

              <Text style={styles.totalAmount}>
                {formatMoney(payroll.grossSalary, currency)}
              </Text>
            </View>
          </View>

          {/* =======================================================
              RETENUES
          ======================================================= */}

          <View style={[styles.section, styles.sectionRight]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>RETENUES</Text>
            </View>

            {Array.from({
              length: maxRows,
            }).map((_, index) => {
              const row = deductions[index];

              return (
                <View
                  style={styles.row}
                  key={`deduction-${index}`}
                  wrap={false}
                >
                  <Text style={styles.description}>{row?.label || "—"}</Text>

                  <Text style={styles.amount}>
                    {row ? formatMoney(row.deduction!, currency) : "—"}
                  </Text>
                </View>
              );
            })}

            {/* Total retenues */}
            <View style={styles.totals} wrap={false}>
              <Text style={styles.totalLabel}>Total</Text>

              <Text style={styles.totalAmount}>
                {formatMoney(payroll.totalDeductions, currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* =========================================================
            NET À PAYER
        ========================================================= */}

        <View style={styles.net} wrap={false}>
          <Text style={styles.netLabel}>NET À PAYER</Text>

          <Text style={styles.netAmount}>
            {formatMoney(payroll.netSalary, currency)}
          </Text>
        </View>

        {/* =========================================================
            FOOTER
        ========================================================= */}

        <View style={styles.footer} fixed>
          <Text>
            Document confidentiel •{" "}
            {employee.matricule || `${employee.firstName} ${employee.lastName}`}
          </Text>

          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
