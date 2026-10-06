import { Box, Flex } from "@chakra-ui/react";
import InventoryNavBar from "../../modules/inventory/components/InventoryNavBar";
import TaskPage from "../../components/tasks/TaskPage";
import TaskDetailsPage from "../../components/tasks/TaskDetailsPage";
import { Outlet } from "react-router-dom";
import { ModuleProvider } from "../../context/ModuleContext";
import InventoryDashboardPage from "../../modules/inventory/pages/InventoryDashboardPage";
// import InventoryItemsPage from "../modules/inventory/pages/InventoryItemsPage";
// import InventoryStockPage from "../modules/inventory/pages/InventoryStockPage";
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

    // {
    //   path: "items",
    //   element: <InventoryItemsPage />,
    // },

    // {
    //   path: "stocks",
    //   element: <InventoryStockPage />,
    // },

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
