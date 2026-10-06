import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  FaBoxOpen,
  FaBoxes,
  FaCoins,
  FaExclamationTriangle,
} from "react-icons/fa";
import { IoReloadOutline } from "react-icons/io5";
import type {
  InventoryBalance,
  InventoryItem,
} from "../../../../common/types/inventory/InventoryItem";
import type { InventoryMovement } from "../../../../common/types/inventory/InventoryMovement";
import type { InventoryWarehouse } from "../../../../common/types/inventory/InventoryWarehouse";
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";
import InventoryNavBar from "../components/InventoryNavBar";

interface DashboardData {
  items: InventoryItem[];
  balances: InventoryBalance[];
  warehouses: InventoryWarehouse[];
  movements: InventoryMovement[];
}

// The list APIs are paginated; collect every page for accurate totals.
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

const formatNumber = (value: number) =>
  value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const stockValue = (balance: InventoryBalance) =>
  balance.totalValue ?? balance.quantityOnHand * (balance.averageCost ?? 0);

function DashboardCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box
      bg="#F8FAFC"
      border="1px solid #E2E8F0"
      boxShadow="0 2px 8px rgba(0,0,0,0.2)"
      borderRadius="5px"
      p={5}
      minW={0}
    >
      <Heading as="h2" fontSize="1.15rem" color="#1F2937" mb={4}>
        {title}
      </Heading>
      <VStack align="stretch" spacing={4} maxH="360px" overflowY="auto">
        {children}
      </VStack>
    </Box>
  );
}

export default function InventoryDashboardPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);
    async function load() {
      try {
        if (!companyId) throw new Error("Missing company");
        const api = window.electron.inventory;
        const [items, balances, warehouses, movements] = await Promise.all([
          loadAll((options) => api.items.list(companyId, options)),
          loadAll((options) => api.balances.list(companyId, options)),
          loadAll((options) => api.warehouses.list(companyId, options)),
          api.movements.list(companyId, { limit: 6 }),
        ]);
        if (!cancelled) setData({ items, balances, warehouses, movements });
      } catch (cause) {
        console.error("Unable to load inventory dashboard", cause);
        if (!cancelled)
          setError(
            "Impossible de charger le tableau de bord. Veuillez réessayer."
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId, syncVersion, refresh]);

  const quantities = new Map<string, number>();
  data?.balances.forEach((balance) => {
    quantities.set(
      balance.itemId,
      (quantities.get(balance.itemId) ?? 0) + balance.quantityAvailable
    );
  });
  const activeItems = data?.items.filter((item) => item.isActive) ?? [];
  const alerts = activeItems
    .flatMap((item) => {
      const quantity = quantities.get(item._id) ?? 0;
      return quantity <= 0 ||
        (item.reorderPoint != null && quantity <= item.reorderPoint)
        ? [{ item, quantity, outOfStock: quantity <= 0 }]
        : [];
    })
    .sort(
      (a, b) =>
        Number(b.outOfStock) - Number(a.outOfStock) || a.quantity - b.quantity
    );
  const metrics = [
    {
      label: "Valeur stock",
      value:
        data?.balances.reduce((sum, balance) => sum + stockValue(balance), 0) ??
        0,
      icon: FaCoins,
      color: "#000080",
    },
    {
      label: "Articles",
      value: activeItems.length,
      icon: FaBoxes,
      color: "#16833e",
    },
    {
      label: "Stock faible",
      value: alerts.filter((alert) => !alert.outOfStock).length,
      icon: FaExclamationTriangle,
      color: "#D97706",
    },
    {
      label: "Ruptures",
      value: alerts.filter((alert) => alert.outOfStock).length,
      icon: FaBoxOpen,
      color: "#E53E3E",
    },
  ];
  const itemNames = new Map(data?.items.map((item) => [item._id, item.name]));
  const warehouseNames = new Map(
    data?.warehouses.map((warehouse) => [warehouse._id, warehouse.name])
  );

  return (
    <Flex
      direction={{ base: "column", md: "row" }}
      h="100vh"
      bg="#F8FAFC"
      overflow={{ base: "auto", md: "hidden" }}
    >
      <InventoryNavBar />
      <Box
        as="main"
        flex="1"
        minW={0}
        overflowY={{ md: "auto" }}
        p={{ base: 3, md: 6 }}
        pb="80px"
      >
        <Flex justify="space-between" align="center" gap={3} wrap="wrap">
          <Box>
            <Heading as="h1" fontSize="1.4rem" color="#03143B">
              Tableau de bord
            </Heading>
            <Text color="gray.600" mt={1}>
              Vue d’ensemble de votre gestion de stock
            </Text>
          </Box>
          <Button
            colorScheme="blue"
            leftIcon={<IoReloadOutline />}
            isLoading={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Actualiser
          </Button>
        </Flex>

        <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={6} mt={10}>
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

        {loading && (
          <HStack role="status" justify="center" mt={8}>
            <Spinner color="blue.500" />
            <Text>Chargement du stock…</Text>
          </HStack>
        )}
        {error && (
          <Alert status="error" mt={8}>
            <AlertIcon />
            {error}
          </Alert>
        )}
        {data && (
          <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={6} mt={8}>
            <DashboardCard title="Stock par entrepôt">
              {data.warehouses.length === 0 && (
                <Text color="gray.600">Aucun entrepôt enregistré.</Text>
              )}
              {data.warehouses.map((warehouse) => {
                const balances = data.balances.filter(
                  (balance) => balance.warehouseId === warehouse._id
                );
                const articleCount = new Set(
                  balances
                    .filter((balance) => balance.quantityOnHand > 0)
                    .map((balance) => balance.itemId)
                ).size;
                return (
                  <Box
                    key={warehouse._id}
                    borderBottom="1px solid #E2E8F0"
                    pb={3}
                  >
                    <Text fontWeight="600" color="gray.800">
                      {warehouse.name}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {articleCount} article(s) en stock
                    </Text>
                    <Text color="gray.700">
                      Valeur :{" "}
                      {formatNumber(
                        balances.reduce(
                          (sum, balance) => sum + stockValue(balance),
                          0
                        )
                      )}
                    </Text>
                  </Box>
                );
              })}
            </DashboardCard>
            <DashboardCard title="Alertes stock">
              <Text fontSize="sm" color="gray.600">
                Selon le stock disponible et le seuil de réapprovisionnement des
                articles actifs.
              </Text>
              {alerts.length === 0 && (
                <Text color="gray.600">Aucune alerte de stock.</Text>
              )}
              {alerts.map(({ item, quantity, outOfStock }) => (
                <Box key={item._id} borderBottom="1px solid #E2E8F0" pb={3}>
                  <Text fontWeight="600" color="gray.800">
                    {item.name}
                  </Text>
                  <Badge colorScheme={outOfStock ? "red" : "orange"}>
                    {outOfStock ? "Rupture" : "Stock faible"}
                  </Badge>
                  <Text color="gray.600" fontSize="sm">
                    Disponible : {formatNumber(quantity)} · Seuil :{" "}
                    {formatNumber(item.reorderPoint ?? 0)}
                  </Text>
                </Box>
              ))}
            </DashboardCard>
            <DashboardCard title="Mouvements récents">
              {data.movements.length === 0 && (
                <Text color="gray.600">Aucun mouvement enregistré.</Text>
              )}
              {data.movements.map((movement) => (
                <Box key={movement._id} borderBottom="1px solid #E2E8F0" pb={3}>
                  <Text fontWeight="600" color="gray.800">
                    {itemNames.get(movement.itemId) ?? movement.itemId}
                  </Text>
                  <HStack justify="space-between">
                    <Badge
                      colorScheme={
                        movement.direction === "IN" ? "green" : "red"
                      }
                    >
                      {movement.direction === "IN" ? "Entrée" : "Sortie"}
                    </Badge>
                    <Text color="gray.800">
                      {movement.direction === "IN" ? "+" : "−"}
                      {formatNumber(Math.abs(movement.quantity))}
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color="gray.600">
                    {warehouseNames.get(movement.warehouseId) ??
                      movement.warehouseId}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {new Date(movement.occurredAt).toLocaleString("fr-FR")}
                  </Text>
                </Box>
              ))}
            </DashboardCard>
          </SimpleGrid>
        )}
      </Box>
    </Flex>
  );
}
