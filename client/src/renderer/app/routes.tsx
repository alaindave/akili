import LateAttendanceReportPage from "../modules/hr/attendance/pages/LateAttendanceReportPage";
import DailyAttendanceReportPage from "../modules/hr/attendance/pages/DailyAttendanceReportPage";
import WeeklyAttendanceReportPage from "../modules/hr/attendance/pages/WeeklyAttendanceReportPage";
import SettingsPage from "../modules/auth/pages/SettingsPage";
import AttendanceSettingsPage from "../modules/auth/pages/AttendanceSettingsPage";
import { createHashRouter } from "react-router-dom";
import IncidentListPage from "../modules/incidents/pages/IncidentListPage";
import AdminPage from "../modules/auth/pages/AdminPage";
import App from "./App";
import EmployeeAdminPage from "../modules/hr/employees/pages/EmployeeAdminPage";
import EmployeeListPage from "../modules/hr/employees/pages/EmployeeListPage";
import EmployeeDetailsPage from "../modules/hr/employees/components/EmployeeDetailsPage";
import EmployeeAdminLayout from "../modules/hr/employees/components/EmployeeAdminLayout";
import EmployeeLeavePage from "../modules/hr/leave/pages/LeavePage";
import EmployeeAttendancePage from "../modules/hr/attendance/pages/AttendancePage";
import PageErrorFallback from "../components/PageErrorFallback";
import EmployeeAttendanceReport from "../modules/hr/attendance/pages/AttendanceReportPage";
import EmployeeLeaveReport from "../modules/hr/leave/pages/LeaveReport";
import PayrollPage from "../modules/hr/payroll/pages/PayrollPage";
import EmployeePayslips from "../modules/hr/payroll/pages/PayslipsPage";
import PayrollEmployeeProfileSettingsPage from "../modules/hr/payroll/pages/PayrollProfileSettingsPage";
import PayrollSettingsPage from "../modules/hr/payroll/pages/PayrollSettingsPage";
import PayrollDetailsPage from "../modules/hr/payroll/pages/PayrollDetailsPage";
import EmployeePayslipDetails from "../modules/hr/payroll/pages/PayslipDetailsPage";
import TaskPage from "../modules/tasks/pages/TaskPage";
import TaskDetailsPage from "../modules/tasks/pages/TaskDetailsPage";
import ReportPage from "../modules/hr/reports/pages/ReportPage";
import TransportAllowancePage from "../modules/hr/attendance/pages/TransportAllowancePage";
import TransportAllowanceWeeklyReportPage from "../modules/hr/attendance/pages/TransportAllowanceWeeklyPage";
import CompanySettingsPage from "../modules/auth/pages/CompanySettingsPage";

const router = createHashRouter([
  { path: "/admin/settings", element: <SettingsPage />, errorElement: <PageErrorFallback /> },
  { path: "/admin/settings/attendance", element: <AttendanceSettingsPage />, errorElement: <PageErrorFallback /> },
  {
    path: "/",
    element: <App />,
    errorElement: <PageErrorFallback />,
  },

  {
    path: "/admin",
    element: <AdminPage />,
    errorElement: <PageErrorFallback />,
  },

  {
    path: "/admin/company_settings",
    element: <CompanySettingsPage />,
    errorElement: <PageErrorFallback />,
  },

  {
    path: "/employees_admin",
    element: <EmployeeAdminLayout />,
    children: [
      {
        path: "incidents",
        element: <IncidentListPage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "",
        element: <EmployeeAdminPage />,
        errorElement: <PageErrorFallback />,
      },

      {
        path: "employees_list",
        element: <EmployeeListPage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "employees_list/:_id",
        element: <EmployeeDetailsPage />,
        errorElement: <PageErrorFallback />,
      },

      {
        path: "employees_list/:_id/attendances",
        element: <EmployeeAttendanceReport />,
        errorElement: <PageErrorFallback />,
      },

      {
        path: "employees_list/:_id/leaves",
        element: <EmployeeLeaveReport />,
        errorElement: <PageErrorFallback />,
      },

      {
        path: "employees_list/:_id/payslips",
        element: <EmployeePayslips />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "employees_list/:_id/payslips/:payslipId",
        element: <EmployeePayslipDetails />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "employees_list/:_id/payslips/settings",
        element: <PayrollEmployeeProfileSettingsPage />,
        errorElement: <PageErrorFallback />,
      },

      {
        path: "attendances",
        element: <EmployeeAttendancePage />,
        errorElement: <PageErrorFallback />,
      },

      {
        path: "leaves",
        element: <EmployeeLeavePage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "payroll",
        element: <PayrollPage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "reports",
        element: <ReportPage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "reports/late_attendance",
        element: <LateAttendanceReportPage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "reports/daily_attendance",
        element: <DailyAttendanceReportPage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "reports/weekly_attendance",
        element: <WeeklyAttendanceReportPage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "reports/transport_allowance",
        element: <TransportAllowancePage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "reports/transport_allowance/transport_allowance_weekly",
        element: <TransportAllowanceWeeklyReportPage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "tasks",
        element: <TaskPage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "tasks/details/:_id",
        element: <TaskDetailsPage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "payroll/settings",
        element: <PayrollSettingsPage />,
        errorElement: <PageErrorFallback />,
      },
      {
        path: "payroll/details/:_id",
        element: <PayrollDetailsPage />,
        errorElement: <PageErrorFallback />,
      },
    ],
  },
]);

export default router;
