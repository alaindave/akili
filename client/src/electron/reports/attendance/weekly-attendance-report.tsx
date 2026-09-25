import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  WeeklyAttendanceReport,
  formatAttendanceReportDate,
} from "../../../common/types/attendance/WeeklyAttendanceReport.js";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    paddingBottom: 45,
    fontFamily: "Helvetica",
    fontSize: 9,
  },
  title: { fontSize: 17, marginBottom: 8, fontWeight: "bold" },
  subtitle: { marginBottom: 12, color: "#475569" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  header: { backgroundColor: "#F1F5F9", fontWeight: "bold" },
  cell: { padding: 7, width: "12%" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    color: "#64748B",
    fontSize: 8,
  },
});

export function WeeklyAttendanceReportDocument({
  report,
  companyName,
}: {
  report: WeeklyAttendanceReport;
  companyName: string;
}) {
  return (
    <Document title="Rapport de présence hebdomadaire" author={companyName}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{companyName} — Présence hebdomadaire</Text>
        <Text style={styles.subtitle}>
          Du {formatAttendanceReportDate(report.dates[0])} au{" "}
          {formatAttendanceReportDate(report.dates[4])} · Lundi au vendredi
        </Text>
        <View style={[styles.row, styles.header]} fixed>
          <Text style={[styles.cell, { width: "25%" }]}>
            Employé / Matricule
          </Text>
          <Text style={[styles.cell, { width: "15%" }]}>Département</Text>
          {report.dates.map((date) => (
            <Text key={date} style={styles.cell}>
              {new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
                weekday: "short",
              })}
              {"\n"}
              {formatAttendanceReportDate(date)}
            </Text>
          ))}
        </View>
        {report.employees.map((employee) => (
          <View key={employee.employeeId} style={styles.row} wrap={false}>
            <Text style={[styles.cell, { width: "25%" }]}>
              {employee.firstName} {employee.lastName}
              {"\n"}
              {employee.matricule}
            </Text>
            <Text style={[styles.cell, { width: "15%" }]}>
              {employee.department}
            </Text>
            {employee.days.map((value, index) => (
              <Text key={index} style={styles.cell}>
                {value}
              </Text>
            ))}
          </View>
        ))}
        {!report.employees.length && (
          <Text style={styles.subtitle}>Aucun employé pour cette semaine.</Text>
        )}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Généré par Akili · Page ${pageNumber} sur ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
