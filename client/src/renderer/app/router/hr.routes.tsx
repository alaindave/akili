import { ModuleProvider } from "../../context/ModuleContext";

import EmployeeAdminPage from "../../modules/hr/employees/pages/EmployeeAdminPage";
import EmployeeListPage from "../../modules/hr/employees/pages/EmployeeListPage";
import EmployeeDetailsPage from "../../modules/hr/employees/components/EmployeeDetailsPage";
import EmployeeAdminLayout from "../../modules/hr/employees/components/EmployeeAdminLayout";

import EmployeeLeavePage from "../../modules/hr/leave/pages/LeavePage";
import EmployeeLeaveReport from "../../modules/hr/leave/pages/LeaveReport";

import EmployeeAttendancePage from "../../modules/hr/attendance/pages/AttendancePage";
import EmployeeAttendanceReport from "../../modules/hr/attendance/pages/AttendanceReportPage";
import LateAttendanceReportPage from "../../modules/hr/attendance/pages/LateAttendanceReportPage";
import DailyAttendanceReportPage from "../../modules/hr/attendance/pages/DailyAttendanceReportPage";
import WeeklyAttendanceReportPage from "../../modules/hr/attendance/pages/WeeklyAttendanceReportPage";
import TransportAllowancePage from "../../modules/hr/attendance/pages/TransportAllowancePage";
import TransportAllowanceWeeklyReportPage from "../../modules/hr/attendance/pages/TransportAllowanceWeeklyPage";

import PayrollPage from "../../modules/hr/payroll/pages/PayrollPage";
import EmployeePayslips from "../../modules/hr/payroll/pages/PayslipsPage";
import EmployeePayslipDetails from "../../modules/hr/payroll/pages/PayslipDetailsPage";
import PayrollEmployeeProfileSettingsPage from "../../modules/hr/payroll/pages/PayrollProfileSettingsPage";
import PayrollSettingsPage from "../../modules/hr/payroll/pages/PayrollSettingsPage";
import PayrollDetailsPage from "../../modules/hr/payroll/pages/PayrollDetailsPage";

import ReportPage from "../../modules/hr/reports/pages/ReportPage";

import IncidentDetailsPage from "../../components/incidents/IncidentDetailsPage";
import IncidentListPage from "../../components/incidents/IncidentListPage";

import TaskPage from "../../components/tasks/TaskPage";
import TaskDetailsPage from "../../components/tasks/TaskDetailsPage";

import PageErrorFallback from "../../components/common/PageErrorFallback";

export const hrRoutes = {
  path: "/hr",
  element: (
    <ModuleProvider module="HR">
      <EmployeeAdminLayout />
    </ModuleProvider>
  ),
  errorElement: <PageErrorFallback />,
  children: [
    {
      index: true,
      element: <EmployeeAdminPage />,
    },

    // Employees
    {
      path: "employees_list",
      element: <EmployeeListPage />,
    },
    {
      path: "employees_list/:_id",
      element: <EmployeeDetailsPage />,
    },
    {
      path: "employees_list/:_id/attendances",
      element: <EmployeeAttendanceReport />,
    },
    {
      path: "employees_list/:_id/leaves",
      element: <EmployeeLeaveReport />,
    },
    {
      path: "employees_list/:_id/payslips",
      element: <EmployeePayslips />,
    },
    {
      path: "employees_list/:_id/payslips/:payslipId",
      element: <EmployeePayslipDetails />,
    },
    {
      path: "employees_list/:_id/payslips/settings",
      element: <PayrollEmployeeProfileSettingsPage />,
    },

    // Attendance
    {
      path: "attendances",
      element: <EmployeeAttendancePage />,
    },

    // Leave
    {
      path: "leaves",
      element: <EmployeeLeavePage />,
    },

    // Payroll
    {
      path: "payroll",
      element: <PayrollPage />,
    },
    {
      path: "payroll/settings",
      element: <PayrollSettingsPage />,
    },
    {
      path: "payroll/details/:_id",
      element: <PayrollDetailsPage />,
    },

    // Reports
    {
      path: "reports",
      element: <ReportPage />,
    },
    {
      path: "reports/late_attendance",
      element: <LateAttendanceReportPage />,
    },
    {
      path: "reports/daily_attendance",
      element: <DailyAttendanceReportPage />,
    },
    {
      path: "reports/weekly_attendance",
      element: <WeeklyAttendanceReportPage />,
    },
    {
      path: "reports/transport_allowance",
      element: <TransportAllowancePage />,
    },
    {
      path: "reports/transport_allowance/transport_allowance_weekly",
      element: <TransportAllowanceWeeklyReportPage />,
    },

    // Tasks
    {
      path: "tasks",
      element: <TaskPage />,
    },
    {
      path: "tasks/details/:_id",
      element: <TaskDetailsPage />,
    },

    // Incidents
    {
      path: "incidents",
      element: <IncidentListPage />,
    },
    {
      path: "incidents/:_id",
      element: <IncidentDetailsPage />,
    },
  ],
};
