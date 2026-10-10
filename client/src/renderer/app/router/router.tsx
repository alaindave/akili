import StockSettingsPage from "../../modules/auth/pages/StockSettingsPage";
import StockInitializationPage from "../../modules/auth/pages/StockInitializationPage";
import { createHashRouter } from "react-router-dom";
import App from "../App";
import AdminPage from "../../modules/auth/pages/AdminPage";
import SettingsPage from "../../modules/auth/pages/SettingsPage";
import PayrollAdminSettingsPage from "../../modules/auth/pages/PayrollAdminSettingsPage";
import AttendanceSettingsPage from "../../modules/auth/pages/AttendanceSettingsPage";
import CompanySettingsPage from "../../modules/auth/pages/CompanySettingsPage";
import PageErrorFallback from "../../components/common/PageErrorFallback";
import { hrRoutes } from "./hr.routes";
import { inventoryRoutes } from "./inventory.routes";

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <PageErrorFallback />,
  },

  // HR
  hrRoutes,

  // Inventory
  inventoryRoutes,

  { path: "/admin/settings/stock", element: <StockSettingsPage />, errorElement: <PageErrorFallback /> },
  { path: "/admin/settings/stock/initialization", element: <StockInitializationPage />, errorElement: <PageErrorFallback /> },

  // Administration
  {
    path: "/admin",
    element: <AdminPage />,
    errorElement: <PageErrorFallback />,
  },

  {
    path: "/admin/settings",
    element: <SettingsPage />,
    errorElement: <PageErrorFallback />,
  },

  {
    path: "/admin/settings/payroll",
    element: <PayrollAdminSettingsPage />,
    errorElement: <PageErrorFallback />,
  },

  {
    path: "/admin/settings/attendance",
    element: <AttendanceSettingsPage />,
    errorElement: <PageErrorFallback />,
  },

  {
    path: "/admin/company_settings",
    element: <CompanySettingsPage />,
    errorElement: <PageErrorFallback />,
  },
]);

export default router;
