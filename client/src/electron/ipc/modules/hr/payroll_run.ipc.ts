import { ipcMain } from "electron";
import { saveMonthlyPayrollReport } from "../../../services/modules/hr/payroll/monthlyPayrollReport.service.js";
import AdminUser from "../../../../common/types/AdminUser.js";
import { getAllEmployeePayrollInputs } from "../../../database/repositories/modules/hr/payroll_employee_profile.repository.js";
import {
  approvePayrollRun,
  cancelPayrollRun,
  createPayrollRun,
  deletePayrollRun,
  getEmployeePayrollResults,
  getPayrollItems,
  getPayrollResults,
  getPayrollRunById,
  getPayrollRuns,
  paymentPayrollRun,
  savePayrollResults,
  updatePayrollStatus,
  verifyPayrollRun,
} from "../../../database/repositories/modules/hr/payroll_run.repository.js";
import { getPayrollSettings } from "../../../database/repositories/modules/hr/payroll_settings.repository.js";
import { calculatePayrollsWithSummary } from "../../../services/modules/hr/payroll/calculatePayroll.js";
import { validatePayrolls } from "../../../services/modules/hr/payroll/validatePayroll.js";
import { getPayrollAttendanceSummary } from "../../../database/repositories/modules/hr/attendances.repository.js";
import { PayrollRunDto } from "../../../preload/hr/payroll_run.preload.cjs";

export function registerPayrollGenerationIPC() {
  ipcMain.handle("payroll:saveMonthlyReport", (_, companyId: string, runId: string, department: string | null) =>
    saveMonthlyPayrollReport(companyId, runId, department)
  );
  console.log("REGISTERING PAYROLL GENERATION IPC");

  // Generate payroll draft
  ipcMain.handle(
    "payroll:createDraft",
    async (_, payroll_run: PayrollRunDto) => {
      //  Fetch payroll settings
      console.log("CID", payroll_run.companyId);
      const payrollSettings = await getPayrollSettings(
        payroll_run.admin.companyId
      );
      if (!payrollSettings) {
        throw new Error(
          `Veuillez d'abord configurer les paramètres de bulletins de paie. 
          `
        );
      }
      console.log("PAYROLL SETTINGS:", payrollSettings);

      // Employee payroll inputs
      const inputs = await getAllEmployeePayrollInputs(
        payroll_run.admin.companyId
      );

      console.log(
        `FETCHED ${inputs.length} EMPLOYEE PAYROLL INPUTS FOR ${payroll_run.month}/${payroll_run.year}`
      );

      // Fetch attendance summary
      const payrollInputsWithAttendance = await Promise.all(
        inputs.map(async (employee) => {
          const attendance = await getPayrollAttendanceSummary(
            payroll_run.admin.companyId,
            employee.employeeId,
            payroll_run.month,
            payroll_run.year
          );
          console.log(`ATTENDANCE FOR ${employee.employeeId}:`, attendance);

          return {
            ...employee,
            attendance,
          };
        })
      );

      // Validate payroll
      const validation = validatePayrolls(payrollInputsWithAttendance);

      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Calculate payroll
      const batch = await calculatePayrollsWithSummary(
        payroll_run.admin.companyId,
        payrollInputsWithAttendance,
        payroll_run.admin,
        payrollSettings
      );

      // Create payroll run
      const payrollRun = await createPayrollRun(batch, payroll_run);

      // Save payroll results
      await savePayrollResults(
        payroll_run.admin.companyId,
        payrollRun._id,
        batch.results
      );

      return {
        payrollRun,
        results: batch.results,
      };
    }
  );

  /**
   * BROUILLON → EN_VERIFICATION
   */
  ipcMain.handle(
    "payroll:submitForVerification",
    async (
      _,
      companyId: string,
      managerEmail: string,
      payrollRunId: string,
      admin: AdminUser
    ) => {
      return await verifyPayrollRun(
        companyId,
        managerEmail,
        payrollRunId,
        admin
      );
    }
  );

  /**
   * EN_VERIFICATION → BROUILLON
   * Reviewer sends payroll back for correction
   */
  ipcMain.handle(
    "payroll:returnToDraft",
    async (_, companyId: string, payrollRunId: string) => {
      return await updatePayrollStatus(companyId, payrollRunId, "BROUILLON");
    }
  );

  /**
   * EN_VERIFICATION → APPROUVÉ
   */
  ipcMain.handle(
    "payroll:approve",
    async (_, companyId: string, payrollRunId: string, admin: AdminUser) => {
      return await approvePayrollRun(companyId, payrollRunId, admin);
    }
  );

  /**
   * APPROUVÉ → PAYÉ
   */
  ipcMain.handle(
    "payroll:markAsPaid",
    async (
      _,
      companyId: string,
      managerEmail: string,
      payrollRunId: string,
      admin: AdminUser
    ) => {
      return await paymentPayrollRun(
        companyId,
        managerEmail,
        payrollRunId,
        admin
      );
    }
  );

  /**
   * BROUILLON / EN_VERIFICATION / APPROUVÉ → ANNULÉ
   */
  ipcMain.handle(
    "payroll:cancel",
    async (_, companyId: string, payrollRunId: string, admin: AdminUser) => {
      return await cancelPayrollRun(companyId, payrollRunId, admin);
    }
  );

  ipcMain.handle(
    "payroll:getRuns",
    async (_, companyId: string, year: number, month: number) => {
      return await getPayrollRuns(companyId, year, month);
    }
  );

  ipcMain.handle(
    "payroll:getRunById",
    async (_, companyId: string, id: string) => {
      return await getPayrollRunById(companyId, id);
    }
  );

  ipcMain.handle(
    "payroll:getResults",
    async (_, companyId: string, payrollRunId: string) => {
      return await getPayrollResults(companyId, payrollRunId);
    }
  );

  ipcMain.handle(
    "payroll:getEmployeeResults",
    async (_, companyId: string, employeeId: string, payrollRunId?: string) => {
      console.log("EMPLOYEE PAYSLIPS IPC RECEIVED FOR", employeeId);
      const results = await getEmployeePayrollResults(
        companyId,
        employeeId,
        payrollRunId
      );
      console.log("FETCHED RESULTS", results);
      return results;
    }
  );

  ipcMain.handle(
    "payroll:getItems",
    async (
      _,
      companyId: string,
      payrollResultId: string,
      employeeId?: string
    ) => {
      return await getPayrollItems(companyId, payrollResultId, employeeId);
    }
  );

  ipcMain.handle(
    "payroll:deleteRun",
    async (_, companyId: string, payrollRunId: string) => {
      return await deletePayrollRun(companyId, payrollRunId);
    }
  );
}
