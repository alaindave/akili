import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
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
import {
  FaBoxes,
  FaBoxOpen,
  FaExclamationTriangle,
  FaWarehouse,
} from "react-icons/fa";
import { FiSearch } from "react-icons/fi";
import type {
  InventoryBalance,
  InventoryItem,
} from "../../../../common/types/inventory/InventoryItem";
import type {
  InventoryLocation,
  InventoryWarehouse,
} from "../../../../common/types/inventory/InventoryWarehouse";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";

interface StockData {
  items: InventoryItem[];
  balances: InventoryBalance[];
  warehouses: InventoryWarehouse[];
  locations: InventoryLocation[];
}
interface StockRow {
  key: string;
  item: InventoryItem;
  warehouseId: string;
  locationId: string;
  available: number;
  reserved: number;
}
const PAGE_SIZE = 20;
const formatNumber = (value: number) =>
  value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const stockStatus = (quantity: number, item: InventoryItem) =>
  quantity <= 0
    ? "rupture"
    : item.reorderPoint != null && quantity <= item.reorderPoint
    ? "faible"
    : "normal";
const statuses = {
  normal: { label: "Normal", color: "green" },
  faible: { label: "Faible", color: "orange" },
  rupture: { label: "Rupture", color: "red" },
};
async function loadAll<T>(
  list: (options: { limit: number; offset: number }) => Promise<T[]>
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await list({ limit: 100, offset });
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}

export default function InventoryStocksPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  return companyId ? (
    <CompanyStocks key={companyId} companyId={companyId} />
  ) : (
    <Alert>Connectez-vous à une entreprise pour consulter les stocks.</Alert>
  );
}

function CompanyStocks({ companyId }: { companyId: string }) {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const syncVersion = useSyncStore((store) => store.syncVersion);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    async function load() {
      try {
        const api = window.electron.inventory;
        const [items, balances, warehouses, locations] = await Promise.all([
          loadAll((options) => api.items.list(companyId, options)),
          loadAll((options) => api.balances.list(companyId, options)),
          loadAll((options) => api.warehouses.list(companyId, options)),
          loadAll((options) => api.locations.list(companyId, options)),
        ]);
        if (active) setData({ items, balances, warehouses, locations });
      } catch {
        if (active)
          setError("Impossible de charger les stocks. Veuillez réessayer.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [companyId, syncVersion, refresh]);

  const { rows, totals } = useMemo(() => {
    const items = new Map(
      data?.items
        .filter((item) => item.isActive)
        .map((item) => [item._id, item])
    );
    const groups = new Map<string, StockRow>();
    const quantities = new Map<string, number>();
    data?.balances.forEach((balance) => {
      const item = items.get(balance.itemId);
      if (!item) return;
      // Lots and serial numbers share one row per article and storage location.
      const key = JSON.stringify([
        item._id,
        balance.warehouseId,
        balance.locationId ?? "",
      ]);
      const row = groups.get(key) ?? {
        key,
        item,
        warehouseId: balance.warehouseId,
        locationId: balance.locationId ?? "",
        available: 0,
        reserved: 0,
      };
      row.available += balance.quantityAvailable;
      row.reserved += balance.quantityReserved;
      groups.set(key, row);
      quantities.set(
        item._id,
        (quantities.get(item._id) ?? 0) + balance.quantityAvailable
      );
    });
    const totals = { inStock: 0, faible: 0, rupture: 0 };
    items.forEach((item) => {
      const quantity = quantities.get(item._id) ?? 0;
      if (quantity > 0) totals.inStock++;
      const status = stockStatus(quantity, item);
      if (status !== "normal") totals[status]++;
      if (!quantities.has(item._id)) {
        groups.set(item._id, {
          key: item._id,
          item,
          warehouseId: "",
          locationId: "",
          available: 0,
          reserved: 0,
        });
      }
    });
    return {
      rows: [...groups.values()].sort((a, b) =>
        a.item.name.localeCompare(b.item.name, "fr")
      ),
      totals,
    };
  }, [data]);
  const warehouses = new Map(
    data?.warehouses.map((entry) => [entry._id, entry.name])
  );
  const locations = new Map(
    data?.locations.map((entry) => [entry._id, entry.name])
  );
  const query = search.trim().toLocaleLowerCase("fr");
  const filteredRows = rows.filter(
    (row) =>
      (!query ||
        `${row.item.name} ${row.item.sku}`
          .toLocaleLowerCase("fr")
          .includes(query)) &&
      (!warehouse || row.warehouseId === warehouse) &&
      (!location || row.locationId === location) &&
      (!status || stockStatus(row.available, row.item) === status)
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filteredRows.length / PAGE_SIZE) - 1)
  );
  const metrics = [
    {
      label: "Entrepôts",
      value: data?.warehouses.length ?? 0,
      icon: FaWarehouse,
      color: "#000080",
    },

    {
      label: "Articles en stock",
      value: totals.inStock,
      icon: FaBoxes,
      color: "#16833e",
    },
    {
      label: "Stock faible",
      value: totals.faible,
      icon: FaExclamationTriangle,
      color: "#D97706",
    },
    {
      label: "Rupture de stock",
      value: totals.rupture,
      icon: FaBoxOpen,
      color: "#E53E3E",
    },
  ];
  const reset = () => {
    setSearch("");
    setWarehouse("");
    setLocation("");
    setStatus("");
    setPage(0);
  };

  return (
    <Box
      h="100%"
      minH={0}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      bg="#F8FAFC"
      p={{ base: 3, md: 6 }}
      pb={6}
    >
      <Heading as="h1" fontSize="1.4rem" color="#03143B" flexShrink={0}>
        Stocks
      </Heading>
      <Text color="gray.600" fontSize="1rem" flexShrink={0}>
        Consultez les quantités disponibles.
      </Text>
      <SimpleGrid
        columns={{ base: 2, xl: 4 }}
        spacing={6}
        mt={10}
        mb={8}
        flexShrink={0}
      >
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <Box
            key={label}
            bg="linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))"
            border="1px solid rgba(255,255,255,0.12)"
            boxShadow="0 2px 8px rgba(0,0,0,0.5)"
            borderRadius="0.4rem"
            p={5}
            minH="8rem"
          >
            <HStack spacing={3}>
              <Flex
                bg={color}
                color="white"
                borderRadius="15px"
                boxSize="36px"
                align="center"
                justify="center"
                flexShrink={0}
              >
                <Icon aria-hidden="true" />
              </Flex>
              <Text color="gray.700" fontWeight="700" fontSize="1.1rem">
                {label}
              </Text>
            </HStack>
            <Text
              color="black"
              fontSize="1.5rem"
              fontWeight="700"
              textAlign="right"
              mt={3}
            >
              {data ? formatNumber(value) : "—"}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
      <Box
        bg="white"
        border="1px solid #E5E5E5"
        borderRadius="12px"
        overflow="hidden"
        display="flex"
        flexDirection="column"
        flex="1"
        minH={0}
      >
        <Flex p={5} gap={3} wrap="wrap" borderBottom="1px solid #EAEAEA" flexShrink={0}>
          <InputGroup flex="1" minW="200px">
            <InputLeftElement pointerEvents="none" color="gray.500">
              <FiSearch />
            </InputLeftElement>
            <Input
              aria-label="Rechercher un article"
              placeholder="Rechercher par nom ou référence…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              fontSize="sm"
            />
          </InputGroup>
          <Select
            aria-label="Filtrer par entrepôt"
            w={{ base: "100%", sm: "190px" }}
            value={warehouse}
            onChange={(event) => {
              setWarehouse(event.target.value);
              setLocation("");
              setPage(0);
            }}
            fontSize="sm"
          >
            <option value="">Tous les entrepôts</option>
            {data?.warehouses.map((entry) => (
              <option key={entry._id} value={entry._id}>
                {entry.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrer par emplacement"
            w={{ base: "100%", sm: "190px" }}
            value={location}
            onChange={(event) => {
              setLocation(event.target.value);
              setPage(0);
            }}
            fontSize="sm"
          >
            <option value="">Tous les emplacements</option>
            {data?.locations
              .filter((entry) => !warehouse || entry.warehouseId === warehouse)
              .map((entry) => (
                <option key={entry._id} value={entry._id}>
                  {entry.name}
                </option>
              ))}
          </Select>
          <Select
            aria-label="Filtrer par statut"
            w={{ base: "100%", sm: "160px" }}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
            fontSize="sm"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(statuses).map(([key, entry]) => (
              <option key={key} value={key}>
                {entry.label}
              </option>
            ))}
          </Select>
          {(search || warehouse || location || status) && (
            <Button variant="ghost" onClick={reset}>
              Réinitialiser
            </Button>
          )}
        </Flex>
        <Box flex="1" minH={0} overflow="auto">
        {error ? (
          <Stack p={6} align="start">
            <Text role="alert">{error}</Text>
            <Button onClick={() => setRefresh((value) => value + 1)}>
              Réessayer
            </Button>
          </Stack>
        ) : loading ? (
          <Stack
            p={6}
            spacing={5}
            role="status"
            aria-label="Chargement des stocks"
          >
            {[0, 1, 2, 3, 4].map((value) => (
              <Skeleton key={value} h="36px" />
            ))}
          </Stack>
        ) : (
          <Box whiteSpace="nowrap">
            <Table
              size="md"
              sx={{
                th: {
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  bg: "#FAFAFA",
                  color: "#737373",
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  py: 3.5,
                },
                td: { py: 4, fontSize: "sm", borderColor: "#F0F0F0" },
              }}
            >
              <Thead>
                <Tr>
                  <Th>Article</Th>
                  <Th>Entrepôt</Th>
                  <Th>Emplacement</Th>
                  <Th isNumeric>Disponible</Th>
                  <Th isNumeric>Réservé</Th>
                  <Th>Statut</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredRows
                  .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                  .map((row) => {
                    const state =
                      statuses[stockStatus(row.available, row.item)];
                    return (
                      <Tr key={row.key} _hover={{ bg: "#FCFCFC" }}>
                        <Td>
                          <Text fontWeight="600">{row.item.name}</Text>
                          <Text
                            color="gray.500"
                            fontSize="xs"
                            fontFamily="mono"
                            mt={1}
                          >
                            {row.item.sku}
                          </Text>
                        </Td>
                        <Td>{warehouses.get(row.warehouseId) ?? "—"}</Td>
                        <Td>{locations.get(row.locationId) ?? "—"}</Td>
                        <Td isNumeric>{formatNumber(row.available)}</Td>
                        <Td isNumeric>{formatNumber(row.reserved)}</Td>
                        <Td>
                          <Badge
                            colorScheme={state.color}
                            textTransform="none"
                            borderRadius="full"
                            px={2.5}
                            py={0.5}
                          >
                            {state.label}
                          </Badge>
                        </Td>
                      </Tr>
                    );
                  })}
                {!filteredRows.length && (
                  <Tr>
                    <Td colSpan={6} textAlign="center">
                      <Text py={8}>Aucun stock à afficher.</Text>
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </Box>
        )}
        </Box>
        <Flex
          flexShrink={0}
          px={5}
          py={4}
          borderTop="1px solid #EAEAEA"
          justify="space-between"
          align="center"
          gap={3}
          wrap="wrap"
        >
          <Text fontSize="xs" color="gray.500" aria-live="polite">
            {loading
              ? "Chargement…"
              : error
              ? "Stocks indisponibles"
              : filteredRows.length
              ? `${currentPage * PAGE_SIZE + 1}–${Math.min(
                  (currentPage + 1) * PAGE_SIZE,
                  filteredRows.length
                )} sur ${filteredRows.length}`
              : "0 résultat"}
          </Text>
          <HStack>
            <Button
              size="sm"
              variant="outline"
              isDisabled={loading || !!error || currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              isDisabled={
                loading ||
                !!error ||
                (currentPage + 1) * PAGE_SIZE >= filteredRows.length
              }
              onClick={() => setPage(currentPage + 1)}
            >
              Suivant
            </Button>
          </HStack>
        </Flex>
      </Box>
    </Box>
  );
}
