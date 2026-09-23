type AdminUser = import("../../../common/types/AdminUser", {
  with: { "resolution-mode": "require" },
}).default;
 
import { invoke } from "../../ipc/ipc.cjs";

export interface PayrollRunDto {
  companyId: string;
  managerEmail: string;
  admin: AdminUser;
  year: number;
  month: number;
}

export const payrollRunApi = {
  saveMonthlyReport: (companyId: string, runId: string, department: string | null) =>
    invoke<{ canceled: boolean; filePath?: string }>("payroll:saveMonthlyReport", companyId, runId, department),
  createPayrollDraft: (payrollRun: PayrollRunDto) =>
    invoke("payroll:createDraft", payrollRun),

  getPayrollRuns: (companyId: string, year: number, month: number) =>
    invoke("payroll:getRuns", companyId, year, month),

  getPayrollRunById: (companyId: string, id: string) =>
    invoke("payroll:getRunById", companyId, id),

  submitForVerification: (
    companyId: string,
    managerEmail: string,
    payrollRunId: string,
    admin: AdminUser
  ) =>
    invoke(
      "payroll:submitForVerification",
      companyId,
      managerEmail,
      payrollRunId,
      admin
    ),

  returnToDraft: (companyId: string, payrollRunId: string) =>
    invoke("payroll:returnToDraft", companyId, payrollRunId),

  approvePayroll: (
    companyId: string,
    payrollRunId: string,
    adminUser: AdminUser
  ) => invoke("payroll:approve", companyId, payrollRunId, adminUser),

  markPayrollAsPaid: (
    companyId: string,
    managerEmail: string,
    payrollRunId: string,
    adminUser: AdminUser
  ) =>
    invoke(
      "payroll:markAsPaid",
      companyId,
      managerEmail,
      payrollRunId,
      adminUser
    ),

  cancelPayroll: (companyId: string, payrollRunId: string, admin: AdminUser) =>
    invoke("payroll:cancel", companyId, payrollRunId, admin),

  getPayrollResults: (companyId: string, payrollRunId: string) =>
    invoke("payroll:getResults", companyId, payrollRunId),

  getEmployeePayrollResults: (
    companyId: string,
    employeeId: string,
    payrollRunId?: string
  ) =>
    invoke("payroll:getEmployeeResults", companyId, employeeId, payrollRunId),

  getPayrollItems: (
    companyId: string,
    payrollResultId: string,
    employeeId?: string
  ) => invoke("payroll:getItems", companyId, payrollResultId, employeeId),

  deletePayrollRun: (companyId: string, payrollRunId: string) =>
    invoke("payroll:deleteRun", companyId, payrollRunId),
};
