import InventoryWarehouseDetailsPage from "../../modules/inventory/pages/InventoryWarehouseDetailsPage";
import IncidentListPage from "../../components/incidents/IncidentListPage";
import IncidentDetailsPage from "../../components/incidents/IncidentDetailsPage";
import { Box, Flex } from "@chakra-ui/react";
import InventoryNavBar from "../../modules/inventory/components/InventoryNavBar";
import TaskPage from "../../components/tasks/TaskPage";
import TaskDetailsPage from "../../components/tasks/TaskDetailsPage";
import { Outlet } from "react-router-dom";
import { ModuleProvider } from "../../context/ModuleContext";
import InventoryDashboardPage from "../../modules/inventory/pages/InventoryDashboardPage";
import InventoryItemsPage from "../../modules/inventory/pages/InventoryItemsPage";
import InventoryWarehousesPage from "../../modules/inventory/pages/InventoryWarehousesPage";
import InventoryStocksPage from "../../modules/inventory/pages/InventoryStocksPage";
// import InventoryMovementsPage from "../modules/inventory/pages/InventoryMovementsPage";
// import InventoryDocumentsPage from "../modules/inventory/pages/InventoryDocumentsPage";
// import InventoryCountPage from "../modules/inventory/pages/InventoryCountPage";

import PageErrorFallback from "../../components/common/PageErrorFallback";

export const inventoryRoutes = {
  path: "/inventory",
  element: (
    <ModuleProvider module="INVENTORY">
      <Outlet />
    </ModuleProvider>
  ),
  errorElement: <PageErrorFallback />,
  children: [
    {
      index: true,
      element: <InventoryDashboardPage />,
    },

    {
      path: "tasks",
      element: (
        <Flex direction={{ base: "column", md: "row" }} h="100vh" bg="#F8FAFC" overflow="hidden">
          <InventoryNavBar />
          <Box flex="1" minW={0} overflowY="auto">
            <Outlet />
          </Box>
        </Flex>
      ),
      children: [
        { index: true, element: <TaskPage /> },
        { path: "details/:_id", element: <TaskDetailsPage /> },
      ],
    },

    {
      path: "incidents",
      element: (
        <Flex direction={{ base: "column", md: "row" }} h="100vh" bg="#F8FAFC" overflow="hidden">
          <InventoryNavBar />
          <Box flex="1" minW={0} overflowY="auto"><Outlet /></Box>
        </Flex>
      ),
      children: [
        { index: true, element: <IncidentListPage /> },
        { path: ":_id", element: <IncidentDetailsPage /> },
      ],
    },

    {
      path: "items",
      element: (
        <Flex direction={{ base: "column", md: "row" }} h="100vh" bg="#FAFAFA" overflow="hidden">
          <InventoryNavBar />
          <Box flex="1" minW={0} overflowY="auto"><InventoryItemsPage /></Box>
        </Flex>
      ),
    },

    {
      path: "warehouses/:warehouseId",
      element: (
        <Flex direction={{ base: "column", md: "row" }} h={{ base: "calc(100dvh - 46px)", md: "calc(100dvh - 52px)" }} bg="#F8FAFC" overflow="hidden">
          <Box flexShrink={0} h={{ base: "30%", md: "100%" }} sx={{ "& > div:first-of-type": { height: "100%", minHeight: 0 } }}>
            <InventoryNavBar />
          </Box>
          <Box as="main" flex="1" minW={0} minH={0} overflow="hidden"><InventoryWarehouseDetailsPage /></Box>
        </Flex>
      ),
    },

    {
      path: "warehouses",
      element: (
        <Flex direction={{ base: "column", md: "row" }} h={{ base: "calc(100dvh - 46px)", md: "calc(100dvh - 52px)" }} bg="#FAFAFA" overflow="hidden">
          <Box flexShrink={0} h={{ base: "30%", md: "100%" }} sx={{ "& > div:first-of-type": { height: "100%", minHeight: 0 } }}>
            <InventoryNavBar />
          </Box>
          <Box as="main" flex="1" minW={0} minH={0} overflow="hidden"><InventoryWarehousesPage /></Box>
        </Flex>
      ),
    },

    {
      path: "stocks",
      element: (
        <Flex direction={{ base: "column", md: "row" }} h="100vh" bg="#F8FAFC" overflow={{ base: "auto", md: "hidden" }}>
          <InventoryNavBar />
          <Box as="main" flex="1" minW={0} h={{ md: "calc(100vh - 52px)" }} overflowY={{ md: "auto" }}><InventoryStocksPage /></Box>
        </Flex>
      ),
    },

    // {
    //   path: "movements",
    //   element: <InventoryMovementsPage />,
    // },

    // {
    //   path: "documents",
    //   element: <InventoryDocumentsPage />,
    // },

    // {
    //   path: "inventaire",
    //   element: <InventoryCountPage />,
    // },
  ],
};
