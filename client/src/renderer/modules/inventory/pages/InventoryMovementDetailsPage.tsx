import { useEffect, useState } from "react";
import { Global } from "@emotion/react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Heading,
  HStack,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { FaArrowLeftLong, FaDownload } from "react-icons/fa6";
import type {
  InventoryDocument,
  InventoryDocumentLine,
  InventoryDocumentType,
} from "../../../../common/types/inventory/InventoryDocument";
import type { InventoryItem } from "../../../../common/types/inventory/InventoryItem";
import type { InventoryWarehouse } from "../../../../common/types/inventory/InventoryWarehouse";
import type { InventoryUnit } from "../../../../common/types/inventory/InventoryUnit";
import type OfflineUser from "../../../../common/types/shared/OfflineUser";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";

const labels: Record<InventoryDocumentType, string> = {
  RECEIPT: "Entrée de stock",
  ISSUE: "Sortie de stock",
  TRANSFER: "Transfert de stock",
  ADJUSTMENT: "Ajustement de stock",
  RETURN: "Retour de stock",
  COUNT: "Inventaire",
};
const number = (value: number | undefined) =>
  value == null
    ? "—"
    : value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
const date = (value?: string) =>
  !value || Number.isNaN(new Date(value).getTime())
    ? "—"
    : new Date(value).toLocaleString("fr-FR");
async function loadAll<T>(
  list: (options: { limit: number; offset: number }) => Promise<T[]>
) {
  const result: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await list({ limit: 100, offset });
    result.push(...page);
    if (page.length < 100) return result;
  }
}
interface Details {
  document: InventoryDocument;
  lines: InventoryDocumentLine[];
  items: InventoryItem[];
  warehouses: InventoryWarehouse[];
  units: InventoryUnit[];
  responsible: string;
}

export default function InventoryMovementDetailsPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  return companyId && documentId ? (
    <MovementDetails
      key={`${companyId}:${documentId}`}
      companyId={companyId}
      documentId={documentId}
    />
  ) : (
    <Alert>Connectez-vous à une entreprise pour consulter ce mouvement.</Alert>
  );
}

function MovementDetails({
  companyId,
  documentId,
}: {
  companyId: string;
  documentId: string;
}) {
  const [data, setData] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const api = window.electron.inventory;
    const load = async () => {
      const document = await api.documents.getById(companyId, documentId);
      if (!document)
        throw new Error("Document introuvable dans cette entreprise.");
      const [lines, items, warehouses, settings] = await Promise.all([
        api.documentLines.getByDocument(companyId, documentId),
        loadAll((options) =>
          api.items.list(companyId, { ...options, includeDeleted: true })
        ),
        loadAll((options) =>
          api.warehouses.list(companyId, { ...options, includeDeleted: true })
        ),
        api.settings.get(companyId),
      ]);
      let responsible = document.postedBy
        ? `Utilisateur indisponible (${document.postedBy})`
        : "Non renseigné";
      if (document.postedBy) {
        try {
          const user: OfflineUser | null =
            await window.electron.auth.offlineUsers.getById(document.postedBy);
          if (user?.companyId === companyId)
            responsible =
              `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
              user.email;
        } catch {
          /* Keep the document readable when its author is unavailable locally. */
        }
      }
      if (active)
        setData({
          document,
          lines,
          items,
          warehouses,
          units: settings.units,
          responsible,
        });
    };
    void load()
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error &&
              cause.message === "Document introuvable dans cette entreprise."
              ? cause.message
              : "Impossible de charger le mouvement. Veuillez réessayer."
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, documentId, retry, syncVersion]);

  const receipt = data?.document.type === "RECEIPT";
  const paperDocument = receipt || data?.document.type === "ISSUE";
  const warehouseName = (id?: string) =>
    id
      ? data?.warehouses.find((warehouse) => warehouse._id === id)?.name ??
        `Entrepôt indisponible (${id})`
      : "—";
  const field = (label: string, value: string) => (
    <Box>
      <Text
        fontSize={paperDocument ? "10px" : "sm"}
        color={paperDocument ? "#666" : "gray.600"}
        mb={paperDocument ? "5px" : undefined}
        textTransform={paperDocument ? "uppercase" : undefined}
        letterSpacing={paperDocument ? "0.06em" : undefined}
      >
        {label}
      </Text>
      <Text
        fontSize={paperDocument ? "13px" : undefined}
        fontWeight="medium"
        whiteSpace="pre-wrap"
        overflowWrap="anywhere"
      >
        {value}
      </Text>
    </Box>
  );
  const total = data?.lines.every((line) => line.unitCost != null)
    ? data.lines.reduce((sum, line) => sum + line.quantity * line.unitCost!, 0)
    : undefined;

  const toast = useToast();
  const download = async () => {
    if (!paperDocument || loading || error || isDownloading) return;
    setIsDownloading(true);
    try {
      const result =
        await window.electron.inventory.documents.saveStockMovementReport(
          companyId,
          documentId
        );
      if (!result.canceled) {
        toast({
          title: receipt
            ? "Bon d’entrée enregistré"
            : "Bon de sortie enregistré",
          status: "success",
          isClosable: true,
        });
      }
    } catch (cause: unknown) {
      toast({
        title: receipt
          ? "Impossible de télécharger le bon d’entrée"
          : "Impossible de télécharger le bon de sortie",
        description:
          cause instanceof Error ? cause.message : "Veuillez r\u00e9essayer.",
        status: "error",
        isClosable: true,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box
      h="100%"
      overflowY="auto"
      p={{ base: 3, md: 6 }}
      bg={paperDocument ? "#e9e9e7" : "#FAFAFA"}
    >
      {paperDocument && (
        <Global
          styles={`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body:has([data-stock-paper]) { background: white; }
          body:has([data-stock-paper]) *:has([data-stock-paper]) {
            height: auto !important; min-height: 0 !important; max-height: none !important;
            overflow: visible !important; display: block !important; position: static !important;
            padding: 0 !important; margin: 0 !important;
          }
          body:has([data-stock-paper]) *:has([data-stock-paper]) > :not([data-stock-paper]):not(:has([data-stock-paper])) {
            display: none !important;
          }
        }
      `}
        />
      )}
      <Stack spacing={6}>
        {loading ? (
          <Stack role="status" aria-label="Chargement du mouvement">
            <Skeleton h="40px" />
            <Skeleton h="180px" />
          </Stack>
        ) : error ? (
          <Stack>
            <Alert status="error">{error}</Alert>
            <Button
              alignSelf="start"
              onClick={() => setRetry((value) => value + 1)}
            >
              Réessayer
            </Button>
          </Stack>
        ) : (
          data && (
            <Box
              position="relative"
              as="article"
              data-stock-paper={paperDocument ? "" : undefined}
              w="100%"
              maxW={paperDocument ? "210mm" : undefined}
              minH={paperDocument ? { base: 0, sm: "297mm" } : undefined}
              mx="auto"
              p={
                paperDocument
                  ? { base: "28px 18px", sm: "14mm 13mm" }
                  : undefined
              }
              border={paperDocument ? "1px solid #d0d0d0" : undefined}
              bg={paperDocument ? "white" : undefined}
              color={paperDocument ? "#171717" : undefined}
              boxShadow={
                paperDocument ? "0 4px 24px rgb(0 0 0 / 8%)" : undefined
              }
              fontSize={paperDocument ? "13px" : undefined}
              sx={
                paperDocument
                  ? {
                      fontVariantNumeric: "tabular-nums",
                      colorScheme: "light",
                      "@media print": {
                        maxWidth: "none",
                        minHeight: 0,
                        padding: 0,
                        border: 0,
                        boxShadow: "none",
                        "button, a": { display: "none" },
                        "header, tr": { breakInside: "avoid" },
                      },
                    }
                  : undefined
              }
              display="flex"
              flexDirection="column"
              gap={paperDocument ? "18px" : 6}
            >
              <Button
                position="absolute"
                left="1rem"
                top="1rem"
                as={RouterLink}
                to="/inventory/movements"
                variant="outline"
                aria-label="Retour aux mouvements"
                minW="33px"
                h="33px"
                p="5px"
                flexShrink={0}
                color="#171717"
                _hover={{ bg: "#f3f3f3" }}
                _focusVisible={{
                  outline: "2px solid #171717",
                  outlineOffset: "2px",
                }}
              >
                <FaArrowLeftLong color="black" />
              </Button>
              <Box
                as="header"
                borderBottom={paperDocument ? "2px solid #171717" : undefined}
                pb={paperDocument ? "24px" : undefined}
                mb={paperDocument ? "4px" : undefined}
              >
                <HStack
                  justify="space-between"
                  align="start"
                  gap={4}
                  flexWrap="wrap"
                >
                  <HStack align="center" gap={3} flex="1" minW={0}>
                    <Heading
                      as="h1"
                      size={paperDocument ? undefined : "md"}
                      fontFamily={
                        paperDocument
                          ? 'Georgia, "Times New Roman", serif'
                          : undefined
                      }
                      fontSize={
                        paperDocument ? "clamp(28px, 4vw, 38px)" : undefined
                      }
                      fontWeight={paperDocument ? 400 : undefined}
                      lineHeight="1.15"
                      letterSpacing={paperDocument ? "-0.025em" : undefined}
                      overflowWrap="anywhere"
                    >
                      {paperDocument
                        ? labels[data.document.type]
                        : data.document.documentNumber}
                    </Heading>
                  </HStack>
                  {paperDocument && (
                    <Button
                      size="sm"
                      bg="#171717"
                      color="white"
                      borderRadius={0}
                      flexShrink={0}
                      ml="auto"
                      _hover={{ bg: "#404040" }}
                      _focusVisible={{
                        outline: "2px solid #171717",
                        outlineOffset: "2px",
                      }}
                      onClick={download}
                      isLoading={isDownloading}
                      loadingText="Génération…"
                    >
                      <FaDownload />
                    </Button>
                  )}
                </HStack>
                <Text
                  mt={3}
                  fontFamily={paperDocument ? "mono" : undefined}
                  fontSize={paperDocument ? "12px" : undefined}
                  overflowWrap="anywhere"
                >
                  {paperDocument
                    ? data.document.documentNumber
                    : labels[data.document.type]}
                </Text>
              </Box>
              {paperDocument && (
                <Text
                  py="10px"
                  borderBottom="1px solid #999"
                  fontSize="10px"
                  fontWeight={700}
                  lineHeight="1.5"
                  letterSpacing="0.1em"
                  textTransform="uppercase"
                  color="#333"
                >
                  01 / Informations générales
                </Text>
              )}
              <SimpleGrid
                columns={{ base: 1, md: 2, xl: paperDocument ? 2 : 3 }}
                spacing={5}
                bg="white"
                p={paperDocument ? "0 0 20px" : 5}
                borderWidth={paperDocument ? 0 : "1px"}
                borderRadius={paperDocument ? 0 : "lg"}
                gap={paperDocument ? "20px 28px" : undefined}
              >
                {field("Date", date(data.document.postedAt))}
                {field("Responsable", data.responsible)}
                {data.document.type === "TRANSFER" ? (
                  <>
                    {field(
                      "Entrepôt source",
                      warehouseName(data.document.sourceWarehouseId)
                    )}
                    {field(
                      "Entrepôt destination",
                      warehouseName(data.document.destinationWarehouseId)
                    )}
                  </>
                ) : (
                  field("Entrepôt", warehouseName(data.document.warehouseId))
                )}
                {field("Référence", data.document.referenceId || "—")}
                {field("Motif", data.document.reason || "—")}
                {data.document.notes && field("Notes", data.document.notes)}
              </SimpleGrid>
              <Box
                bg="white"
                borderWidth={paperDocument ? 0 : "1px"}
                borderRadius={paperDocument ? 0 : "lg"}
                overflow={paperDocument ? "visible" : "hidden"}
              >
                <Heading
                  as="h2"
                  size="md"
                  p={paperDocument ? "10px 0" : 5}
                  borderBottom={paperDocument ? "1px solid #999" : undefined}
                  fontSize={paperDocument ? "10px" : undefined}
                  fontWeight={700}
                  lineHeight="1.5"
                  letterSpacing={paperDocument ? "0.1em" : undefined}
                  textTransform={paperDocument ? "uppercase" : undefined}
                  color={paperDocument ? "#333" : undefined}
                >
                  {paperDocument
                    ? receipt
                      ? "02 / Articles réceptionnés"
                      : "02 / Articles sortis"
                    : "Articles"}
                </Heading>
                <Box
                  overflowX="auto"
                  sx={{ "@media print": { overflow: "visible" } }}
                >
                  <Table
                    size="sm"
                    sx={
                      paperDocument
                        ? {
                            tableLayout: "fixed",
                            width: "100%",
                            minWidth: { base: "580px", sm: 0 },
                            "th:nth-of-type(2)": { width: "23%" },
                            "th, td": {
                              padding: "12px 5px",
                              borderBottom: "1px solid #d5d5d5",
                              color: "#171717",
                              fontSize: "11px",
                              lineHeight: "1.5",
                              whiteSpace: "normal",
                              overflowWrap: "anywhere",
                            },
                            th: {
                              background: "#f3f3f3",
                              borderBottom: "1px solid #333",
                              fontSize: "9px",
                              letterSpacing: "0.025em",
                            },
                            "@media print": {
                              minWidth: 0,
                              thead: { display: "table-header-group" },
                            },
                          }
                        : undefined
                    }
                  >
                    <Thead>
                      <Tr>
                        <Th>SKU</Th>
                        <Th>Article</Th>
                        <Th>Lot / Série</Th>
                        <Th isNumeric>Quantité</Th>
                        <Th>Unité</Th>
                        <Th isNumeric>Valeur unitaire</Th>
                        <Th isNumeric>Valeur totale</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {data.lines.map((line) => {
                        const item = data.items.find(
                          (entry) => entry._id === line.itemId
                        );
                        return (
                          <Tr key={line._id}>
                            <Td fontFamily="mono">{item?.sku ?? "—"}</Td>
                            <Td>
                              {item?.name ??
                                line.description ??
                                `Article indisponible (${line.itemId})`}
                            </Td>
                            <Td>
                              {[line.lotId, line.serialNumber]
                                .filter(Boolean)
                                .join(" / ") || "—"}
                            </Td>
                            <Td isNumeric>{number(line.quantity)}</Td>
                            <Td>
                              {data.units.find(
                                (unit) => unit._id === line.unitId
                              )?.code ?? "—"}
                            </Td>
                            <Td isNumeric>{number(line.unitCost)}</Td>
                            <Td isNumeric>
                              {number(
                                line.unitCost == null
                                  ? undefined
                                  : line.quantity * line.unitCost
                              )}
                            </Td>
                          </Tr>
                        );
                      })}
                      {!data.lines.length && (
                        <Tr>
                          <Td colSpan={7} textAlign="center" py={6}>
                            Aucun article disponible.
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </Box>
                <Text
                  mt={paperDocument ? "18px" : undefined}
                  p={paperDocument ? "15px 8px" : 5}
                  borderTop={paperDocument ? "2px solid #171717" : undefined}
                  borderBottom={paperDocument ? "1px solid #171717" : undefined}
                  fontSize={paperDocument ? "14px" : undefined}
                  textAlign="right"
                  fontWeight="bold"
                >
                  Valeur totale : {number(total)}
                </Text>
              </Box>
              {paperDocument && (
                <Box
                  as="footer"
                  display="flex"
                  justifyContent="space-between"
                  gap="20px"
                  mt={{ base: "40px", sm: "auto" }}
                  pt="14px"
                  borderTop="1px solid #aaa"
                  fontSize="10px"
                  color="#666"
                  sx={{ "@media print": { marginTop: "24px" } }}
                >
                  <Text>{labels[data.document.type]}</Text>
                  <Text overflowWrap="anywhere">
                    {data.document.documentNumber}
                  </Text>
                </Box>
              )}
            </Box>
          )
        )}
      </Stack>
    </Box>
  );
}
