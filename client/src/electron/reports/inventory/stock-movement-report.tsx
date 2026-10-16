import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import type { StockMovementReportData } from "../../../common/types/inventory/StockMovementReport.js";

const DASH = "\u2014";

const number = (value: number | undefined) =>
  value == null
    ? DASH
    : value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });

// Standard PDF fonts need ordinary spaces instead of locale nonbreaking spaces.
const money = (value: number | undefined) =>
  number(value).replace(/[\u00a0\u202f]/g, " ");

const dateTime = (value?: string) =>
  !value || Number.isNaN(new Date(value).getTime())
    ? DASH
    : new Date(value).toLocaleString("fr-FR");

const styles = StyleSheet.create({
  page: {
    padding: 36,
    paddingBottom: 54,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#171717",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#171717",
    paddingBottom: 16,
    marginBottom: 4,
  },
  company: { width: "55%" },
  titleBlock: { width: "40%", textAlign: "right" },
  eyebrow: {
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#555555",
    marginBottom: 6,
  },
  companyName: { fontSize: 14, fontWeight: "bold", marginBottom: 5 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 6 },
  subtitle: { fontSize: 10, color: "#525252", marginBottom: 4 },
  documentNumber: { fontSize: 10, fontFamily: "Courier", color: "#171717" },
  detail: { fontSize: 8, lineHeight: 1.5, color: "#525252" },
  section: {
    marginTop: 14,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#999999",
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#333333",
  },
  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: 12,
    paddingBottom: 12,
  },
  metadataItem: { width: "50%", paddingRight: 12, marginBottom: 12 },
  metadataLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#666666",
    marginBottom: 4,
  },
  metadataValue: { fontSize: 10, fontWeight: "bold" },
  table: { marginTop: 10, borderWidth: 1, borderColor: "#d5d5d5" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    minHeight: 26,
    alignItems: "center",
  },
  tableHeader: {
    backgroundColor: "#f3f3f3",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  cell: { paddingHorizontal: 5, paddingVertical: 7, fontSize: 8 },
  cellSku: { width: "14%", fontFamily: "Courier" },
  cellName: { width: "26%" },
  cellLot: { width: "16%" },
  cellQuantity: { width: "11%", textAlign: "right" },
  cellUnit: { width: "10%" },
  cellUnitCost: { width: "11%", textAlign: "right" },
  cellTotal: { width: "12%", textAlign: "right", fontWeight: "bold" },
  headerText: { fontSize: 7, fontWeight: "bold", letterSpacing: 0.3 },
  emptyRow: {
    paddingVertical: 18,
    textAlign: "center",
    fontSize: 9,
    color: "#666666",
  },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 2,
    borderTopColor: "#171717",
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
  },
  totalLabel: { fontSize: 11, fontWeight: "bold" },
  totalValue: { fontSize: 11, fontWeight: "bold" },
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#aaaaaa",
    paddingTop: 8,
    fontSize: 7,
    color: "#666666",
  },
});

export default function StockMovementReportDocument({
  data,
}: {
  data: StockMovementReportData;
}) {
  const { company, document, lines, items, warehouses, units, responsible } =
    data;
  const receipt = document.type === "RECEIPT";
  const title = receipt ? "Bon d’entrée" : "Bon de sortie";

  const warehouseName = (id?: string) =>
    id
      ? warehouses.find((w) => w._id === id)?.name ??
        `Entrep\u00f4t indisponible (${id})`
      : DASH;

  const total = lines.every((line) => line.unitCost != null)
    ? lines.reduce((sum, line) => sum + line.quantity * line.unitCost!, 0)
    : undefined;

  const metadata: Array<[string, string]> = [
    ["Date", dateTime(document.postedAt ?? document.documentDate)],
    ["Responsable", responsible],
    ["Entrep\u00f4t", warehouseName(document.warehouseId)],
    ["R\u00e9f\u00e9rence", document.referenceId || DASH],
    ["Motif", document.reason || DASH],
    ...(document.notes
      ? ([["Notes", document.notes]] as Array<[string, string]>)
      : []),
  ];

  return (
    <Document
      title={`${title} - ${document.documentNumber}`}
      author={company.name}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} wrap={false}>
          <View style={styles.company}>
            <Text style={styles.companyName}>{company.name}</Text>
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
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{title.toLocaleUpperCase("fr-FR")}</Text>
            <Text style={styles.documentNumber}>{document.documentNumber}</Text>
          </View>
        </View>

        <Text style={styles.section}>
          01 / Informations g&eacute;n&eacute;rales
        </Text>
        <View style={styles.metadata}>
          {metadata.map(([label, value]) => (
            <View style={styles.metadataItem} key={label} wrap={false}>
              <Text style={styles.metadataLabel}>{label}</Text>
              <Text style={styles.metadataValue}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>
          {receipt ? "02 / Articles réceptionnés" : "02 / Articles sortis"}
        </Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.tableHeader]} wrap={false}>
            <Text style={[styles.cell, styles.cellSku, styles.headerText]}>
              SKU
            </Text>
            <Text style={[styles.cell, styles.cellName, styles.headerText]}>
              Article
            </Text>
            <Text style={[styles.cell, styles.cellLot, styles.headerText]}>
              Lot / S&eacute;rie
            </Text>
            <Text style={[styles.cell, styles.cellQuantity, styles.headerText]}>
              Quantit&eacute;
            </Text>
            <Text style={[styles.cell, styles.cellUnit, styles.headerText]}>
              Unit&eacute;
            </Text>
            <Text style={[styles.cell, styles.cellUnitCost, styles.headerText]}>
              Val. unitaire
            </Text>
            <Text style={[styles.cell, styles.cellTotal, styles.headerText]}>
              Val. totale
            </Text>
          </View>
          {lines.map((line) => {
            const item = items.find((entry) => entry._id === line.itemId);
            const lineTotal =
              line.unitCost == null ? undefined : line.quantity * line.unitCost;
            return (
              <View style={styles.row} key={line._id} wrap={false}>
                <Text style={[styles.cell, styles.cellSku]}>
                  {item?.sku ?? DASH}
                </Text>
                <Text style={[styles.cell, styles.cellName]}>
                  {item?.name ??
                    line.description ??
                    `Article indisponible (${line.itemId})`}
                </Text>
                <Text style={[styles.cell, styles.cellLot]}>
                  {[line.lotId, line.serialNumber]
                    .filter(Boolean)
                    .join(" / ") || DASH}
                </Text>
                <Text style={[styles.cell, styles.cellQuantity]}>
                  {number(line.quantity)}
                </Text>
                <Text style={[styles.cell, styles.cellUnit]}>
                  {units.find((unit) => unit._id === line.unitId)?.code ?? DASH}
                </Text>
                <Text style={[styles.cell, styles.cellUnitCost]}>
                  {money(line.unitCost)}
                </Text>
                <Text style={[styles.cell, styles.cellTotal]}>
                  {money(lineTotal)}
                </Text>
              </View>
            );
          })}
          {!lines.length && (
            <Text style={styles.emptyRow}>Aucun article disponible.</Text>
          )}
        </View>

        <View style={styles.total} wrap={false}>
          <Text style={styles.totalLabel}>Valeur totale</Text>
          <Text style={styles.totalValue}>{money(total)}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>{`${title} • ${document.documentNumber}`}</Text>
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
