import { useEffect, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Text,
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
import useAdminUser from "../../../../store/auth.store";
import useSyncStore from "../../../../store/sync.store";
import useDashboardTasksStore, {
  dashboardTaskScope,
} from "../../../../store/dashboardTasks.store";
import InventoryNavBar from "../components/InventoryNavBar";
import InventoryDashboardNotes from "../components/InventoryDashboardNotes";
import InventoryDashboardTasks from "../components/InventoryDashboardTasks";
import InventoryQuickActions from "../components/InventoryQuickActions";

interface DashboardData {
  items: InventoryItem[];
  balances: InventoryBalance[];
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

export default function InventoryDashboardPage() {
  const [tasksEmpty, setTasksEmpty] = useState(false);
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  const userId = useAdminUser((store) => store.adminUser._id);
  const restoreTasks = useDashboardTasksStore((store) => store.restore);
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
        const [items, balances] = await Promise.all([
          loadAll((options) => api.items.list(companyId, options)),
          loadAll((options) => api.balances.list(companyId, options)),
        ]);
        if (!cancelled) setData({ items, balances });
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
      label: "Ruptures de stock",
      value: alerts.filter((alert) => alert.outOfStock).length,
      icon: FaBoxOpen,
      color: "#E53E3E",
    },
  ];

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
        display="flex"
        flexDir="column"
        h={{ md: "calc(100vh - 52px)" }}
        overflowY={{ md: "auto" }}
        p={{ base: 3, md: 6 }}
        pb={{ base: "64px", md: 3 }}
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
            onClick={() => {
              restoreTasks(dashboardTaskScope(companyId, userId, "INVENTORY"));
              setRefresh((value) => value + 1);
            }}
          >
            Taches
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
        {companyId && userId && (
          <Grid
            templateColumns={{
              base: "1fr",
              xl: tasksEmpty ? "1fr" : "1.2fr 1fr",
            }}
            gap={6}
            mt={{ base: 6, xl: 12 }}
            mb={8}
            alignItems="start"
          >
            <Box
              w="100%"
              maxW={{
                base: "100%",
                xl: tasksEmpty ? "calc((100% - 24px) * 6 / 11)" : "100%",
              }}
              mx="auto"
              minW={0}
              mt="2rem"
            >
              <InventoryDashboardNotes
                key={`notes-${companyId}-${userId}`}
                companyId={companyId}
                userId={userId}
              />
            </Box>
            <InventoryDashboardTasks
              key={`tasks-${companyId}-${userId}`}
              companyId={companyId}
              userId={userId}
              version={`${syncVersion}-${refresh}`}
              onEmptyChange={setTasksEmpty}
            />
          </Grid>
        )}
        <Box
          mt="auto"
          pt={4}
          pb={2}
          position="sticky"
          bottom="0"
          bg="#F8FAFC"
          zIndex={1}
          flexShrink={0}
        >
          <InventoryQuickActions
            key={companyId}
            companyId={companyId}
            onSaved={() => setRefresh((value) => value + 1)}
          />
        </Box>
      </Box>
    </Flex>
  );
}
