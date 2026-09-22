import { contextBridge } from "electron";
import { incidentApi } from "./shared/incidents.preload.cjs";

import { employeeApi } from "./hr/employees.preload.cjs";
import { attendanceApi } from "./hr/attendances.preload.cjs";
import { leaveApi } from "./hr/leaves.preload.cjs";
import { payrollSettingsApi } from "./hr/payroll_settings.preload.cjs";
import { payrollComponentsApi } from "./hr/payroll_components.preload.cjs";
import { payrollProfileApi } from "./hr/payroll_profile.preload.cjs";
import { payrollRunApi } from "./hr/payroll_run.preload.cjs";
import {
  attendanceDailyCheckApi,
} from "./hr/attendance_daily_check.preload.cjs";
import { attendanceReportsApi } from "./hr/attendance_reports.preload.cjs";
import { companyApi } from "./shared/company.preload.cjs";
import {
  employeesDocumentsApi,
} from "./hr/employees_documents.preload.cjs";
import { taskApi } from "./shared/task.preload.cjs";
import { syncApi } from "./shared/sync.preload.cjs";
import { notificationsApi } from "./shared/notifications.preload.cjs";
import { authApi } from "./shared/auth.preload.cjs";

console.log("PRELOAD LOADED!!!");

const electronApi = {
  hr: {
    employees: employeeApi,
    employees_documents: employeesDocumentsApi,
    attendance: attendanceApi,
    attendanceDailyCheck: attendanceDailyCheckApi,
    attendance_reports: attendanceReportsApi,
    leave: leaveApi,
    payrollSettings: payrollSettingsApi,
    payrollComponents: payrollComponentsApi,
    payrollProfile: payrollProfileApi,
    payrollRun: payrollRunApi,
  },
  auth: authApi,
  company: companyApi,
  tasks: taskApi,
  incidents: incidentApi,
  sync: syncApi,
  notifications: notificationsApi,
} satisfies Window["electron"];

contextBridge.exposeInMainWorld("electron", electronApi);
