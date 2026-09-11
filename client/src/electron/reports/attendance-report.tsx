import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  DailyAttendanceEmployee,
  DailyAttendanceReport,
} from "../../common/types/AttendanceReport.js";

/* =========================================================
   COLORS
========================================================= */

const COLORS = {
  text: "#1F2937",
  muted: "#6B7280",
  border: "#D1D5DB",
  lightBorder: "#E5E7EB",
  header: "#F3F4F6",
  white: "#FFFFFF",

  present: "#166534",
  presentBg: "#DCFCE7",

  late: "#92400E",
  lateBg: "#FEF3C7",

  absent: "#991B1B",
  absentBg: "#FEE2E2",

  leave: "#1D4ED8",
  leaveBg: "#DBEAFE",
};

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 35,
    paddingHorizontal: 35,

    fontFamily: "Helvetica",
    fontSize: 9,

    color: COLORS.text,
    backgroundColor: COLORS.white,
  },

  /* -------------------------------------------------------
     HEADER
  ------------------------------------------------------- */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",

    marginBottom: 18,
  },

  companySection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  logo: {
    width: 52,
    height: 52,
    objectFit: "contain",
    marginRight: 12,
  },

  companyInfo: {
    justifyContent: "center",
  },

  companyName: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 4,
  },

  companyDetails: {
    fontSize: 7.5,
    color: COLORS.muted,

    marginBottom: 2,
  },

  reportSection: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  reportTitle: {
    fontSize: 17,
    fontWeight: "bold",

    color: COLORS.text,

    marginBottom: 5,
  },

  reportSubtitle: {
    fontSize: 8,
    color: COLORS.muted,
  },

  reportDate: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 3,
    color: COLORS.text,
  },

  divider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 14,
  },

  /* -------------------------------------------------------
     SUMMARY
  ------------------------------------------------------- */

  summary: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    borderRadius: 4,
    marginBottom: 16,
    minHeight: 45,
  },

  summaryItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: COLORS.lightBorder,
  },

  summaryItemLast: {
    borderRightWidth: 0,
  },

  summaryLabel: {
    fontSize: 6.5,
    color: COLORS.muted,
    marginBottom: 3,
  },

  summaryValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.text,
  },

  /* -------------------------------------------------------
     TABLE
  ------------------------------------------------------- */

  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  tableHeader: {
    flexDirection: "row",
    minHeight: 27,
    alignItems: "center",
    backgroundColor: COLORS.header,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  tableRow: {
    flexDirection: "row",
    minHeight: 29,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightBorder,
  },

  tableRowLast: {
    borderBottomWidth: 0,
  },

  /* -------------------------------------------------------
     COLUMNS
  ------------------------------------------------------- */

  employeeColumn: {
    width: "23%",
    paddingLeft: 9,
    paddingRight: 5,
  },

  matriculeColumn: {
    width: "12%",
    paddingHorizontal: 5,
  },

  departmentColumn: {
    width: "17%",
    paddingHorizontal: 5,
  },

  roleColumn: {
    width: "17%",
    paddingHorizontal: 5,
  },

  clockColumn: {
    width: "10%",
    paddingHorizontal: 5,
  },

  statusColumn: {
    width: "11%",
    paddingHorizontal: 5,
  },

  /* -------------------------------------------------------
     TABLE TEXT
  ------------------------------------------------------- */

  headerText: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.text,
  },

  employeeName: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: COLORS.text,
  },

  employeeSecondary: {
    fontSize: 6.5,
    color: COLORS.muted,
    marginTop: 2,
  },

  cellText: {
    fontSize: 7.5,
    color: COLORS.text,
  },

  mutedText: {
    fontSize: 7.5,
    color: COLORS.muted,
  },

  /* -------------------------------------------------------
     STATUS BADGES
  ------------------------------------------------------- */

  statusBadge: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 3,
    minWidth: 55,
    alignItems: "center",
    justifyContent: "center",
  },

  statusText: {
    fontSize: 6.5,
    fontWeight: "bold",
  },

  presentBadge: {
    backgroundColor: COLORS.presentBg,
  },

  presentText: {
    color: COLORS.present,
  },

  lateBadge: {
    backgroundColor: COLORS.lateBg,
  },

  lateText: {
    color: COLORS.late,
  },

  absentBadge: {
    backgroundColor: COLORS.absentBg,
  },

  absentText: {
    color: COLORS.absent,
  },

  leaveBadge: {
    backgroundColor: COLORS.leaveBg,
  },

  leaveText: {
    color: COLORS.leave,
  },

  /* -------------------------------------------------------
     LEGEND
  ------------------------------------------------------- */

  legend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },

  legendTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.text,
    marginRight: 2,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },

  legendText: {
    fontSize: 6.5,
    color: COLORS.muted,
  },

  /* -------------------------------------------------------
     FOOTER
  ------------------------------------------------------- */

  footer: {
    position: "absolute",
    bottom: 18,
    left: 35,
    right: 35,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.lightBorder,
    paddingTop: 6,
  },

  footerText: {
    fontSize: 7.5,
    color: COLORS.muted,
  },
});

/* =========================================================
   HELPERS
========================================================= */

function getEmployeeName(employee: DailyAttendanceEmployee) {
  const name = [employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  return name || employee.employeeId;
}

function formatTime(time?: string | null) {
  if (!time) {
    return "--";
  }

  return new Date(time).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();

  let badgeStyle = styles.presentBadge;
  let textStyle = styles.presentText;

  if (normalized === "RETARD") {
    badgeStyle = styles.lateBadge;
    textStyle = styles.lateText;
  }

  if (normalized === "ABSENT") {
    badgeStyle = styles.absentBadge;
    textStyle = styles.absentText;
  }

  if (normalized === "CONGÉ" || normalized === "CONGE") {
    badgeStyle = styles.leaveBadge;
    textStyle = styles.leaveText;
  }

  return (
    <View style={[styles.statusBadge, badgeStyle]}>
      <Text style={[styles.statusText, textStyle]}>{status}</Text>
    </View>
  );
}

/* =========================================================
   HEADER
========================================================= */

function ReportHeader({ report }: { report: DailyAttendanceReport }) {
  return (
    <>
      <View style={styles.header}>
        {/* COMPANY */}
        <View style={styles.companySection}>
          {report.company.logo ? (
            <Image src={report.company.logo} style={styles.logo} />
          ) : null}

          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{report.company.name}</Text>

            {report.company.address ? (
              <Text style={styles.companyDetails}>
                {report.company.address}
              </Text>
            ) : null}

            {report.company.city ? (
              <Text style={styles.companyDetails}>{report.company.city}</Text>
            ) : null}

            {report.company.phone ? (
              <Text style={styles.companyDetails}>{report.company.phone}</Text>
            ) : null}

            {report.company.email ? (
              <Text style={styles.companyDetails}>{report.company.email}</Text>
            ) : null}
          </View>
        </View>

        {/* REPORT */}
        <View style={styles.reportSection}>
          <Text style={styles.reportTitle}>LISTE DE PRÉSENCE</Text>
          <Text style={styles.reportDate}>
            {new Date(report.date).toLocaleDateString("fr-FR")}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />
    </>
  );
}

/* =========================================================
   SUMMARY
========================================================= */

function ReportSummary({
  employees,
}: {
  employees: DailyAttendanceEmployee[];
}) {
  const total = employees.length;

  const present = employees.filter(
    (employee) => employee.status === "PONCTUEL"
  ).length;

  const late = employees.filter(
    (employee) => employee.status === "RETARD"
  ).length;

  const absent = employees.filter(
    (employee) => employee.status === "ABSENT"
  ).length;

  const leave = employees.filter(
    (employee) => employee.status === "CONGÉ" || employee.status === "CONGE"
  ).length;

  return (
    <View style={styles.summary}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>EMPLOYÉS</Text>

        <Text style={styles.summaryValue}>{total}</Text>
      </View>

      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>PRÉSENT</Text>

        <Text style={styles.summaryValue}>{present}</Text>
      </View>

      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>RETARD</Text>

        <Text style={styles.summaryValue}>{late}</Text>
      </View>

      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>ABSENT</Text>

        <Text style={styles.summaryValue}>{absent}</Text>
      </View>

      <View style={[styles.summaryItem, styles.summaryItemLast]}>
        <Text style={styles.summaryLabel}>CONGÉ</Text>
        <Text style={styles.summaryValue}>{leave}</Text>
      </View>
    </View>
  );
}

/* =========================================================
   TABLE HEADER
========================================================= */

function TableHeader() {
  return (
    <View style={styles.tableHeader} fixed>
      <View style={styles.employeeColumn}>
        <Text style={styles.headerText}>EMPLOYÉ</Text>
      </View>

      <View style={styles.matriculeColumn}>
        <Text style={styles.headerText}>MATRICULE</Text>
      </View>

      <View style={styles.departmentColumn}>
        <Text style={styles.headerText}>DEPARTEMENT</Text>
      </View>

      <View style={styles.roleColumn}>
        <Text style={styles.headerText}>POSTE</Text>
      </View>

      <View style={styles.clockColumn}>
        <Text style={styles.headerText}>ENTRÉE</Text>
      </View>

      <View style={styles.clockColumn}>
        <Text style={styles.headerText}>SORTIE</Text>
      </View>

      <View style={styles.statusColumn}>
        <Text style={styles.headerText}>STATUT</Text>
      </View>
    </View>
  );
}

/* =========================================================
   EMPLOYEE ROW
========================================================= */

function EmployeeRow({
  employee,
  isLast,
}: {
  employee: DailyAttendanceEmployee;
  isLast: boolean;
}) {
  return (
    <View
      style={[styles.tableRow, isLast ? styles.tableRowLast : {}]}
      wrap={false}
    >
      {/* EMPLOYEE */}
      <View style={styles.employeeColumn}>
        <Text style={styles.employeeName}>{getEmployeeName(employee)}</Text>
      </View>

      {/* MATRICULE */}
      <View style={styles.matriculeColumn}>
        <Text style={styles.cellText}>{employee.matricule || "--"}</Text>
      </View>

      {/* DEPARTMENT */}
      <View style={styles.departmentColumn}>
        <Text style={styles.cellText}>{employee.department || "--"}</Text>
      </View>

      {/* ROLE */}
      <View style={styles.roleColumn}>
        <Text style={styles.cellText}>{employee.role || "--"}</Text>
      </View>

      {/* CLOCK IN */}
      <View style={styles.clockColumn}>
        <Text style={employee.clockIn ? styles.cellText : styles.mutedText}>
          {formatTime(employee.clockIn)}
        </Text>
      </View>

      {/* CLOCK OUT */}
      <View style={styles.clockColumn}>
        <Text style={employee.clockOut ? styles.cellText : styles.mutedText}>
          {formatTime(employee.clockOut)}
        </Text>
      </View>

      {/* STATUS */}
      <View style={styles.statusColumn}>
        <StatusBadge status={employee.status} />
      </View>
    </View>
  );
}

/* =========================================================
   MAIN DOCUMENT
========================================================= */

export function AttendanceReportDocument({
  report,
}: {
  report: DailyAttendanceReport;
}) {
  return (
    <Document
      title={`Rapport de présence - ${report.date}`}
      author={report.company.name}
      subject="Rapport de présence"
      creator="Akili"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* HEADER */}
        <ReportHeader report={report} />

        {/* SUMMARY */}
        <ReportSummary employees={report.employees} />

        {/* TABLE */}
        <View style={styles.table}>
          <TableHeader />

          {report.employees.map((employee, index) => (
            <EmployeeRow
              key={`${employee.employeeId}-${index}`}
              employee={employee}
              isLast={index === report.employees.length - 1}
            />
          ))}
        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Généré par Akili</Text>

          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export default AttendanceReportDocument;
