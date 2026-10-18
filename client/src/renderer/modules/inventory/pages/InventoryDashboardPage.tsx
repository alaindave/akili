import { useEffect, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  useBreakpointValue,
  useDisclosure,
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
  const navigation = useDisclosure();
  const isMobile = useBreakpointValue({ base: true, md: false });
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

  useEffect(() => {
    navigation.onClose();
  }, [isMobile, navigation.onClose]);

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
      h="100dvh"
      bg="#F8FAFC"
      overflow="hidden"
    >
      {isMobile ? (
        <>
          <Box flexShrink={0} px={4} py={2} borderBottom="1px solid" borderColor="gray.200">
            <Button size="sm" variant="outline" onClick={navigation.onOpen} aria-label="Ouvrir la navigation du stock">
              Menu
            </Button>
          </Box>
          <Drawer isOpen={navigation.isOpen} placement="left" onClose={navigation.onClose} size="xs">
            <DrawerOverlay />
            <DrawerContent>
              <DrawerCloseButton zIndex={1} />
              <DrawerBody p={0}>
                <InventoryNavBar showBottomBar={false} />
              </DrawerBody>
            </DrawerContent>
          </Drawer>
          <InventoryNavBar showSidebar={false} />
        </>
      ) : (
        <Box flexShrink={0} width={{ md: "210px", lg: "225px", xl: "240px" }} maxW="240px" overflow="hidden">
          <InventoryNavBar />
        </Box>
      )}
      <Box
        as="main"
        flex="1"
        minW={0}
        minH={0}
        display="flex"
        flexDir="column"
        overflow="hidden"
        p={4}
        pb={{ base: "calc(46px + 1rem)", md: "calc(52px + 1rem)" }}
      >
        <Flex justify="space-between" align={{ base: "flex-start", md: "center" }} flexDir={{ base: "column", md: "row" }} gap={3} flexShrink={0}>
          <Box>
            <Heading as="h1" fontSize="1.4rem" color="#03143B">
              Tableau de bord
            </Heading>
            <Text color="gray.600" position="relative" bottom="0.3rem">
              Vue d’ensemble de votre gestion de stock
            </Text>
          </Box>
          <Button
            mb="1rem"
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

        <Box flex="1" minH={0} minW={0} overflowY="auto" overflowX="hidden">
          <Flex direction="column" minH="100%" minW={0} px={2} pb={2}>
        <SimpleGrid minChildWidth="min(14rem, calc((100% - 1rem) / 2))" spacing={4} mt="3rem" flexShrink={0}>
          {metrics.map(({ label, value, icon: Icon, color }) => (
            <Box
              key={label}
              bg="linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))"
              border="1px solid rgba(255,255,255,0.12)"
              boxShadow="0 2px 8px rgba(0,0,0,0.5)"
              borderRadius="0.4rem"
              p={3}
              minH="6rem"
              minW={0}
              overflowWrap="anywhere"
            >
              <HStack spacing={{ base: 2, md: 3 }} align="center" flexWrap="nowrap">
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
                <Text minW={0} flex="1" color="gray.700" fontWeight="700" fontSize="1.1rem">
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
              base: "minmax(0, 1fr)",
              xl: tasksEmpty ? "minmax(0, 1fr)" : "minmax(0, 1.2fr) minmax(0, 1fr)",
            }}
            templateAreas={{
              base: tasksEmpty ? '"notes"' : '"tasks" "notes"',
              xl: tasksEmpty ? '"notes"' : '"notes tasks"',
            }}
            alignItems="start"
            columnGap={6}
            rowGap="3rem"
            flexShrink={0}
            pt={{ base: 6, xl: 12 }}
          >
            <Box
              gridArea="notes"
              w="100%"
              maxW={tasksEmpty ? "42rem" : undefined}
              justifySelf="center"
              minW={0}
              h="18rem"
            >
              <InventoryDashboardNotes
                key={`notes-${companyId}-${userId}`}
                companyId={companyId}
                userId={userId}
              />
            </Box>
            <Box
              gridArea="tasks"
              h="auto"
              maxH="42vh"
              overflowY="auto"
              overflowX="hidden"
              overscrollBehaviorY="contain"
              minW={0}
              minH={0}
              pl={{ base: 0, xl: 8 }}
              display={tasksEmpty ? "none" : "block"}
            >
              <InventoryDashboardTasks
                key={`tasks-${companyId}-${userId}`}
                companyId={companyId}
                userId={userId}
                version={`${syncVersion}-${refresh}`}
                onEmptyChange={setTasksEmpty}
              />
            </Box>
          </Grid>
        )}
        </Flex>
        </Box>
        <Box pt={4} px={2} flexShrink={0} minW={0}>
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
