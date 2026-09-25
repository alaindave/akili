import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { LateAttendanceRecord, lateReportDate, lateReportTime } from "../../../common/types/attendance/LateAttendanceReport.js";

const styles = StyleSheet.create({
  page: { padding: 30, paddingBottom: 45, fontFamily: "Helvetica", fontSize: 9 },
  title: { fontSize: 17, marginBottom: 10 },
  subtitle: { marginBottom: 12 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  header: { backgroundColor: "#F1F5F9", fontWeight: "bold" },
  cell: { padding: 7, width: "15%" },
  footer: { position: "absolute", bottom: 20, left: 30, fontSize: 8 },
});

export function LateAttendanceReportDocument({ records, companyName, startDate, endDate }: {
  records: LateAttendanceRecord[]; companyName: string; startDate: string; endDate: string;
}) {
  return <Document title="Rapport des retards" author={companyName}>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Text style={styles.title}>{companyName} — Rapport des retards</Text>
      <Text style={styles.subtitle}>Du {lateReportDate(startDate)} au {lateReportDate(endDate)} · {records.length} retards</Text>
      <View style={[styles.row, styles.header]} fixed>
        {["Date", "Employé", "Matricule", "Département", "Arrivée", "Retard (min)"].map((label, index) =>
          <Text key={label} style={[styles.cell, { width: index === 1 ? "25%" : "15%" }]}>{label}</Text>)}
      </View>
      {records.map((record) => <View key={record._id} style={styles.row} wrap={false}>
        <Text style={styles.cell}>{lateReportDate(record.date)}</Text>
        <Text style={[styles.cell, { width: "25%" }]}>{record.firstName} {record.lastName}</Text>
        <Text style={styles.cell}>{record.matricule}</Text>
        <Text style={styles.cell}>{record.department}</Text>
        <Text style={styles.cell}>{lateReportTime(record.clockIn)}</Text>
        <Text style={styles.cell}>{record.lateMinutes ?? "—"}</Text>
      </View>)}
      <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `Généré par Akili · Page ${pageNumber} sur ${totalPages}`} />
    </Page>
  </Document>;
}
