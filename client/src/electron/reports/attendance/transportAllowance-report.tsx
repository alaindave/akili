import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

import {
  TransportAllowanceWeeklyReport,
  TransportAllowanceEmployee,
  TransportAllowanceDay,
} from "../../../common/types/hr/attendance/TransportAllowance.js";

interface CompanyInfo {
  name: string;
  legalName?: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoPath?: string | null;
}

interface Props {
  report: TransportAllowanceWeeklyReport;
  company: CompanyInfo;
  currency: string;
}

/*
 * ============================================================
 * COLORS
 * ============================================================
 */

const COLORS = {
  black: "#000000",
  gray: "#555555",
  lightGray: "#F3F3F3",
  border: "#CCCCCC",
  white: "#FFFFFF",
};

/*
 * ============================================================
 * STYLES
 * ============================================================
 */

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 32,
    paddingLeft: 30,
    paddingRight: 30,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },

  /*
   * HEADER
   */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  companySection: {
    flexDirection: "row",
    width: "55%",
  },

  logo: {
    width: 58,
    height: 58,
    objectFit: "contain",
    marginRight: 10,
  },

  companyText: {
    flexDirection: "column",
    justifyContent: "flex-start",
  },

  companyName: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: COLORS.black,
    marginBottom: 3,
  },

  companyLegalName: {
    fontSize: 8,
    color: COLORS.gray,
    marginBottom: 2,
  },

  companyDetails: {
    fontSize: 7,
    color: COLORS.gray,
    lineHeight: 1.35,
  },

  reportHeader: {
    width: "42%",
    alignItems: "flex-end",
  },

  reportTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: COLORS.black,
    textAlign: "right",
    marginBottom: 5,
  },

  reportSubtitle: {
    fontSize: 8,
    color: COLORS.gray,
    textAlign: "right",
    lineHeight: 1.4,
  },

  /*
   * SUMMARY
   */

  summary: {
    flexDirection: "row",
    marginTop: 14,
    marginBottom: 12,
    gap: 8,
  },

  summaryBox: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
  },

  summaryBoxHighlight: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
  },

  summaryLabel: {
    fontSize: 7,
    color: COLORS.gray,
    marginBottom: 3,
  },

  summaryValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: COLORS.black,
  },

  /*
   * RULE
   */

  ruleBox: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },

  ruleTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },

  ruleText: {
    fontSize: 7,
    color: COLORS.gray,
    lineHeight: 1.4,
  },

  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.black,
    minHeight: 30,
    alignItems: "stretch",
  },

  tableRow: {
    flexDirection: "row",
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: "stretch",
  },

  tableRowLast: {
    flexDirection: "row",
    minHeight: 34,
    alignItems: "stretch",
  },

  tableRowAlternate: {
    backgroundColor: "#FAFAFA",
  },

  employeeColumn: {
    width: "24%",
    justifyContent: "center",
    paddingLeft: 6,
    paddingRight: 4,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },

  dayColumn: {
    width: "10%",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 2,
    paddingRight: 2,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },

  rateColumn: {
    width: "12%",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 3,
    paddingRight: 3,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },

  totalColumn: {
    width: "14%",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 3,
    paddingRight: 3,
    backgroundColor: COLORS.white,
  },

  headerText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
    textAlign: "center",
  },

  headerEmployeeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
    textAlign: "left",
  },

  employeeName: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },

  employeeMatricule: {
    fontSize: 6.5,
    color: COLORS.gray,
  },

  dayAmount: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: COLORS.black,
    textAlign: "center",
  },

  dayLate: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: COLORS.black,
    textAlign: "center",
  },

  dayAbsent: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: COLORS.black,
    textAlign: "center",
  },

  dayLeave: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: COLORS.gray,
    textAlign: "center",
  },

  dayNone: {
    fontSize: 8,
    color: COLORS.gray,
    textAlign: "center",
  },

  rateText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },

  totalText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },

  /*
   * TOTAL
   */

  grandTotal: {
    flexDirection: "row",
    marginTop: 10,
    padding: 10,
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    justifyContent: "flex-end",
    alignItems: "center",
  },

  grandTotalLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginRight: 15,
  },

  grandTotalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLORS.black,
  },

  /*
   * SIGNATURES
   */

  signatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
  },

  signatureBox: {
    width: "30%",
    alignItems: "center",
  },

  signatureTitle: {
    fontSize: 7,
    color: COLORS.gray,
    marginBottom: 28,
    textAlign: "center",
  },

  signatureLine: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.black,
    marginBottom: 4,
  },

  signatureName: {
    fontSize: 7,
    color: COLORS.gray,
    textAlign: "center",
  },

  /*
   * FOOTER
   */

  footer: {
    position: "absolute",
    bottom: 14,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 5,
  },

  footerText: {
    fontSize: 6.5,
    color: COLORS.gray,
  },
});

/*
 * ============================================================
 * MAIN PDF
 * ============================================================
 */

const TransportAllowancePdf: React.FC<Props> = ({
  report,
  company,
  currency,
}) => {
  return (
    <Document
      title="Rapport de frais de déplacement"
      author={company.name}
      subject={`Frais de déplacement - semaine du ${report.weekStart} au ${report.weekEnd}`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Header company={company} report={report} />
        <Summary report={report} currency={currency} />
        <TransportAllowanceTable
          employees={report.employees}
          currency={currency}
        />
        <GrandTotal total={report.totalAllowance} currency={currency} />
        <Signatures />
        <Footer report={report} />
      </Page>
    </Document>
  );
};

export default TransportAllowancePdf;

/*
 * ============================================================
 * HEADER
 * ============================================================
 */

interface HeaderProps {
  company: CompanyInfo;
  report: TransportAllowanceWeeklyReport;
}

const Header: React.FC<HeaderProps> = ({ company, report }) => {
  return (
    <View style={styles.header}>
      <View style={styles.companySection}>
        {company.logoPath ? (
          <Image src={company.logoPath} style={styles.logo} />
        ) : null}

        <View style={styles.companyText}>
          <Text style={styles.companyName}>{company.name || "ENTREPRISE"}</Text>

          {company.legalName ? (
            <Text style={styles.companyLegalName}>{company.legalName}</Text>
          ) : null}

          <Text style={styles.companyDetails}>
            {buildCompanyDetails(company)}
          </Text>
        </View>
      </View>

      <View style={styles.reportHeader}>
        <Text style={styles.reportTitle}>RAPPORT DE FRAIS</Text>

        <Text style={styles.reportTitle}>DE DEPLACEMENT</Text>

        <Text style={styles.reportSubtitle}>
          Semaine du {formatFrenchDate(report.weekStart)}
          {"\n"}
          au {formatFrenchDate(report.weekEnd)}
        </Text>
      </View>
    </View>
  );
};

/*
 * ============================================================
 * SUMMARY
 * ============================================================
 */

const Summary: React.FC<{
  report: TransportAllowanceWeeklyReport;
  currency: string;
}> = ({ report, currency }) => {
  return (
    <View style={styles.summary}>
      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>EMPLOYÉS</Text>

        <Text style={styles.summaryValue}>{report.totalEmployees}</Text>
      </View>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>PÉRIODE</Text>

        <Text style={styles.summaryValue}>
          {formatShortDate(report.weekStart)} -{" "}
          {formatShortDate(report.weekEnd)}
        </Text>
      </View>

      <View style={styles.summaryBoxHighlight}>
        <Text style={styles.summaryLabel}>TOTAL À PAYER</Text>

        <Text style={styles.summaryValue}>
          {formatMoney(report.totalAllowance)} {currency}
        </Text>
      </View>
    </View>
  );
};

/*
 * ============================================================
 * TABLE
 * ============================================================
 */

const TransportAllowanceTable: React.FC<{
  employees: TransportAllowanceEmployee[];
  currency: string;
}> = ({ employees, currency }) => {
  return (
    <View style={styles.table}>
      <TableHeader />

      {employees.map((employee, index) => (
        <EmployeeRow
          key={employee.employeeId}
          employee={employee}
          currency={currency}
          index={index}
          isLast={index === employees.length - 1}
        />
      ))}
    </View>
  );
};

/*
 * ============================================================
 * TABLE HEADER
 * ============================================================
 */

const TableHeader: React.FC = () => {
  return (
    <View style={styles.tableHeader}>
      <View style={styles.employeeColumn}>
        <Text style={styles.headerEmployeeText}>EMPLOYÉ</Text>
      </View>

      <View style={styles.dayColumn}>
        <Text style={styles.headerText}>LUNDI</Text>
      </View>

      <View style={styles.dayColumn}>
        <Text style={styles.headerText}>MARDI</Text>
      </View>

      <View style={styles.dayColumn}>
        <Text style={styles.headerText}>MERCREDI</Text>
      </View>

      <View style={styles.dayColumn}>
        <Text style={styles.headerText}>JEUDI</Text>
      </View>

      <View style={styles.dayColumn}>
        <Text style={styles.headerText}>VENDREDI</Text>
      </View>

      <View style={styles.rateColumn}>
        <Text style={styles.headerText}>MONTANT/JOUR</Text>
      </View>

      <View style={styles.totalColumn}>
        <Text style={styles.headerText}>TOTAL</Text>
      </View>
    </View>
  );
};

/*
 * ============================================================
 * EMPLOYEE ROW
 * ============================================================
 */

interface EmployeeRowProps {
  employee: TransportAllowanceEmployee;
  currency: string;

  index: number;

  isLast: boolean;
}

const EmployeeRow: React.FC<EmployeeRowProps> = ({
  employee,
  currency,
  index,
  isLast,
}) => {
  const rowStyle = isLast ? styles.tableRowLast : styles.tableRow;

  return (
    <View
      style={[rowStyle, index % 2 === 1 ? styles.tableRowAlternate : {}]}
      wrap={false}
    >
      <View style={styles.employeeColumn}>
        <Text style={styles.employeeName}>
          {employee.lastName} {employee.firstName}
        </Text>

        <Text style={styles.employeeMatricule}>
          {employee.matricule || "—"}
        </Text>
      </View>

      <DayCell day={employee.monday} ratePerDay={employee.ratePerDay} />

      <DayCell day={employee.tuesday} ratePerDay={employee.ratePerDay} />

      <DayCell day={employee.wednesday} ratePerDay={employee.ratePerDay} />

      <DayCell day={employee.thursday} ratePerDay={employee.ratePerDay} />

      <DayCell day={employee.friday} ratePerDay={employee.ratePerDay} />

      <View style={styles.rateColumn}>
        <Text style={styles.rateText}>{formatMoney(employee.ratePerDay)}</Text>
      </View>

      <View style={styles.totalColumn}>
        <Text style={styles.totalText}>
          {formatMoney(employee.weeklyAllowance)} {currency}
        </Text>
      </View>
    </View>
  );
};

/*
 * ============================================================
 * DAY CELL
 * ============================================================
 */

const DayCell: React.FC<{
  day: TransportAllowanceDay;

  ratePerDay: number;
}> = ({ day, ratePerDay }) => {
  if (day.status === "WORKED") {
    return (
      <View style={styles.dayColumn}>
        <Text style={styles.dayAmount}>{formatMoney(ratePerDay)}</Text>
      </View>
    );
  }

  if (day.status === "LATE") {
    return (
      <View style={styles.dayColumn}>
        <Text style={styles.dayLate}>RETARD</Text>
      </View>
    );
  }

  if (day.status === "ABSENT") {
    return (
      <View style={styles.dayColumn}>
        <Text style={styles.dayAbsent}>ABSENT</Text>
      </View>
    );
  }

  if (day.status === "LEAVE") {
    return (
      <View style={styles.dayColumn}>
        <Text style={styles.dayLeave}>CONGÉ</Text>
      </View>
    );
  }

  return (
    <View style={styles.dayColumn}>
      <Text style={styles.dayNone}>—</Text>
    </View>
  );
};

/*
 * ============================================================
 * GRAND TOTAL
 * ============================================================
 */

const GrandTotal: React.FC<{
  total: number;
  currency: string;
}> = ({ total, currency }) => {
  return (
    <View style={styles.grandTotal}>
      <Text style={styles.grandTotalLabel}>TOTAL:</Text>
      <Text style={styles.grandTotalValue}>
        {formatMoney(total)} {currency}
      </Text>
    </View>
  );
};

/*
 * ============================================================
 * SIGNATURES
 * ============================================================
 */

const Signatures: React.FC = () => {
  return (
    <View style={styles.signatures}>
      <View style={styles.signatureBox}>
        <Text style={styles.signatureTitle}>Préparé par</Text>

        <View style={styles.signatureLine} />

        <Text style={styles.signatureName}>Signature</Text>
      </View>

      <View style={styles.signatureBox}>
        <Text style={styles.signatureTitle}>Vérifié par</Text>

        <View style={styles.signatureLine} />

        <Text style={styles.signatureName}>Signature</Text>
      </View>

      <View style={styles.signatureBox}>
        <Text style={styles.signatureTitle}>Approuvé par</Text>

        <View style={styles.signatureLine} />

        <Text style={styles.signatureName}>Signature</Text>
      </View>
    </View>
  );
};

/*
 * ============================================================
 * FOOTER
 * ============================================================
 */

const Footer: React.FC<{
  report: TransportAllowanceWeeklyReport;
}> = ({ report }) => {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Rapport de frais de déplacement</Text>

      <Text style={styles.footerText}>
        Généré le {formatDateTime(report.generatedAt)}
      </Text>
    </View>
  );
};

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function formatMoney(amount: number): string {
  // Helvetica does not support French narrow no-break thousands separators.
  return new Intl.NumberFormat("fr-FR")
    .format(amount)
    .replace(/[\u00a0\u202f]/g, " ");
}

function formatFrenchDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildCompanyDetails(company: CompanyInfo): string {
  const lines: string[] = [];

  const addressParts = [company.address, company.city, company.country].filter(
    Boolean
  );

  if (addressParts.length > 0) {
    lines.push(addressParts.join(", "));
  }

  if (company.phone) {
    lines.push(`Tél: ${company.phone}`);
  }

  if (company.email) {
    lines.push(`Email: ${company.email}`);
  }

  if (company.website) {
    lines.push(company.website);
  }

  return lines.join("\n");
}
