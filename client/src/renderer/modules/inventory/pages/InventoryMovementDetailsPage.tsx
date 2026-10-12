import { useEffect, useState } from "react";
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
} from "@chakra-ui/react";
import { FaArrowLeftLong } from "react-icons/fa6";
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

  const warehouseName = (id?: string) =>
    id
      ? data?.warehouses.find((warehouse) => warehouse._id === id)?.name ??
        `Entrepôt indisponible (${id})`
      : "—";
  const field = (label: string, value: string) => (
    <Box>
      <Text fontSize="sm" color="gray.600">
        {label}
      </Text>
      <Text fontWeight="medium" whiteSpace="pre-wrap" overflowWrap="anywhere">
        {value}
      </Text>
    </Box>
  );
  const total = data?.lines.every((line) => line.unitCost != null)
    ? data.lines.reduce((sum, line) => sum + line.quantity * line.unitCost!, 0)
    : undefined;
  return (
    <Box h="100%" overflowY="auto" p={{ base: 3, md: 6 }} bg="#FAFAFA">
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
            <>
              <Box>
                <HStack>
                  <Button
                    as={RouterLink}
                    to="/inventory/movements"
                    alignSelf="start"
                    variant="ghost"
                  >
                    <FaArrowLeftLong color="black" />
                  </Button>
                  <Heading
                    as="h1"
                    size="md"
                    color="#03143B"
                    overflowWrap="anywhere"
                  >
                    {data.document.documentNumber}
                  </Heading>
                </HStack>
                <HStack mt={2}>
                  <Text>{labels[data.document.type]}</Text>
                </HStack>
              </Box>
              <SimpleGrid
                columns={{ base: 1, md: 2, xl: 3 }}
                spacing={5}
                bg="white"
                p={5}
                borderWidth="1px"
                borderRadius="lg"
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
                borderWidth="1px"
                borderRadius="lg"
                overflow="hidden"
              >
                <Heading as="h2" size="md" p={5}>
                  Articles
                </Heading>
                <Box overflowX="auto">
                  <Table size="sm">
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
                <Text p={5} textAlign="right" fontWeight="bold">
                  Valeur totale : {number(total)}
                </Text>
              </Box>
            </>
          )
        )}
      </Stack>
    </Box>
  );
}
