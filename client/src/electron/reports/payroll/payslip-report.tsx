import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

export interface PayslipCompany {
  name: string;
  legalName?: string;
  logo?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface PayslipEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  employeeNumber?: string;
}

export interface PayslipItem {
  name: string;
  displayName?: string;
  type: "EARNING" | "DEDUCTION";
  amount: number;
}

export interface PayslipReportData {
  company: PayslipCompany;
  employee: PayslipEmployee;
  month: string;
  year: number;
  items: PayslipItem[];

  totalEarnings: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
}

const COLORS = {
  gold: "#F2B705",
  dark: "#1F2937",
  text: "#374151",
  muted: "#64748B",
  border: "#CBD5E1",
  lightBorder: "#E2E8F0",
  light: "#F8FAFC",
  header: "#F1F5F9",
  white: "#FFFFFF",
  earning: "#166534",
  deduction: "#991B1B",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingLeft: 40,
    paddingRight: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },

  companySection: {
    flexDirection: "row",
    alignItems: "center",
    width: "65%",
  },

  logo: {
    width: 58,
    height: 58,
    objectFit: "contain",
    marginRight: 12,
  },

  companyInfo: {
    flexDirection: "column",
  },

  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 4,
  },

  legalName: {
    fontSize: 8,
    color: COLORS.muted,
    marginBottom: 4,
  },

  companyText: {
    fontSize: 8,
    color: COLORS.muted,
    marginBottom: 2,
  },

  reportTitleSection: {
    width: "30%",
    alignItems: "flex-end",
  },

  reportTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 5,
  },

  reportPeriod: {
    fontSize: 9,
    color: COLORS.muted,
  },

  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 7,
    marginTop: 16,
  },

  employeeBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 10,
    backgroundColor: COLORS.light,
  },

  employeeRow: {
    flexDirection: "row",
    marginBottom: 7,
  },

  employeeColumn: {
    width: "50%",
  },

  label: {
    fontSize: 7,
    color: COLORS.muted,
    marginBottom: 2,
  },

  value: {
    fontSize: 9,
    color: COLORS.dark,
    fontWeight: "bold",
  },

  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.header,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 8,
    paddingRight: 8,
  },

  tableRow: {
    flexDirection: "row",
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 8,
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightBorder,
  },

  tableRowLast: {
    flexDirection: "row",
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 8,
    paddingRight: 8,
  },

  descriptionColumn: {
    width: "55%",
  },

  typeColumn: {
    width: "20%",
    textAlign: "center",
  },

  amountColumn: {
    width: "25%",
    textAlign: "right",
  },

  tableHeaderText: {
    fontSize: 8,
    fontWeight: "bold",
    color: COLORS.dark,
  },

  tableText: {
    fontSize: 8,
    color: COLORS.text,
  },

  earningBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 3,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 6,
    paddingRight: 6,
    alignSelf: "center",
  },

  deductionBadge: {
    backgroundColor: "#FEE2E2",
    borderRadius: 3,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 6,
    paddingRight: 6,
    alignSelf: "center",
  },

  earningText: {
    fontSize: 7,
    color: COLORS.earning,
    fontWeight: "bold",
  },

  deductionText: {
    fontSize: 7,
    color: COLORS.deduction,
    fontWeight: "bold",
  },

  summaryContainer: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  summaryBox: {
    width: "48%",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 9,
    paddingRight: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightBorder,
  },

  summaryLabel: {
    fontSize: 8,
    color: COLORS.muted,
  },

  summaryValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: COLORS.dark,
  },

  netSalaryBox: {
    marginTop: 8,
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  netSalaryLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.dark,
  },

  netSalaryValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.dark,
  },

  signatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 35,
  },

  signatureBox: {
    width: "40%",
  },

  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    height: 25,
    marginBottom: 5,
  },

  signatureText: {
    fontSize: 8,
    color: COLORS.muted,
    textAlign: "center",
  },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.lightBorder,
    paddingTop: 6,
  },

  footerText: {
    fontSize: 7,
    color: COLORS.muted,
  },
});

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getItemName(item: PayslipItem): string {
  return item.displayName || item.name;
}

function getFullAddress(company: PayslipCompany): string {
  const parts = [company.address, company.city, company.country].filter(
    Boolean
  );

  return parts.join(", ");
}

export default function PayslipReportDocument({
  data,
}: {
  data: PayslipReportData;
}) {
  return (
    <Document
      title={`Bulletin de paie - ${data.employee.firstName} ${data.employee.lastName}`}
      author="Akili"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.companySection}>
            {data.company.logo ? (
              <Image src={data.company.logo} style={styles.logo} />
            ) : null}

            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{data.company.name}</Text>

              {data.company.legalName ? (
                <Text style={styles.legalName}>{data.company.legalName}</Text>
              ) : null}

              {getFullAddress(data.company) ? (
                <Text style={styles.companyText}>
                  {getFullAddress(data.company)}
                </Text>
              ) : null}

              {data.company.phone ? (
                <Text style={styles.companyText}>
                  Tel: {data.company.phone}
                </Text>
              ) : null}

              {data.company.email ? (
                <Text style={styles.companyText}>
                  Email: {data.company.email}
                </Text>
              ) : null}

              {data.company.website ? (
                <Text style={styles.companyText}>{data.company.website}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.reportTitleSection}>
            <Text style={styles.reportTitle}>BULLETIN DE PAIE</Text>

            <Text style={styles.reportPeriod}>
              {data.month} {data.year}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>INFORMATIONS DE L'EMPLOYE</Text>

        <View style={styles.employeeBox}>
          <View style={styles.employeeRow}>
            <View style={styles.employeeColumn}>
              <Text style={styles.label}>Nom complet</Text>
              <Text style={styles.value}>
                {data.employee.firstName} {data.employee.lastName}
              </Text>
            </View>

            <View style={styles.employeeColumn}>
              <Text style={styles.label}>Matricule</Text>
              <Text style={styles.value}>
                {data.employee.employeeNumber || "-"}
              </Text>
            </View>
          </View>

          <View style={styles.employeeRow}>
            <View style={styles.employeeColumn}>
              <Text style={styles.label}>Departement</Text>
              <Text style={styles.value}>
                {data.employee.department || "-"}
              </Text>
            </View>

            <View style={styles.employeeColumn}>
              <Text style={styles.label}>Poste</Text>
              <Text style={styles.value}>{data.employee.position || "-"}</Text>
            </View>
          </View>

          <View style={styles.employeeRow}>
            <View style={styles.employeeColumn}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{data.employee.email || "-"}</Text>
            </View>

            <View style={styles.employeeColumn}>
              <Text style={styles.label}>Telephone</Text>
              <Text style={styles.value}>{data.employee.phone || "-"}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>DETAIL DE LA PAIE</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.descriptionColumn}>
              <Text style={styles.tableHeaderText}>ELEMENT</Text>
            </View>

            <View style={styles.typeColumn}>
              <Text style={styles.tableHeaderText}>TYPE</Text>
            </View>

            <View style={styles.amountColumn}>
              <Text style={styles.tableHeaderText}>MONTANT</Text>
            </View>
          </View>

          {data.items.map((item, index) => {
            const isLast = index === data.items.length - 1;

            return (
              <View
                key={`${item.name}-${index}`}
                style={isLast ? styles.tableRowLast : styles.tableRow}
              >
                <View style={styles.descriptionColumn}>
                  <Text style={styles.tableText}>{getItemName(item)}</Text>
                </View>

                <View style={styles.typeColumn}>
                  <View
                    style={
                      item.type === "EARNING"
                        ? styles.earningBadge
                        : styles.deductionBadge
                    }
                  >
                    <Text
                      style={
                        item.type === "EARNING"
                          ? styles.earningText
                          : styles.deductionText
                      }
                    >
                      {item.type === "EARNING" ? "GAIN" : "RETENUE"}
                    </Text>
                  </View>
                </View>

                <View style={styles.amountColumn}>
                  <Text style={styles.tableText}>
                    {formatMoney(item.amount)} FBU
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total remuneration</Text>

              <Text style={styles.summaryValue}>
                {formatMoney(data.totalEarnings)} FBU
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Salaire brut</Text>

              <Text style={styles.summaryValue}>
                {formatMoney(data.grossSalary)} FBU
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total retenues</Text>

              <Text style={styles.summaryValue}>
                {formatMoney(data.totalDeductions)} FBU
              </Text>
            </View>

            <View style={styles.netSalaryBox}>
              <Text style={styles.netSalaryLabel}>SALAIRE NET A PAYER</Text>

              <Text style={styles.netSalaryValue}>
                {formatMoney(data.netSalary)} FBU
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.signatures}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Signature de l'employeur</Text>
          </View>

          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Signature de l'employe</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Genere par Akili</Text>

          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
