import type { authApi } from "../../electron/preload/shared/auth.preload.cjs";
import type { IncidentApi } from "./incident/Incident";
import type { employeeApi } from "../../electron/preload/hr/employees.preload.cjs";
import type { attendanceApi } from "../../electron/preload/hr/attendances.preload.cjs";
import type { leaveApi } from "../../electron/preload/hr/leaves.preload.cjs";
import type { payrollSettingsApi } from "../../electron/preload/hr/payroll_settings.preload.cjs";
import type { payrollComponentsApi } from "../../electron/preload/hr/payroll_components.preload.cjs";
import type { payrollProfileApi } from "../../electron/preload/hr/payroll_profile.preload.cjs";
import type { payrollRunApi } from "../../electron/preload/hr/payroll_run.preload.cjs";
import type { attendanceDailyCheckApi } from "../../electron/preload/hr/attendance_daily_check.preload.cjs";
import type { attendanceReportsApi } from "../../electron/preload/hr/attendance_reports.preload.cjs";
import type { companyApi } from "../../electron/preload/shared/company.preload.cjs";
import type { employeesDocumentsApi } from "../../electron/preload/hr/employees_documents.preload.cjs";
import type { taskApi } from "../../electron/preload/shared/task.preload.cjs";
import type { syncApi } from "../../electron/preload/shared/sync.preload.cjs";
import type { notificationsApi } from "../../electron/preload/shared/notifications.preload.cjs";

declare global {
  interface Window {
    electron: {
      hr: {
        employees: typeof employeeApi;
        employees_documents: typeof employeesDocumentsApi;
        attendance: typeof attendanceApi;
        attendanceDailyCheck: typeof attendanceDailyCheckApi;
        attendance_reports: typeof attendanceReportsApi;
        leave: typeof leaveApi;
        payrollSettings: typeof payrollSettingsApi;
        payrollComponents: typeof payrollComponentsApi;
        payrollProfile: typeof payrollProfileApi;
        payrollRun: typeof payrollRunApi;
      };
      auth: typeof authApi;
      company: typeof companyApi;
      tasks: typeof taskApi;
      incidents: IncidentApi;
      sync: typeof syncApi;
      notifications: typeof notificationsApi;
    };
  }
}

export {};
