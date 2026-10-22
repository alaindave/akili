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
import PageSubtitle from "../../../components/common/PageSubtitle";

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
  const locations = useMemo(() => {
    const byId = new Map(data?.locations.map((entry) => [entry._id, entry]));
    return new Map(
      data?.locations.map((entry) => {
        const names: string[] = [];
        const visited = new Set<string>();
        let current: InventoryLocation | undefined = entry;
        while (
          current &&
          current.warehouseId === entry.warehouseId &&
          !visited.has(current._id)
        ) {
          visited.add(current._id);
          names.unshift(current.name);
          current = current.parentId ? byId.get(current.parentId) : undefined;
        }
        return [entry._id, names.join(">")];
      })
    );
  }, [data?.locations]);
  const locationOptions = useMemo(() => {
    if (!warehouse) return [];
    const entries = (data?.locations ?? []).filter(
      (entry) => entry.warehouseId === warehouse
    );
    const ids = new Set(entries.map((entry) => entry._id));
    const children = new Map<string, InventoryLocation[]>();
    for (const entry of entries) {
      const parentId =
        entry.parentId && ids.has(entry.parentId) ? entry.parentId : "";
      const siblings = children.get(parentId) ?? [];
      siblings.push(entry);
      children.set(parentId, siblings);
    }
    const options: { entry: InventoryLocation; depth: number }[] = [];
    const visited = new Set<string>();
    const visit = (entry: InventoryLocation, depth: number) => {
      if (visited.has(entry._id)) return;
      visited.add(entry._id);
      options.push({ entry, depth });
      for (const child of children.get(entry._id) ?? []) {
        visit(child, depth + 1);
      }
    };
    for (const entry of children.get("") ?? []) visit(entry, 0);
    // Keep locations with circular parent links reachable without duplicating them.
    for (const entry of entries) visit(entry, 0);
    return options;
  }, [data?.locations, warehouse]);
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
      minW={0}
      bg="#F8FAFC"
      p={4}
      pb={{ base: 0, md: 4 }}
    >
      <Box position="relative" top="0.6rem">
        <Heading
          as="h1"
          color="#1F2937"
          fontSize={{ base: "1.1rem", sm: "1.2rem", md: "1.3rem" }}
          fontWeight="700"
          lineHeight="1.1"
          flexShrink={0}
        >
          Stocks
        </Heading>
        <PageSubtitle mt="0.2rem">
          Consultez les quantités disponibles.
        </PageSubtitle>
      </Box>
      <Flex
        direction="column"
        flex="1"
        minH={0}
        minW={0}
        overflowY="auto"
        overflowX="hidden"
      >
        <SimpleGrid
          minChildWidth={{
            base: "min(14rem, calc((100% - 0.2rem) / 2))",
            md: "min(14rem, calc((100% - 1rem) / 2))",
          }}
          spacing={{ base: "0.2rem", md: 4 }}
          mt={10}
          mb={{ base: 0, md: 8 }}
          flexShrink={0}
        >
          {metrics.map(({ label, value, icon: Icon, color }) => (
            <Box
              key={label}
              bg="linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))"
              border="1px solid rgba(255,255,255,0.12)"
              boxShadow="0 2px 8px rgba(0,0,0,0.5)"
              borderRadius="0.4rem"
              p={3}
              py={{ base: 1, md: 3 }}
              minH={{ base: "5rem", md: "6rem" }}
              minW={0}
              overflowWrap="anywhere"
            >
              <HStack
                spacing={{ base: 2, md: 3 }}
                align="center"
                flexWrap="nowrap"
              >
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
                <Text
                  minW={0}
                  flex="1"
                  color="gray.700"
                  fontWeight="700"
                  fontSize="1.1rem"
                >
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
          minH="20rem"
          minW={0}
          my={{ base: "0.1rem", md: 0 }}
        >
          <Flex
            p={{ base: 2, md: 4 }}
            gap={{ base: 1, md: 2 }}
            wrap="nowrap"
            overflowX="auto"
            sx={{
              "& > .chakra-select__wrapper": {
                flex: "1 1 0",
                minWidth: "7rem",
              },
            }}
            borderBottom="1px solid #EAEAEA"
            flexShrink={0}
          >
            <InputGroup flex="2 1 0" minW="9rem">
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
              w="100%"
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
              isDisabled={!warehouse}
              w="100%"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setPage(0);
              }}
              fontSize="sm"
            >
              <option value="">
                {warehouse
                  ? "Tous les emplacements"
                  : "Sélectionnez un entrepôt"}
              </option>
              {locationOptions.map(({ entry, depth }) => (
                <option key={entry._id} value={entry._id}>
                  {depth > 0 ? `${"\u00a0\u00a0".repeat(depth)}↳ ` : ""}
                  {entry.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrer par statut"
              w="100%"
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
              <Button variant="ghost" flexShrink={0} onClick={reset}>
                Réinitialiser
              </Button>
            )}
          </Flex>
          <Box
            flex="1"
            minH={0}
            overflow="auto"
            tabIndex={0}
            role="region"
            aria-label="Tableau des stocks"
          >
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
              <Box>
                <Table
                  size="md"
                  w="100%"
                  minW="40rem"
                  sx={{
                    tableLayout: "fixed",
                    "th, td": {
                      px: { base: 2, md: 3, xl: 4 },
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    },
                    th: {
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      bg: "#FAFAFA",
                      color: "#737373",
                      fontSize: "10px",
                      letterSpacing: "0.08em",
                      py: 3.5,
                      whiteSpace: "nowrap",
                      overflowWrap: "normal",
                      verticalAlign: "middle",
                    },
                    "th:nth-of-type(4), th:nth-of-type(5), td:nth-of-type(4), td:nth-of-type(5)":
                      {
                        px: 1,
                      },
                    td: {
                      py: 3,
                      fontSize: "sm",
                      borderColor: "#F0F0F0",
                      verticalAlign: "middle",
                    },
                  }}
                >
                  <colgroup>
                    <col style={{ width: "27%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "13%" }} />
                  </colgroup>
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
                      .slice(
                        currentPage * PAGE_SIZE,
                        (currentPage + 1) * PAGE_SIZE
                      )
                      .map((row) => {
                        const state =
                          statuses[stockStatus(row.available, row.item)];
                        return (
                          <Tr key={row.key} _hover={{ bg: "#FCFCFC" }}>
                            <Td>
                              <Text
                                fontWeight="600"
                                noOfLines={2}
                                title={row.item.name}
                              >
                                {row.item.name}
                              </Text>
                              <Text
                                color="gray.500"
                                fontSize="xs"
                                fontFamily="mono"
                                mt={1}
                                noOfLines={1}
                                title={row.item.sku}
                              >
                                {row.item.sku}
                              </Text>
                            </Td>
                            <Td>
                              <Text
                                noOfLines={3}
                                title={warehouses.get(row.warehouseId)}
                              >
                                {warehouses.get(row.warehouseId) ?? "—"}
                              </Text>
                            </Td>
                            <Td>
                              <Text
                                noOfLines={3}
                                title={locations.get(row.locationId)}
                              >
                                {(locations.get(row.locationId) ?? "—")
                                  .split(">")
                                  .join(" > ")}
                              </Text>
                            </Td>
                            <Td isNumeric>
                              <Text
                                noOfLines={3}
                                title={formatNumber(row.available)}
                              >
                                {formatNumber(row.available)}
                              </Text>
                            </Td>
                            <Td isNumeric>
                              <Text
                                noOfLines={3}
                                title={formatNumber(row.reserved)}
                              >
                                {formatNumber(row.reserved)}
                              </Text>
                            </Td>
                            <Td>
                              <Badge
                                colorScheme={state.color}
                                textTransform="none"
                                borderRadius="full"
                                px={2.5}
                                py={0.5}
                                maxW="100%"
                                whiteSpace="normal"
                              >
                                <Text as="span" noOfLines={3}>
                                  {state.label}
                                </Text>
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
      </Flex>
    </Box>
  );
}
