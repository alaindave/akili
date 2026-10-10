import { useEffect, useMemo, useState } from "react";
import {
  Alert, Badge, Box, Button, Flex, Heading, HStack, Input, InputGroup,
  InputLeftElement, Select, SimpleGrid, Skeleton, Stack, Table, Tbody,
  Td, Text, Th, Thead, Tr,
} from "@chakra-ui/react";
import { FiArrowDownLeft, FiArrowUpRight, FiRepeat, FiSearch, FiSliders } from "react-icons/fi";
import type { InventoryMovement } from "../../../../common/types/inventory/InventoryMovement";
import type { InventoryItem } from "../../../../common/types/inventory/InventoryItem";
import type { InventoryWarehouse } from "../../../../common/types/inventory/InventoryWarehouse";
import type { InventoryDocument } from "../../../../common/types/inventory/InventoryDocument";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";
import { warehouseTypeLabels } from "../components/InventoryWarehouseForm";

const PAGE_SIZE = 20;
const movementLabels: Record<InventoryMovement["movementType"], string> = {
  RECEIPT: "Entrée", ISSUE: "Sortie", TRANSFER_IN: "Transfert entrant",
  TRANSFER_OUT: "Transfert sortant", ADJUSTMENT: "Ajustement",
  RETURN_IN: "Retour entrant", RETURN_OUT: "Retour sortant",
  PRODUCTION_CONSUMPTION: "Consommation de production", PRODUCTION_OUTPUT: "Sortie de production",
};
const metrics = [
  { key: "in", label: "Entrées", icon: FiArrowDownLeft, color: "green" },
  { key: "out", label: "Sorties", icon: FiArrowUpRight, color: "red" },
  { key: "transfer", label: "Transferts", icon: FiRepeat, color: "blue" },
  { key: "adjustment", label: "Ajustements", icon: FiSliders, color: "orange" },
] as const;
function category(movement: InventoryMovement) {
  if (movement.movementType.startsWith("TRANSFER_")) return "transfer";
  if (movement.movementType === "ADJUSTMENT") return "adjustment";
  return movement.direction === "IN" ? "in" : "out";
}
const formatNumber = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("fr-FR");
};
interface MovementData {
  movements: InventoryMovement[];
  items: InventoryItem[];
  warehouses: InventoryWarehouse[];
  documents: InventoryDocument[];
}
async function loadAll<T>(list: (options: { limit: number; offset: number }) => Promise<T[]>) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await list({ limit: 100, offset });
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}

export default function InventoryMovementsPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  return companyId ? <CompanyMovements key={companyId} companyId={companyId} /> :
    <Alert>Connectez-vous à une entreprise pour consulter les mouvements.</Alert>;
}

function CompanyMovements({ companyId }: { companyId: string }) {
  const [data, setData] = useState<MovementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [type, setType] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [warehouseType, setWarehouseType] = useState("");
  const [page, setPage] = useState(0);
  const syncVersion = useSyncStore((store) => store.syncVersion);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const api = window.electron.inventory;
    void Promise.all([
      loadAll((options) => api.movements.list(companyId, options)),
      loadAll((options) => api.items.list(companyId, { ...options, includeDeleted: true })),
      loadAll((options) => api.warehouses.list(companyId, { ...options, includeDeleted: true })),
      loadAll((options) => api.documents.list(companyId, { ...options, includeDeleted: true })),
    ]).then(([movements, items, warehouses, documents]) => {
      if (active) setData({ movements, items, warehouses, documents });
    }).catch(() => {
      if (active) setError("Impossible de charger les mouvements. Veuillez réessayer.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, refresh, syncVersion]);

  const invalidDates = Boolean(fromDate && toDate && fromDate > toDate);
  const { filtered, totals } = useMemo(() => {
    const items = new Map(data?.items.map((item) => [item._id, item]));
    const warehouses = new Map(data?.warehouses.map((entry) => [entry._id, entry]));
    const documents = new Map(data?.documents.map((document) => [document._id, document]));
    const query = search.trim().toLocaleLowerCase("fr");
    const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : -Infinity;
    const endDate = toDate ? new Date(`${toDate}T00:00:00`) : null;
    if (endDate) endDate.setDate(endDate.getDate() + 1);
    const end = endDate?.getTime() ?? Infinity;
    const filtered = (data?.movements ?? []).map((movement) => ({
      movement, item: items.get(movement.itemId), warehouse: warehouses.get(movement.warehouseId),
      document: documents.get(movement.documentId),
    })).filter((row) => {
      const occurredAt = new Date(row.movement.occurredAt).getTime();
      return !invalidDates &&
        (!query || `${row.item?.name ?? ""} ${row.item?.sku ?? ""}`.toLocaleLowerCase("fr").includes(query)) &&
        (!fromDate || occurredAt >= start) && (!toDate || occurredAt < end) &&
        (!type || row.movement.movementType === type) &&
        (!warehouse || row.movement.warehouseId === warehouse) &&
        (!warehouseType || row.warehouse?.type === warehouseType);
    }).sort((a, b) => new Date(b.movement.occurredAt).getTime() - new Date(a.movement.occurredAt).getTime());
    const totals = { in: 0, out: 0, transfer: 0, adjustment: 0 };
    filtered.forEach(({ movement }) => { totals[category(movement)]++; });
    return { filtered, totals };
  }, [data, search, fromDate, toDate, type, warehouse, warehouseType, invalidDates]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const change = (setter: (value: string) => void) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setter(event.target.value);
      setPage(0);
    };
  const reset = () => {
    setSearch(""); setFromDate(""); setToDate(""); setType("");
    setWarehouse(""); setWarehouseType(""); setPage(0);
  };

  return (
    <Box h="100%" minH={0} display="flex" flexDirection="column" overflow="hidden"
      bg="#FAFAFA" color="#262626" p={{ base: 3, md: 6 }} pb="24px">
      <Box flexShrink={0}>
        <Heading as="h1" fontSize="1.4rem" color="#03143B">Mouvements de stocks</Heading>
        <Text fontSize="1rem" color="#737373">Suivez les mouvements de stock sur vos entrepots.</Text>
      </Box>
      <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={6} mt={10} mb={8} flexShrink={0}>
        {metrics.map(({ key, label, icon: Icon, color }) => (
          <Box key={key} title="Nombre de mouvements correspondant aux filtres"
            bg="linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))"
            border="1px solid rgba(255,255,255,0.12)" boxShadow="0 2px 8px rgba(0,0,0,0.5)"
            borderRadius="0.4rem" p={5} minH="8rem">
            <HStack spacing={3}>
              <Flex bg={`${color}.500`} color="white" borderRadius="15px" boxSize="36px" align="center" justify="center" flexShrink={0}>
                <Icon aria-hidden="true" />
              </Flex>
              <Text fontWeight="700" color="gray.700" fontSize="1.1rem">{label}</Text>
            </HStack>
            <Skeleton isLoaded={!loading} mt={3}>
              <Text color="black" fontSize="1.5rem" fontWeight="700" textAlign="right">
                {data && !error ? formatNumber(totals[key]) : "—"}
              </Text>
            </Skeleton>
          </Box>
        ))}
      </SimpleGrid>
      <Box border="1px solid #E5E5E5" borderRadius="12px" bg="white" overflow="hidden"
        display="flex" flexDirection="column" flex="1" minH={0} boxShadow="0 2px 6px rgba(0,0,0,0.02)">
        <Flex p={5} gap={3} wrap="wrap" borderBottom="1px solid #EAEAEA" flexShrink={0}>
          <InputGroup flex="1" minW="220px">
            <InputLeftElement pointerEvents="none" color="#909090"><FiSearch /></InputLeftElement>
            <Input aria-label="Rechercher par SKU ou nom d’article" placeholder="Rechercher par SKU ou nom d’article…"
              value={search} onChange={change(setSearch)} maxLength={255} fontSize="sm" />
          </InputGroup>
          <Input type="date" aria-label="Date de début" title="Date de début" w="160px" value={fromDate}
            max={toDate || undefined} onChange={change(setFromDate)} isInvalid={invalidDates} fontSize="sm" />
          <Input type="date" aria-label="Date de fin" title="Date de fin" w="160px" value={toDate}
            min={fromDate || undefined} onChange={change(setToDate)} isInvalid={invalidDates} fontSize="sm" />
          <Select aria-label="Type de mouvement" w={{ base: "100%", sm: "210px" }} value={type} onChange={change(setType)} fontSize="sm">
            <option value="">Tous les mouvements</option>
            {Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select aria-label="Entrepôt" w={{ base: "100%", sm: "210px" }} value={warehouse} onChange={change(setWarehouse)} fontSize="sm">
            <option value="">Tous les entrepôts</option>
            {data?.warehouses.map((entry) => <option key={entry._id} value={entry._id}>{entry.name}</option>)}
          </Select>
          <Select aria-label="Type d’entrepôt" w={{ base: "100%", sm: "210px" }} value={warehouseType} onChange={change(setWarehouseType)} fontSize="sm">
            <option value="">Tous les types d’entrepôt</option>
            {Object.entries(warehouseTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          {(search || fromDate || toDate || type || warehouse || warehouseType) && <Button variant="ghost" onClick={reset}>Réinitialiser</Button>}
        </Flex>
        {invalidDates && <Alert status="warning">La date de fin doit être postérieure ou égale à la date de début.</Alert>}
        <Box flex="1" minH={0} overflow="auto">
          {error ? <Stack p={6} align="start"><Text role="alert">{error}</Text><Button onClick={() => setRefresh((value) => value + 1)}>Réessayer</Button></Stack> :
            loading ? <Stack p={6} spacing={5} role="status" aria-label="Chargement des mouvements">{[0, 1, 2, 3, 4].map((key) => <Skeleton key={key} h="36px" />)}</Stack> :
            <Table whiteSpace="nowrap" sx={{ th: { position: "sticky", top: 0, zIndex: 1, bg: "#FAFAFA", color: "#737373", fontSize: "10px", letterSpacing: "0.08em", py: 3.5 }, td: { borderColor: "#F0F0F0", py: 4, fontSize: "sm" } }}>
              <Thead><Tr><Th>Date et heure</Th><Th>Article</Th><Th>Type de mouvement</Th><Th isNumeric>Quantité</Th><Th isNumeric>Prix unitaire</Th><Th isNumeric>Valeur totale</Th><Th>Entrepôt</Th><Th>Référence</Th></Tr></Thead>
              <Tbody>
                {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(({ movement, item, warehouse: storage, document }) => (
                  <Tr key={movement._id} _hover={{ bg: "#F1F5F9" }}>
                    <Td>{formatDate(movement.occurredAt)}</Td>
                    <Td><Text fontWeight="600">{item?.name ?? "Article indisponible"}</Text><Text color="#858585" fontFamily="mono" fontSize="xs" mt={1}>{item?.sku ?? "—"}</Text></Td>
                    <Td><Badge colorScheme={metrics.find((metric) => metric.key === category(movement))?.color} textTransform="none" borderRadius="full" px={2.5} py={0.5}>{movementLabels[movement.movementType] ?? movement.movementType}</Badge></Td>
                    <Td isNumeric>{movement.direction === "IN" ? "+" : "−"}{formatNumber(Math.abs(movement.quantity))}</Td>
                    <Td isNumeric>{formatNumber(movement.unitCost)}</Td>
                    <Td isNumeric>{formatNumber(movement.totalCost ?? (movement.unitCost == null ? undefined : Math.abs(movement.quantity) * movement.unitCost))}</Td>
                    <Td>{storage?.name ?? "Entrepôt indisponible"}</Td>
                    <Td fontFamily="mono">{document?.documentNumber ?? "—"}</Td>
                  </Tr>
                ))}
                {!filtered.length && <Tr><Td colSpan={8} textAlign="center" py={8}>Aucun mouvement à afficher.</Td></Tr>}
              </Tbody>
            </Table>}
        </Box>
        <Flex flexShrink={0} px={5} py={4} borderTop="1px solid #EAEAEA" justify="space-between" align="center" gap={3} wrap="wrap">
          <Text fontSize="xs" color="#737373" aria-live="polite">{loading ? "Chargement…" : error ? "Mouvements indisponibles" : filtered.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} sur ${filtered.length} mouvements` : "0 mouvement"}</Text>
          <HStack spacing={2}>
            <Button size="sm" variant="outline" isDisabled={loading || Boolean(error) || currentPage === 0} onClick={() => setPage(currentPage - 1)}>Précédent</Button>
            <Button size="sm" variant="outline" isDisabled={loading || Boolean(error) || (currentPage + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage(currentPage + 1)}>Suivant</Button>
          </HStack>
        </Flex>
      </Box>
    </Box>
  );
}
