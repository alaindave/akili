import { Link, useNavigate } from "react-router-dom";
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
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import {
  FiArrowLeft,
  FiArrowRight,
  FiAlertTriangle,
  FiGrid,
  FiPlus,
  FiSearch,
} from "react-icons/fi";
import { FaBoxOpen, FaWarehouse } from "react-icons/fa";
import type {
  InventoryWarehouse,
  InventoryLocation,
} from "../../../../common/types/inventory/InventoryWarehouse";
import type {
  InventoryBalance,
  InventoryItem,
} from "../../../../common/types/inventory/InventoryItem";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";
import InventoryWarehouseForm, {
  warehouseTypeLabels,
} from "../components/InventoryWarehouseForm";

const PAGE_SIZE = 20;
interface WarehouseData {
  warehouses: InventoryWarehouse[];
  locations: InventoryLocation[];
  items: InventoryItem[];
  balances: InventoryBalance[];
}

// Read every API page so metrics and filters cover the entire company.
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

export default function InventoryWarehousesPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  return companyId ? (
    <CompanyWarehouses key={companyId} companyId={companyId} />
  ) : (
    <Alert>Connectez-vous à une entreprise pour consulter les entrepôts.</Alert>
  );
}

function CompanyWarehouses({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<WarehouseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    async function load() {
      try {
        const api = window.electron.inventory;
        const [warehouses, locations, items, balances] = await Promise.all([
          loadAll((options) => api.warehouses.list(companyId, options)),
          loadAll((options) => api.locations.list(companyId, options)),
          loadAll((options) => api.items.list(companyId, options)),
          loadAll((options) => api.balances.list(companyId, options)),
        ]);
        if (active) setData({ warehouses, locations, items, balances });
      } catch {
        if (active)
          setError("Impossible de charger les entrepôts. Veuillez réessayer.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [companyId, refresh, syncVersion]);

  const summary = useMemo(() => {
    const locationCounts = new Map<string, number>();
    const quantities = new Map<string, number>();
    const warehouseIds = new Set(
      data?.warehouses.map((warehouse) => warehouse._id)
    );
    data?.locations.forEach((location) => {
      if (warehouseIds.has(location.warehouseId))
        locationCounts.set(
          location.warehouseId,
          (locationCounts.get(location.warehouseId) ?? 0) + 1
        );
    });
    data?.balances.forEach((balance) => {
      quantities.set(
        balance.itemId,
        (quantities.get(balance.itemId) ?? 0) + balance.quantityAvailable
      );
    });
    return {
      locationCounts,
      active:
        data?.warehouses.filter((warehouse) => warehouse.isActive).length ?? 0,
      locations: [...locationCounts.values()].reduce(
        (sum, count) => sum + count,
        0
      ),
      // Match the inventory dashboard: stockouts are separate from low stock.
      outOfStock:
        data?.items.filter(
          (item) => item.isActive && (quantities.get(item._id) ?? 0) <= 0
        ).length ?? 0,
      lowStock:
        data?.items.filter((item) => {
          const available = quantities.get(item._id) ?? 0;
          return (
            item.isActive &&
            item.reorderPoint != null &&
            available > 0 &&
            available <= item.reorderPoint
          );
        }).length ?? 0,
    };
  }, [data]);

  const filtered = (data?.warehouses ?? []).filter((warehouse) => {
    const query = search.trim().toLocaleLowerCase("fr");
    return (
      (!query ||
        [warehouse.code, warehouse.name, warehouse.address ?? ""].some(
          (value) => value.toLocaleLowerCase("fr").includes(query)
        )) &&
      (!type || warehouse.type === type) &&
      (!status || warehouse.isActive === (status === "active"))
    );
  });
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1)
  );
  const rows = filtered.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );
  const hasFilters = Boolean(search || type || status);
  const reset = () => {
    setSearch("");
    setType("");
    setStatus("");
    setPage(0);
  };
  const metrics = [
    {
      label: "Entrepôts actifs",
      value: summary.active,
      icon: FaWarehouse,
      color: "#000080",
      help: "Entrepôts en activité",
    },
    {
      label: "Emplacements",
      value: summary.locations,
      icon: FiGrid,
      color: "#16833E",
      help: "Emplacements de stockage",
    },
    {
      label: "Stock faible",
      value: summary.lowStock,
      icon: FiAlertTriangle,
      color: "#D97706",
      help: "Articles au seuil ou en dessous, hors ruptures · tous entrepôts",
    },
    {
      label: "Rupture de stock",
      value: summary.outOfStock,
      icon: FaBoxOpen,
      color: "#E53E3E",
      help: "Articles actifs sans stock disponible · tous entrepôts",
    },
  ];

  return (
    <Box
      h="100%"
      minH={0}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      bg="#FAFAFA"
      color="#262626"
      p={{ base: 3, md: 6 }}
      pb={6}
    >
      <Flex
        justify="space-between"
        align={{ base: "start", lg: "center" }}
        gap={5}
        wrap="wrap"
        flexShrink={0}
      >
        <Box>
          <Heading as="h1" fontSize="1.4rem" color="#03143B">
            Entrepôts
          </Heading>
          <Text fontSize="1rem" color="#737373">
            Gérez vos entrepôts et leurs emplacements de stockage
          </Text>
        </Box>
        <Button
          colorScheme="yellow"
          leftIcon={<FiPlus />}
          fontSize="sm"
          h="42px"
          px={5}
          borderRadius="8px"
          onClick={() => setCreating(true)}
        >
          Nouvel entrepôt
        </Button>
      </Flex>

      <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={6} mt={10} mb={8} flexShrink={0}>
        {metrics.map(({ label, value, icon: Icon, color, help }) => (
          <Box
            key={label}
            title={help}
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
              <Text fontWeight="700" color="gray.700" fontSize="1.1rem">
                {label}
              </Text>
            </HStack>
            <Skeleton isLoaded={!loading} mt={3}>
              <Text
                color="black"
                fontSize="1.5rem"
                fontWeight="700"
                textAlign="right"
              >
                {data && !error ? value.toLocaleString("fr-FR") : "—"}
              </Text>
            </Skeleton>
          </Box>
        ))}
      </SimpleGrid>

      <Box
        border="1px solid #E5E5E5"
        borderRadius="12px"
        bg="white"
        overflow="hidden"
        display="flex"
        flexDirection="column"
        flex="1"
        minH={0}
        boxShadow="0 2px 6px rgba(0,0,0,0.02)"
      >
        <Flex p={5} gap={3} wrap="wrap" borderBottom="1px solid #EAEAEA" flexShrink={0}>
          <InputGroup flex="1" minW="200px">
            <InputLeftElement pointerEvents="none" color="#909090">
              <FiSearch />
            </InputLeftElement>
            <Input
              aria-label="Rechercher un entrepôt"
              placeholder="Rechercher par nom, code ou adresse…"
              value={search}
              maxLength={255}
              fontSize="sm"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </InputGroup>
          <Select
            aria-label="Filtrer par type"
            w={{ base: "100%", sm: "210px" }}
            fontSize="sm"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tous les types</option>
            {Object.entries(warehouseTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrer par statut"
            w={{ base: "100%", sm: "170px" }}
            fontSize="sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </Select>
          {hasFilters && (
            <Button variant="ghost" fontSize="sm" onClick={reset}>
              Réinitialiser
            </Button>
          )}
        </Flex>

        <Box flex="1" minH={0} overflow="auto">
        {error ? (
          <Stack p={8} align="start">
            <Text role="alert">{error}</Text>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Réessayer
            </Button>
          </Stack>
        ) : loading ? (
          <Stack
            p={6}
            spacing={5}
            role="status"
            aria-label="Chargement des entrepôts"
          >
            {[0, 1, 2, 3, 4].map((value) => (
              <Skeleton key={value} height="36px" />
            ))}
          </Stack>
        ) : rows.length === 0 ? (
          <Stack align="center" spacing={3} py={16} px={6} textAlign="center">
            <Box bg="#F5F5F5" p={4} borderRadius="14px" color="#737373">
              <FaWarehouse size={25} />
            </Box>
            <Text fontWeight="600">
              {hasFilters
                ? "Aucun entrepôt trouvé"
                : "Aucun entrepôt enregistré"}
            </Text>
            <Text fontSize="sm" color="#737373">
              {hasFilters
                ? "Modifiez votre recherche ou vos filtres."
                : "Créez votre premier entrepôt pour organiser votre stockage."}
            </Text>
            <Button
              variant="outline"
              size="sm"
              onClick={hasFilters ? reset : () => setCreating(true)}
            >
              {hasFilters ? "Réinitialiser les filtres" : "Créer un entrepôt"}
            </Button>
          </Stack>
        ) : (
          <TableContainer overflow="visible">
            <Table
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
                td: { borderColor: "#F0F0F0", py: 4, fontSize: "sm" },
              }}
            >
              <Thead>
                <Tr>
                  <Th>Entrepôt</Th>
                  <Th>Type</Th>
                  <Th>Adresse</Th>
                  <Th isNumeric>Emplacements</Th>
                  <Th>Statut</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((warehouse) => (
                  <Tr
                    key={warehouse._id}
                    cursor="pointer"
                    _hover={{ bg: "#F1F5F9" }}
                    onClick={() =>
                      navigate(`/inventory/warehouses/${warehouse._id}`)
                    }
                  >
                    <Td minW="220px" maxW="340px">
                      <Text fontWeight="600" isTruncated title={warehouse.name}>
                        <Link
                          to={`/inventory/warehouses/${warehouse._id}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {warehouse.name}
                        </Link>
                      </Text>
                      <Text
                        color="#858585"
                        fontFamily="mono"
                        fontSize="xs"
                        mt={1}
                      >
                        {warehouse.code}
                      </Text>
                      {warehouse.description && (
                        <Text
                          color="#737373"
                          fontSize="xs"
                          mt={1}
                          isTruncated
                          title={warehouse.description}
                        >
                          {warehouse.description}
                        </Text>
                      )}
                    </Td>
                    <Td color="#525252">
                      {warehouseTypeLabels[warehouse.type] ?? "—"}
                    </Td>
                    <Td maxW="300px">
                      <Text
                        color="#737373"
                        isTruncated
                        title={warehouse.address}
                      >
                        {warehouse.address || "—"}
                      </Text>
                    </Td>
                    <Td isNumeric>
                      {(
                        summary.locationCounts.get(warehouse._id) ?? 0
                      ).toLocaleString("fr-FR")}
                    </Td>
                    <Td>
                      <Badge
                        colorScheme={warehouse.isActive ? "green" : "gray"}
                        textTransform="none"
                        borderRadius="full"
                        px={2.5}
                        py={0.5}
                      >
                        {warehouse.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
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
          <Text fontSize="xs" color="#737373" aria-live="polite">
            {loading
              ? "Chargement…"
              : error
              ? "Entrepôts indisponibles"
              : filtered.length
              ? `${currentPage * PAGE_SIZE + 1}–${Math.min(
                  (currentPage + 1) * PAGE_SIZE,
                  filtered.length
                )} sur ${filtered.length} entrepôts`
              : "0 entrepôt"}
          </Text>
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<FiArrowLeft />}
              isDisabled={loading || Boolean(error) || currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              rightIcon={<FiArrowRight />}
              isDisabled={
                loading ||
                Boolean(error) ||
                (currentPage + 1) * PAGE_SIZE >= filtered.length
              }
              onClick={() => setPage(currentPage + 1)}
            >
              Suivant
            </Button>
          </HStack>
        </Flex>
      </Box>
      {creating && (
        <InventoryWarehouseForm
          companyId={companyId}
          onClose={() => setCreating(false)}
          onSaved={(warehouse) => {
            setCreating(false);
            reset();
            setRefresh((value) => value + 1);
            toast({
              title: "Entrepôt créé",
              description: `${warehouse.code} · ${warehouse.name}`,
              status: "success",
              duration: 4000,
              isClosable: true,
            });
          }}
        />
      )}
    </Box>
  );
}
