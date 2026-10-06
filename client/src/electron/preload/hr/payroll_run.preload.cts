type PayslipDocumentData = import("../../../common/types/hr/payroll/PayslipDocument", { with: { "resolution-mode": "require" } }).PayslipDocumentData;
type PayrollPaymentFilter = import("../../../common/types/hr/payroll/payrollPayment", { with: { "resolution-mode": "require" } }).PayrollPaymentFilter;
type AdminUser = import("../../../common/types/shared/AdminUser", {
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
  getPayslipDocument: (companyId: string, employeeId: string, payrollRunId: string) =>
    invoke<PayslipDocumentData>("payroll:getPayslipDocument", companyId, employeeId, payrollRunId),
  savePayslipReport: (companyId: string, employeeId: string, payrollRunId: string) =>
    invoke<{ canceled: boolean; filePath?: string }>("payroll:savePayslipReport", companyId, employeeId, payrollRunId),
  saveMonthlyReport: (companyId: string, runId: string, department: string | null, paymentMethod: PayrollPaymentFilter = "all") =>
    invoke<{ canceled: boolean; filePath?: string }>("payroll:saveMonthlyReport", companyId, runId, department, paymentMethod),
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

  verifyPayslip: (companyId: string, payrollResultId: string, admin: AdminUser) =>
    invoke("payroll:verifyPayslip", companyId, payrollResultId, admin),

  approvePayslip: (companyId: string, payrollResultId: string, admin: AdminUser) =>
    invoke("payroll:approvePayslip", companyId, payrollResultId, admin),

  markPayslipAsPaid: (companyId: string, payrollResultId: string, admin: AdminUser) =>
    invoke("payroll:payPayslip", companyId, payrollResultId, admin),

  getProcessedPayrollRuns: (companyId: string) =>
    invoke("payroll:getProcessedRuns", companyId),

  cancelProcessedPayroll: (companyId: string, payrollRunId: string, admin: AdminUser) =>
    invoke("payroll:cancelProcessed", companyId, payrollRunId, admin),

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
